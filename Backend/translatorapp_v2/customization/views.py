# Copyright 2026 Centro Nacional de Inteligencia Artificial (CENIA, Chile).
# All rights reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
"""API of "Administrar Traductor".

Public:
    GET  config/                    published document (null until first publish)
    GET  assets/<uuid>/             an uploaded file, cached forever

Translator managers only (see main.roles.can_manage_translator):
    GET  draft/                     working copy + status
    PUT  draft/                     save the working copy (autosave)
    POST publish/                   make the working copy live, snapshot it
    POST discard/                   drop unpublished changes
    GET  revisions/                 publish history
    GET  revisions/<id>/            one snapshot
    POST revisions/<id>/restore/    load a snapshot into the working copy
    GET  assets/                    uploaded files
    POST assets/                    upload a file (multipart, field "file")

Writes carry the ``baseVersion`` the client last saw; a mismatch answers 409
with the current state instead of overwriting another admin's work.
"""
import hashlib
import json

from django.db import transaction
from django.http import HttpResponse, HttpResponseNotModified
from django.shortcuts import get_object_or_404
from django.utils import timezone
from main.roles import IsTranslatorManager
from rest_framework import status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .access import effective_access
from .assets import AssetError, inspect_upload
from .models import CustomizationAsset, CustomizationRevision, TranslatorCustomization
from .schema import SCHEMA_VERSION, ConfigValidationError, validate_config


def _user_label(user):
    if not user:
        return None
    full_name = f"{user.first_name} {user.last_name}".strip()
    return full_name or user.email or user.username


def _state(customization):
    return {
        "config": customization.working_copy,
        "version": customization.draft_version,
        "publishedVersion": customization.published_version,
        "hasUnpublishedChanges": customization.has_unpublished_changes,
        "updatedAt": customization.draft_updated_at,
        "updatedBy": _user_label(customization.draft_updated_by),
        "publishedAt": customization.published_at,
        "publishedBy": _user_label(customization.published_by),
        "schemaVersion": SCHEMA_VERSION,
        # the rules in force, for a working copy saved before "Visibilidad"
        "access": effective_access(),
    }


def _conflict(customization):
    return Response(
        {
            "detail": "Otro administrador guardó cambios mientras editabas.",
            "code": "version_conflict",
            "state": _state(customization),
        },
        status=status.HTTP_409_CONFLICT,
    )


def _invalid(error):
    return Response(
        {
            "detail": "Hay campos con problemas.",
            "code": "invalid_config",
            "errors": error.errors,
        },
        status=status.HTTP_400_BAD_REQUEST,
    )


def _base_version(request):
    try:
        return int(request.data.get("baseVersion"))
    except (TypeError, ValueError):
        return None


class PublishedConfigView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        customization = TranslatorCustomization.load()
        access = effective_access()
        # the rules can also come from the defaults: they are part of the tag
        rules = hashlib.sha1(json.dumps(access, sort_keys=True).encode()).hexdigest()[
            :10
        ]
        etag = f'W/"config-{customization.published_version}-{rules}"'
        if request.headers.get("If-None-Match") == etag:
            response = HttpResponseNotModified()
        else:
            response = Response(
                {
                    "version": customization.published_version,
                    "config": customization.published,
                    "publishedAt": customization.published_at,
                    # who may use what, as the API enforces it (also when no
                    # document with rules has been published yet)
                    "access": access,
                }
            )
        response["ETag"] = etag
        # Always revalidate: a publish must show up on the next page load.
        response["Cache-Control"] = "no-cache"
        return response


class DraftView(APIView):
    permission_classes = [IsTranslatorManager]
    parser_classes = [JSONParser]

    def get(self, request):
        return Response(_state(TranslatorCustomization.load()))

    def put(self, request):
        try:
            cleaned = validate_config(request.data.get("config"))
        except ConfigValidationError as error:
            return _invalid(error)

        with transaction.atomic():
            customization = TranslatorCustomization.load_for_update()
            if _base_version(request) != customization.draft_version:
                return _conflict(customization)
            customization.draft = cleaned
            customization.draft_version += 1
            customization.draft_updated_at = timezone.now()
            customization.draft_updated_by = request.user
            customization.save()
        return Response(_state(customization))


class PublishView(APIView):
    permission_classes = [IsTranslatorManager]
    parser_classes = [JSONParser]

    def post(self, request):
        incoming = request.data.get("config")
        cleaned = None
        if incoming is not None:
            try:
                cleaned = validate_config(incoming)
            except ConfigValidationError as error:
                return _invalid(error)

        with transaction.atomic():
            customization = TranslatorCustomization.load_for_update()
            if _base_version(request) != customization.draft_version:
                return _conflict(customization)

            now = timezone.now()
            if cleaned is not None:
                customization.draft = cleaned
                customization.draft_version += 1
                customization.draft_updated_at = now
                customization.draft_updated_by = request.user

            document = customization.working_copy
            if document is None:
                return Response(
                    {"detail": "No hay cambios para publicar."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            # Re-check documents saved under an older schema before they go live.
            try:
                document = validate_config(document)
            except ConfigValidationError as error:
                return _invalid(error)

            customization.published = document
            customization.published_version += 1
            customization.published_at = now
            customization.published_by = request.user
            customization.draft = None
            customization.save()
            CustomizationRevision.objects.create(
                version=customization.published_version,
                data=document,
                note=str(request.data.get("note") or "")[:300],
                created_by=request.user,
            )
        return Response(_state(customization))


class DiscardView(APIView):
    permission_classes = [IsTranslatorManager]
    parser_classes = [JSONParser]

    def post(self, request):
        with transaction.atomic():
            customization = TranslatorCustomization.load_for_update()
            if _base_version(request) != customization.draft_version:
                return _conflict(customization)
            customization.draft = None
            customization.draft_version += 1
            customization.draft_updated_at = timezone.now()
            customization.draft_updated_by = request.user
            customization.save()
        return Response(_state(customization))


def _revision_summary(revision):
    return {
        "id": revision.id,
        "version": revision.version,
        "note": revision.note,
        "createdAt": revision.created_at,
        "createdBy": _user_label(revision.created_by),
    }


class RevisionListView(APIView):
    permission_classes = [IsTranslatorManager]

    def get(self, request):
        revisions = CustomizationRevision.objects.select_related("created_by").defer(
            "data"
        )[:100]
        return Response([_revision_summary(revision) for revision in revisions])


class RevisionDetailView(APIView):
    permission_classes = [IsTranslatorManager]

    def get(self, request, pk):
        revision = get_object_or_404(CustomizationRevision, pk=pk)
        return Response({**_revision_summary(revision), "config": revision.data})


class RevisionRestoreView(APIView):
    permission_classes = [IsTranslatorManager]
    parser_classes = [JSONParser]

    def post(self, request, pk):
        revision = get_object_or_404(CustomizationRevision, pk=pk)
        try:
            cleaned = validate_config(revision.data)
        except ConfigValidationError as error:
            return _invalid(error)

        with transaction.atomic():
            customization = TranslatorCustomization.load_for_update()
            if _base_version(request) != customization.draft_version:
                return _conflict(customization)
            customization.draft = cleaned
            customization.draft_version += 1
            customization.draft_updated_at = timezone.now()
            customization.draft_updated_by = request.user
            customization.save()
        return Response(_state(customization))


def _asset_payload(asset):
    return {
        "id": str(asset.id),
        "ref": asset.ref,
        "kind": asset.kind,
        "contentType": asset.content_type,
        "size": asset.size,
        "width": asset.width,
        "height": asset.height,
        "name": asset.original_name,
        "createdAt": asset.created_at,
    }


class AssetListView(APIView):
    permission_classes = [IsTranslatorManager]
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request):
        assets = CustomizationAsset.objects.defer("data")
        kind = request.query_params.get("kind")
        if kind:
            assets = assets.filter(kind=kind)
        return Response([_asset_payload(asset) for asset in assets[:500]])

    def post(self, request):
        upload = request.FILES.get("file")
        if upload is None:
            return Response(
                {"detail": "Adjunta un archivo en el campo 'file'."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        # Read one byte past the largest allowed size, never the whole stream
        raw = upload.read(8 * 1024 * 1024 + 1)
        try:
            kind, content_type, width, height = inspect_upload(raw)
        except AssetError as error:
            return Response({"detail": str(error)}, status=status.HTTP_400_BAD_REQUEST)

        digest = hashlib.sha256(raw).hexdigest()
        asset = CustomizationAsset.objects.filter(sha256=digest).defer("data").first()
        created = asset is None
        if created:
            asset = CustomizationAsset.objects.create(
                kind=kind,
                sha256=digest,
                content_type=content_type,
                data=raw,
                size=len(raw),
                width=width,
                height=height,
                original_name=(upload.name or "")[:255],
                created_by=request.user,
            )
        return Response(
            _asset_payload(asset),
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class AssetFileView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request, pk):
        asset = get_object_or_404(CustomizationAsset, pk=pk)
        etag = f'"{asset.sha256}"'
        if request.headers.get("If-None-Match") == etag:
            response = HttpResponseNotModified()
        else:
            response = HttpResponse(bytes(asset.data), content_type=asset.content_type)
            response["Content-Length"] = str(asset.size)
        response["ETag"] = etag
        response["Cache-Control"] = "public, max-age=31536000, immutable"
        response["X-Content-Type-Options"] = "nosniff"
        # Neutralise anything active if the file is opened directly
        response["Content-Security-Policy"] = (
            "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; "
            "sandbox"
        )
        # Staging serves the frontend from another origin
        response["Cross-Origin-Resource-Policy"] = "cross-origin"
        return response
