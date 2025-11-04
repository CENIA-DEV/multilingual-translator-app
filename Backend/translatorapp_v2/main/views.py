# Copyright 2024 Centro Nacional de Inteligencia Artificial (CENIA, Chile).
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
import base64
import logging
from functools import reduce
from operator import or_

import numpy as np
from django.contrib.auth.models import User
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import mixins, viewsets
from rest_framework.authtoken.models import Token
from rest_framework.authtoken.views import ObtainAuthToken
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.status import HTTP_201_CREATED, HTTP_400_BAD_REQUEST
from rest_framework.views import APIView

from .models import (
    CacheTTS,
    GeneralSuggestion,
    InvitationToken,
    Lang,
    PasswordResetToken,
    RequestAccess,
    SpeechToTextAudio,
    TextToSpeechAudio,
    TranslationPair,
)
from .roles import IsAdmin, IsNativeAdmin, TranslationRequiresAuth
from .serializers import (
    FullUserSerializer,
    GeneralSuggestionSerializer,
    InvitationSerializer,
    LanguageSerializer,
    ParticipateSerializer,
    PasswordResetSerializer,
    RequestSerializer,
    SpeechToTextSerializer,
    SuggestionSerializer,
    TextToSpeechSerializer,
    TranslationPairSerializer,
    UserSerializer,
)
from .utils import (
    filter_cache,
    generate_asr,
    generate_tts,
    send_invite_email,
    send_participate_email,
    send_recovery_email,
    translate,
)

logger = logging.getLogger(__name__)


class CustomAuthToken(ObtainAuthToken):

    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(
            data=request.data, context={"request": request}
        )
        if serializer.is_valid():
            user = serializer.validated_data["user"]
            token, created = Token.objects.get_or_create(user=user)
            return Response(
                {"token": token.key, "user_id": user.pk, "email": user.email},
            )
        else:
            return Response(serializer.errors, status=HTTP_400_BAD_REQUEST)


class UserViewSet(viewsets.ModelViewSet):
    def get_queryset(self):
        if self.action in ["change_status", "get_status"]:
            return User.objects.all()
        else:
            return User.objects.filter(is_active=True)

    def get_permissions(self):
        """
        Instantiates and returns the list of permissions that this view requires.
        """
        if self.action in [
            "create_by_invitation",
            "update_password_token",
            "get_by_token",
        ]:
            # Since app is in beta create is not callable, users can only register
            # by invitation this will change later.
            permission_classes = [
                AllowAny
            ]  # allowany since recovery token is used to authenticate
        elif self.action in ["update_user_profile", "update_password"]:
            # update profile should only be users authenticated and the same user
            permission_classes = [IsAuthenticated]
        else:
            permission_classes = [IsNativeAdmin | IsAdmin | IsAdminUser]

        return [permission() for permission in permission_classes]

    def get_serializer_class(self):
        """
        Returns the serializer class that the corresponding view requires.
        """
        # These different serializers hide sensitive information like password and role
        if self.action in ["update_user_profile", "disable_user"]:
            return UserSerializer
        else:
            return FullUserSerializer

    @action(detail=False, methods=["patch"])
    def update_user_profile(self, request):
        # get user to update, it's the same as the one doing the request
        user = self.request.user
        # to update instance it important to pass instance and partial=True to avoid
        # other field validations
        serializer = self.get_serializer(user, data=request.data, partial=True)
        # check passed data formats comply with db restrictions
        if serializer.is_valid():
            # this will call serializer update since a user instance was passed before
            serializer.save()
        else:
            # in case of errors in format, serializer errors will contain that info
            return Response(serializer.errors, status=HTTP_400_BAD_REQUEST)
        # if everything goes well serializer data will have the deserialized object
        return Response(serializer.data)

    @action(detail=True, methods=["patch"])
    def update_user_role(self, request, pk):
        user = self.get_object()

        serializer = self.get_serializer(
            user, data={"profile": request.data}, partial=True
        )
        # check passed data formats comply with db restrictions
        if serializer.is_valid():
            serializer.save()
        else:
            return Response(serializer.errors, status=HTTP_400_BAD_REQUEST)
        # if everything goes well serializer data will have the deserialized obejct
        return Response(serializer.data)

    @action(detail=False, methods=["post"])
    def create_by_invitation(self, request):
        form = request.data.copy()
        print(form)
        token = form.pop("token")
        # hashed_token = get_hashed_token(token)
        invitation = get_object_or_404(InvitationToken.objects.all(), token=token)
        # TO DO: MAYBE THIS CHECK ISNT NECESARY, SHOULD CHECK TOKEN STATUS WHILE LOADING
        if invitation.is_expired():
            invitation.delete()
            return Response({"detail": "Token is expired"}, status=HTTP_400_BAD_REQUEST)
        # set role from invitation in form profile for serializer
        profile = form.get("profile", {})
        profile["role"] = invitation.role
        form["profile"] = profile
        serializer = self.get_serializer(data=form)
        # Perform validation, but don't raise an exception yet. Able to reactivate user
        if not serializer.is_valid():
            # Check if the error is due to a duplicate username
            if (
                "username" in serializer.errors
                and serializer.errors["username"][0].code == "unique"
            ):
                username = form["username"]
                email = form["email"]

                try:
                    # Try to find an inactive user with the same username and email
                    user = User.objects.get(
                        username=username, email=email, is_active=False
                    )
                    # If found, activate the user
                    user.is_active = True
                    # update user with new data
                    serializer = self.get_serializer(
                        instance=user, data=form, partial=True
                    )
                    serializer.is_valid(raise_exception=True)
                    self.perform_update(serializer)
                    invitation.delete()  # invitation token is deleted
                    return Response(
                        serializer.data,
                        status=HTTP_201_CREATED,
                    )

                except User.DoesNotExist:
                    # If no inactive user is found, re-raise the validation error
                    return Response(serializer.errors, status=HTTP_400_BAD_REQUEST)
            else:
                # If there are other validation errors, raise them
                return Response(serializer.errors, status=HTTP_400_BAD_REQUEST)

        # If validation passes (no duplicate username), create the user
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        invitation.delete()  # invitation token is deleted
        return Response(serializer.data, status=HTTP_201_CREATED, headers=headers)

    @action(detail=False, methods=["get"])
    def get_by_token(self, request):
        user = request.user
        return Response(self.get_serializer(user).data)

    @action(detail=False, methods=["patch"])
    def update_password(self, request):
        user = request.user
        # Check if the old password matches the user's current password
        old_password = request.data.get("old_password")
        if not old_password or not user.check_password(old_password):
            return Response(
                {"detail": "Old password is incorrect"}, status=HTTP_400_BAD_REQUEST
            )
        serializer = self.get_serializer(
            user, data={"password": request.data["new_password"]}, partial=True
        )
        if serializer.is_valid():
            serializer.save()
        else:
            return Response(serializer.errors, status=HTTP_400_BAD_REQUEST)
        return Response(serializer.data)

    @action(detail=False, methods=["patch"])
    def update_password_token(self, request):
        token = request.data["token"]
        # hashed_token = get_hashed_token(token)
        recovery_token = get_object_or_404(
            PasswordResetToken.objects.all(), token=token
        )
        if recovery_token.is_expired():
            recovery_token.delete()
            return Response(
                {"detail": "Token has expired"}, status=HTTP_400_BAD_REQUEST
            )

        user = recovery_token.user
        serializer = self.get_serializer(user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
        else:
            return Response(serializer.errors, status=HTTP_400_BAD_REQUEST)
        recovery_token.delete()
        return Response(serializer.data)

    @action(detail=True, methods=["get"])
    def get_status(self, request, pk):
        user = self.get_object()
        return Response({"detail": user.is_active})

    @action(detail=True, methods=["patch"])
    def change_status(self, request, pk=None):
        user = self.get_object()
        serializer = self.get_serializer(user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        else:
            return Response(serializer.errors, status=HTTP_400_BAD_REQUEST)


class LanguageViewSet(viewsets.ModelViewSet):
    queryset = Lang.objects.all()
    serializer_class = LanguageSerializer
    permission_classes = [AllowAny]

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            permission_classes = [IsNativeAdmin | IsAdmin | IsAdminUser]
        else:
            # only add and edit languages is allowed for admins
            permission_classes = [AllowAny]
        return [permission() for permission in permission_classes]

    def list(self, request):
        code = request.query_params.get("code")
        script = request.query_params.get("script")
        dialect = request.query_params.get("dialect")
        queryset = self.queryset
        # if code is not None then filter by code
        if code is not None:
            queryset = queryset.filter(code__icontains=code)
        # script and dialet must match exactly query params
        if script is not None:
            queryset = queryset.filter(script__code=script)
        elif dialect is not None:
            queryset = queryset.filter(dialect__code=dialect)
        serializer = self.serializer_class(queryset, many=True)
        return Response(serializer.data)


class InvitationViewSet(viewsets.ModelViewSet):
    queryset = InvitationToken.objects.all()
    serializer_class = InvitationSerializer
    permission_classes = [IsNativeAdmin | IsAdmin | IsAdminUser]

    @action(detail=False, methods=["post"])
    def send_invitation(self, request):
        # the request user is obtained with the token in the authorization header
        invited_by = request.user
        serializer = self.serializer_class(data=request.data)
        if serializer.is_valid():
            # this will call serializer create since no objects was passed to serializer
            # before we can also add any additional fields at this stage that wasnt
            # passed in the request in this case we will save the user
            # that sent the invite
            invitation = serializer.save(invited_by=invited_by)
        else:
            return Response(serializer.errors, status=HTTP_400_BAD_REQUEST)

        # send invitation email
        send_invite_email(
            invited_by_user=invited_by,
            user_email=invitation.email,
            invitation_token=invitation.token,
        )
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def resend_invitation(self, request, pk):
        invitation_token = self.get_object()
        serializer = self.serializer_class(invitation_token)
        if invitation_token.is_expired():
            # if token is expired we create a new one
            _ = invitation_token.generate_token()
            invitation_token.save()
        send_invite_email(
            invited_by_user=invitation_token.invited_by,
            user_email=invitation_token.email,
            invitation_token=invitation_token.token,
        )
        return Response(serializer.data)

    @action(detail=False, methods=["get"], permission_classes=[AllowAny])
    def check_invitation_token(self, request):
        token = request.query_params.get("token")
        invitation = get_object_or_404(self.queryset, token=token)
        serializer = self.serializer_class(invitation)
        return Response(serializer.data)

    @action(detail=False, methods=["post"], permission_classes=[AllowAny])
    def get_invitation_by_user(self, request):
        invitation = get_object_or_404(self.queryset, email=request.data["email"])
        serializer = self.serializer_class(invitation)
        return Response(serializer.data)


class PasswordResetViewSet(viewsets.ModelViewSet):
    serializer_class = PasswordResetSerializer
    queryset = PasswordResetToken.objects.all()

    @action(detail=False, methods=["post"], permission_classes=[AllowAny])
    def recover_password(self, request):
        serializer = self.serializer_class(data={"user": request.data})
        if serializer.is_valid():
            invitation = serializer.save()
        else:
            return Response(serializer.errors, status=HTTP_400_BAD_REQUEST)

        # send recovery email
        send_recovery_email(
            user_email=invitation.user.email, raw_token=invitation.token
        )
        return Response(serializer.data)

    @action(detail=False, methods=["get"], permission_classes=[AllowAny])
    def check_reset_token(self, request):
        token = request.query_params.get("token")
        reset_token = get_object_or_404(self.queryset, token=token)
        serializer = self.serializer_class(reset_token)
        return Response(serializer.data)


class SuggestionViewSet(viewsets.ModelViewSet):
    serializer_class = SuggestionSerializer
    permission_classes = [IsNativeAdmin | IsAdmin | IsAdminUser]
    pagination_class = PageNumberPagination

    def get_permissions(self):
        if self.action in [
            "accept_translation",
            "reject_translation",
            "add_suggestion",
        ]:  # TODO: Review
            permission_classes = [AllowAny]
        else:
            permission_classes = [IsNativeAdmin | IsAdmin | IsAdminUser]
        return [permission() for permission in permission_classes]

    def get_queryset(self):
        queryset = TranslationPair.objects.all()
        language_param = self.request.query_params.get("lang")
        validated = self.request.query_params.get("validated")
        correct = self.request.query_params.get("correct")
        if correct is not None:
            correct = correct.lower() == "true"
            queryset = queryset.filter(correct=correct)
        if language_param is not None:
            language_codes = [
                code.strip() for code in language_param.split(",") if code.strip()
            ]
            if language_codes:
                lang_query = reduce(
                    or_,
                    [
                        Q(src_lang__code=code) | Q(dst_lang__code=code)
                        for code in language_codes
                    ],
                )
                queryset = queryset.filter(lang_query)
        if validated is not None:
            validated = validated.lower() == "true"
            queryset = queryset.filter(validated=validated)
        return queryset.order_by("-created_at")

    def create(self, request):
        # add the user thats adding the suggestion
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            serializer.save(user=request.user)
            return Response(serializer.data, status=HTTP_201_CREATED)
        else:
            return Response(serializer.errors, status=HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=["post"])
    def accept_translation(self, request):
        suggestion = {**request.data}
        serializer = self.get_serializer(data=suggestion)
        if serializer.is_valid():
            # add feedback as positive and suggestion same dst_text
            # allow anonymous users to accept translations
            user = (
                request.user
                if hasattr(request, "user") and request.user.is_authenticated
                else None
            )
            serializer.save(
                user=user, feedback=True, suggestion=request.data["dst_text"]
            )
            return Response(serializer.data, status=HTTP_201_CREATED)
        else:
            return Response(serializer.errors, status=HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=["post"])
    def reject_translation(self, request):
        # suggestion is given by user
        suggestion = {**request.data}
        # add suggestion from user
        serializer = self.get_serializer(data=suggestion)
        if serializer.is_valid():
            # add feedback as negative
            # allow anonymous users to reject translations
            user = (
                request.user
                if hasattr(request, "user") and request.user.is_authenticated
                else None
            )
            serializer.save(user=user, feedback=False)
            return Response(
                serializer.data,
                status=HTTP_201_CREATED,
            )
        else:
            return Response(serializer.errors, status=HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["patch"])
    def accept_suggestion(self, request, pk):
        suggestion = self.get_object()
        serializer = self.get_serializer(suggestion, data=request.data, partial=True)
        # this contains changes to original suggestion
        # a user can still accept a suggestion but with minor changes
        updated_suggestion = request.data["updated_suggestion"]
        updated_src_text = request.data["src_text"]
        if serializer.is_valid():
            # if feedback is positive then we update the suggestion
            # (just in case user added something)
            if suggestion.feedback:
                serializer.save(
                    correct=True,
                    validated=True,
                    src_text=updated_src_text,
                    dst_text=updated_suggestion,
                    validated_by=request.user,
                )
                return Response(serializer.data)
            # if feedback is negative we create a new correct suggestion
            #  and set the old one as incorrect
            else:
                serializer.save(correct=False, validated=True)
                new_suggestion = TranslationPair.objects.create(
                    src_text=updated_src_text,
                    dst_text=updated_suggestion,
                    suggestion=suggestion.suggestion,
                    src_lang=suggestion.src_lang,
                    dst_lang=suggestion.dst_lang,
                    user=suggestion.user,
                    model_name=suggestion.model_name,
                    model_version=suggestion.model_version,
                    correct=True,
                    validated=True,
                    validated_by=request.user,
                )
                return Response(self.get_serializer(new_suggestion).data)
        else:
            return Response(serializer.errors, status=HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["patch"])
    def reject_suggestion(self, request, pk):
        suggestion = self.get_object()
        serializer = self.get_serializer(suggestion, data=request.data, partial=True)
        if serializer.is_valid():
            # set suggestion as incorrect and validated
            serializer.save(correct=False, validated=True, validated_by=request.user)
            return Response(serializer.data)
        else:
            return Response(serializer.errors, status=HTTP_400_BAD_REQUEST)

    def partial_update(self, request, pk):
        user = request.user
        pair = self.get_object()
        serializer = self.get_serializer(pair, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save(user=user)
            return Response(serializer.data)
        else:
            return Response(serializer.errors, status=HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=["post"])
    def add_suggestion(self, request):
        """
        Handle general suggestions/comments from users (lightbulb button).
        Stores user feedback in separate GeneralSuggestion table.
        """
        serializer = GeneralSuggestionSerializer(data=request.data)

        if serializer.is_valid():
            user = (
                request.user
                if hasattr(request, "user") and request.user.is_authenticated
                else None
            )

            serializer.save(user=user)

            return Response(
                serializer.data,
                status=HTTP_201_CREATED,
            )
        else:
            return Response(serializer.errors, status=HTTP_400_BAD_REQUEST)

    # Optional: Action to get all general suggestions for admins
    @action(detail=False, methods=["get"])
    def get_general_suggestions(self, request):
        """Get all general suggestions for admin review"""
        reviewed = request.query_params.get("reviewed")
        queryset = GeneralSuggestion.objects.all()

        if reviewed is not None:
            reviewed = reviewed.lower() == "true"
            queryset = queryset.filter(reviewed=reviewed)

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = GeneralSuggestionSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = GeneralSuggestionSerializer(queryset, many=True)
        return Response(serializer.data)


class RequestViewSet(viewsets.ModelViewSet):
    serializer_class = RequestSerializer
    permission_classes = [IsNativeAdmin | IsAdmin | IsAdminUser]
    queryset = RequestAccess.objects.all()

    def get_permissions(self):
        """
        Instantiates and returns the list of permissions that this view requires.
        """
        if self.action == "create":
            permission_classes = [AllowAny]
        else:
            permission_classes = [IsNativeAdmin | IsAdmin | IsAdminUser]

        return [permission() for permission in permission_classes]

    @action(detail=False, methods=["get"])
    def get_pending_requests(self, request):
        pending_requests = RequestAccess.objects.filter(approved=None)
        serializer = self.get_serializer(pending_requests, many=True)
        return Response(serializer.data)


class TranslateViewSet(mixins.CreateModelMixin, viewsets.GenericViewSet):
    # since we only want to implement create endpoint we inherit create mixin
    permission_classes = [TranslationRequiresAuth]  # any user can translate
    serializer_class = TranslationPairSerializer

    def get_queryset(self, src_lang=None, dst_lang=None, src_text=None):
        # get all texts matching src or dst lang and text (cache)
        results = (
            TranslationPair.objects.filter(
                correct=True,
                validated=True,
                src_lang__code__in=[src_lang.code, dst_lang.code],
            )
            .filter(Q(src_text__iexact=src_text) | Q(dst_text__iexact=src_text))
            .order_by("-created_at")
        )
        return [s for s in results]

    def create(self, request):
        logger.info(f"Received translation request: {request.data}")
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            src_lang = serializer.validated_data["src_lang"]
            dst_lang = serializer.validated_data["dst_lang"]
            src_text = serializer.validated_data["src_text"]
            print(src_text)
            logger.debug(
                f"Validated translation request: src_lang={src_lang}, "
                f"dst_lang={dst_lang}, src_text={src_text}"
            )

            if src_lang == dst_lang:  # same lang return same text
                logger.debug(
                    "Source and destination languages are the same, "
                    "returning original text"
                )
                # this save doesnt actually save a translation pair
                # but its necessary to format correct response
                serializer.save(dst_text=src_text)
            else:
                # check for cache hits
                cache_results = self.get_queryset(
                    src_lang=src_lang, dst_lang=dst_lang, src_text=src_text
                )
                cache_result, cache_dst_lang = filter_cache(
                    src_lang, dst_lang, cache_results
                )
                if cache_result is None:
                    logger.debug("No cache hit, calling translation model")
                    # if no cache then call model translate endpoint
                    try:
                        translation = translate(src_text, src_lang, dst_lang)
                        serializer.save(**translation)
                    except Exception as e:
                        logger.error(f"Translation model error: {str(e)}")
                        return Response(
                            "Error en la predicción del modelo",
                            status=HTTP_400_BAD_REQUEST,
                        )
                else:
                    logger.debug("Cache hit found, returning cached translation")
                    # return cache
                    translation = cache_result
                    serializer.save(dst_text=cache_result, dst_lang=cache_dst_lang)
            logger.info(f"Translation response: {serializer.data}")
            return Response(serializer.data)
        else:
            logger.warning(f"Invalid translation request: {serializer.errors}")
            return Response(serializer.errors, HTTP_400_BAD_REQUEST)


class ParticipateRequestEndpoint(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ParticipateSerializer(data=request.data)
        if serializer.is_valid():
            # Process the data
            email = serializer.validated_data["email"]
            organization = serializer.validated_data["organization"]
            reason = serializer.validated_data["reason"]
            first_name = serializer.validated_data["first_name"]
            last_name = serializer.validated_data["last_name"]
            send_participate_email(email, organization, reason, first_name, last_name)
            return Response(serializer.data)
        return Response(serializer.errors, status=HTTP_400_BAD_REQUEST)


class TextToSpeechViewSet(mixins.CreateModelMixin, viewsets.GenericViewSet):
    """
    ViewSet for text-to-speech functionality
    """

    permission_classes = [TranslationRequiresAuth]
    serializer_class = TextToSpeechSerializer

    def get_queryset(self, text=None, lang=None):
        results = (
            TextToSpeechAudio.objects.filter(
                language__code=(lang.code if lang else None),
            ).filter(text__iexact=text)
            if text
            else TextToSpeechAudio.objects.none().order_by("-created_at")
        )
        return [s for s in results]

    def create(self, request):
        logger.info(f"Received text request: {request.data}")
        serializer = self.get_serializer(data=request.data)

        if serializer.is_valid():
            text = serializer.validated_data["text"]
            language_code = serializer.validated_data["language"]
            model_name = serializer.validated_data.get("model_name")
            model_version = serializer.validated_data.get("model_version")

            logger.debug(f"Validated TTS request: {language_code}")

            try:
                # Get the Lang object from the language code
                lang_obj = Lang.objects.get(code=language_code)

                # Check cache first (ONLY SOURCE OF DATA)
                try:
                    cached_tts = CacheTTS.objects.get(text=text, language=lang_obj)
                    logger.info("Cache hit for TTS request")

                    # Decode base64 audio to list of floats (waveform format)
                    try:
                        audio_bytes = base64.b64decode(cached_tts.audio_data)
                        logger.debug(f"Decoded {len(audio_bytes)} bytes from cache")

                        # Verify byte length is valid for float32
                        if len(audio_bytes) % 4 != 0:
                            logger.error("Invalid byte length")
                            raise ValueError("Invalid cached audio data")

                        # Convert bytes back to numpy array, then to list
                        waveform_array = np.frombuffer(audio_bytes, dtype=np.float32)
                        waveform_data = waveform_array.tolist()

                        logger.debug("Success")

                    except (ValueError, Exception):
                        logger.error("Failed to decode cached audio, model")
                        raise CacheTTS.DoesNotExist("Corrupted cache entry")

                    # Create TextToSpeechAudio record for tracking
                    audio_obj = TextToSpeechAudio.objects.create(
                        text=text,
                        language=lang_obj,
                        model_name=model_name or "cached",
                        model_version=model_version or "cached",
                        user=request.user if request.user.is_authenticated else None,
                    )

                    response_data = {
                        "id": audio_obj.id,
                        "text": audio_obj.text,
                        "language": language_code,
                        "model_name": audio_obj.model_name,
                        "model_version": audio_obj.model_version,
                        "waveform": waveform_data,
                    }

                    logger.info("Successfully returned cached TTS audio")
                    return Response(response_data)

                except CacheTTS.DoesNotExist:
                    logger.warning(
                        "Cache miss - calling model as fallback (no caching)"
                    )

                    # Generate new audio using the language code (FALLBACK ONLY)
                    generated_audio = generate_tts(text, language_code)

                    # Extract data
                    waveform_data = generated_audio.pop("waveform")
                    model_name = generated_audio.get(
                        "model_name", model_name or "unknown"
                    )
                    model_version = generated_audio.get(
                        "model_version", model_version or "unknown"
                    )

                    logger.info("TTS audio generated but NOT cached (inference mode)")

                    # Create tracking record
                    audio_obj = TextToSpeechAudio.objects.create(
                        text=text,
                        language=lang_obj,
                        model_name=model_name,
                        model_version=model_version,
                        user=request.user if request.user.is_authenticated else None,
                    )

                    response_data = {
                        "id": audio_obj.id,
                        "text": audio_obj.text,
                        "language": language_code,
                        "model_name": audio_obj.model_name,
                        "model_version": audio_obj.model_version,
                        "waveform": waveform_data,
                    }

                    logger.info("TTS response generated (not cached)!")
                    return Response(response_data)

            except Lang.DoesNotExist:
                logger.error(f"Language with code '{language_code}' not found")
                return Response(
                    f"Language code '{language_code}' not supported",
                    status=HTTP_400_BAD_REQUEST,
                )
            except Exception as e:
                logger.error(f"TTS model error: {str(e)}")
                import traceback

                logger.error(f"Traceback: {traceback.format_exc()}")
                return Response(
                    "Error en la predicción del modelo",
                    status=HTTP_400_BAD_REQUEST,
                )
        else:
            logger.warning(f"Invalid text request: {serializer.errors}")
            return Response(serializer.errors, HTTP_400_BAD_REQUEST)


class SpeechToTextViewSet(mixins.CreateModelMixin, viewsets.GenericViewSet):
    """
    ViewSet for speech-to-text functionality
    """

    permission_classes = [TranslationRequiresAuth]
    serializer_class = SpeechToTextSerializer
    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self, text=None, lang=None):
        results = (
            SpeechToTextAudio.objects.filter(
                language__code=(lang.code if lang else None),
            ).filter(text__iexact=text)
            if text
            else SpeechToTextAudio.objects.none().order_by("-created_at")
        )
        return [s for s in results]

    def create(self, request):
        logger.info("Received speech-to-text request")

        serializer = self.get_serializer(data=request.data)

        if serializer.is_valid():
            audio_file = serializer.validated_data["audio"]
            language_code = serializer.validated_data["language"]

            logger.debug(f"Processing ASR request for language: {language_code}")

            try:
                # Get the Lang object from the language code
                lang_obj = Lang.objects.get(code=language_code)

                # Read audio bytes and convert to base64
                audio_bytes = audio_file.read()
                audio_base64 = base64.b64encode(audio_bytes).decode("utf-8")

                # Detect audio format from file name
                audio_format = (
                    audio_file.name.split(".")[-1].lower()
                    if hasattr(audio_file, "name")
                    else "unknown"
                )

                # generate_asr returns a dict with 'text', 'model_name', 'model_version'
                # ✅Pass the bytes directly to generate_asr
                asr_result = generate_asr(audio_bytes, lang_obj)

                # Extract the transcribed text
                transcribed_text = asr_result["text"]

                logger.info("ASR transcription complete")

                # ✅ Create the database record with audio data
                audio_obj = SpeechToTextAudio.objects.create(
                    text=transcribed_text,
                    language=lang_obj,
                    audio_data=audio_base64,
                    audio_format=audio_format,
                    model_name=asr_result["model_name"],
                    model_version=asr_result["model_version"],
                    user=request.user if request.user.is_authenticated else None,
                )

                # Create response data (optionally include audio_data)
                response_data = {
                    "id": audio_obj.id,
                    "text": transcribed_text,
                    "language": language_code,
                    "audio_format": audio_format,
                    "model_name": asr_result["model_name"],
                    "model_version": asr_result["model_version"],
                }

                logger.info("ASR transcription complete")
                return Response(response_data)

            except Lang.DoesNotExist:
                logger.error(f"Language with code '{language_code}' not found")
                return Response(
                    f"Language code '{language_code}' not supported",
                    status=HTTP_400_BAD_REQUEST,
                )
            except Exception as e:
                logger.error(f"ASR processing error: {str(e)}")
                return Response(
                    "Error in speech recognition",
                    status=HTTP_400_BAD_REQUEST,
                )
        else:
            logger.warning(f"Invalid ASR request: {serializer.errors}")
            return Response(serializer.errors, HTTP_400_BAD_REQUEST)
