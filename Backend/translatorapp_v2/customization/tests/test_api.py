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
"""Draft / publish / history workflow of "Administrar Traductor"."""
import io

import pytest
from customization.models import CustomizationRevision
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image

from .test_schema import load_preset

CONFIG = "/api/customization/config/"
DRAFT = "/api/customization/draft/"
PUBLISH = "/api/customization/publish/"
DISCARD = "/api/customization/discard/"
REVISIONS = "/api/customization/revisions/"
ASSETS = "/api/customization/assets/"


def save_draft(api, document, base_version=0):
    return api.put(
        DRAFT, {"config": document, "baseVersion": base_version}, format="json"
    )


@pytest.mark.django_db
def test_the_published_config_is_empty_until_the_first_publish(api):
    response = api.get(CONFIG)
    assert response.status_code == 200
    assert response.data["config"] is None
    assert response.data["version"] == 0


@pytest.mark.django_db
@pytest.mark.parametrize("who", [None, "regular_user", "native_admin"])
def test_only_translator_managers_can_edit(api, request, who):
    if who:
        request.getfixturevalue(who)
    assert api.get(DRAFT).status_code in (401, 403)
    assert save_draft(api, load_preset()).status_code in (401, 403)
    assert api.post(PUBLISH, {"baseVersion": 0}, format="json").status_code in (
        401,
        403,
    )
    assert api.get(REVISIONS).status_code in (401, 403)


@pytest.mark.django_db
def test_superusers_without_a_profile_can_edit(api, superuser_without_profile):
    assert api.get(DRAFT).status_code == 200


@pytest.mark.django_db
def test_the_user_payload_says_who_can_manage_the_translator(api, manager):
    assert api.get("/api/users/get_by_token/").data["can_manage_translator"] is True


@pytest.mark.django_db
def test_community_admins_do_not_get_the_translator_admin(api, native_admin):
    assert api.get("/api/users/get_by_token/").data["can_manage_translator"] is False


@pytest.mark.django_db
def test_a_draft_is_private_until_published(api, manager):
    document = load_preset()
    document["identity"]["languageName"] = "Kunza"

    saved = save_draft(api, document)
    assert saved.status_code == 200, saved.data
    assert saved.data["version"] == 1
    assert saved.data["hasUnpublishedChanges"] is True
    assert api.get(CONFIG).data["config"] is None

    published = api.post(PUBLISH, {"baseVersion": 1, "note": "Kunza"}, format="json")
    assert published.status_code == 200, published.data
    assert published.data["hasUnpublishedChanges"] is False
    assert published.data["publishedVersion"] == 1

    live = api.get(CONFIG)
    assert live.data["version"] == 1
    assert live.data["config"]["identity"]["languageName"] == "Kunza"
    revision = CustomizationRevision.objects.get()
    assert revision.note == "Kunza" and revision.version == 1


@pytest.mark.django_db
def test_publish_can_save_and_publish_in_one_step(api, manager):
    document = load_preset("arn")
    response = api.post(PUBLISH, {"config": document, "baseVersion": 0}, format="json")
    assert response.status_code == 200, response.data
    assert api.get(CONFIG).data["config"]["identity"]["languageName"] == "Mapuzugun"


@pytest.mark.django_db
def test_invalid_documents_return_field_errors(api, manager):
    document = load_preset()
    document["theme"]["primary"] = "blue"
    response = save_draft(api, document)
    assert response.status_code == 400
    assert response.data["code"] == "invalid_config"
    assert response.data["errors"][0]["path"] == "theme.primary"


@pytest.mark.django_db
def test_stale_writes_are_rejected_with_the_current_state(api, manager):
    assert save_draft(api, load_preset(), base_version=0).status_code == 200
    stale = save_draft(api, load_preset(), base_version=0)
    assert stale.status_code == 409
    assert stale.data["code"] == "version_conflict"
    assert stale.data["state"]["version"] == 1


@pytest.mark.django_db
def test_discard_goes_back_to_the_published_version(api, manager):
    first = load_preset()
    api.post(PUBLISH, {"config": first, "baseVersion": 0}, format="json")
    changed = load_preset()
    changed["identity"]["siteTitle"] = "Borrador"
    state = save_draft(api, changed, base_version=1).data
    assert state["config"]["identity"]["siteTitle"] == "Borrador"

    discarded = api.post(DISCARD, {"baseVersion": state["version"]}, format="json")
    assert discarded.status_code == 200
    assert discarded.data["hasUnpublishedChanges"] is False
    assert (
        discarded.data["config"]["identity"]["siteTitle"]
        == first["identity"]["siteTitle"]
    )


@pytest.mark.django_db
def test_a_revision_can_be_restored_into_the_draft(api, manager):
    original = load_preset()
    api.post(PUBLISH, {"config": original, "baseVersion": 0}, format="json")
    changed = load_preset()
    changed["identity"]["siteTitle"] = "Segunda"
    api.post(PUBLISH, {"config": changed, "baseVersion": 1}, format="json")

    history = api.get(REVISIONS).data
    assert [entry["version"] for entry in history] == [2, 1]
    first = history[-1]
    detail = api.get(f"{REVISIONS}{first['id']}/").data
    assert (
        detail["config"]["identity"]["siteTitle"] == original["identity"]["siteTitle"]
    )

    restored = api.post(
        f"{REVISIONS}{first['id']}/restore/", {"baseVersion": 2}, format="json"
    )
    assert restored.status_code == 200, restored.data
    assert restored.data["hasUnpublishedChanges"] is True
    # restoring only loads the draft; visitors still see the latest publish
    assert api.get(CONFIG).data["config"]["identity"]["siteTitle"] == "Segunda"


@pytest.mark.django_db
def test_the_public_config_supports_conditional_requests(api, manager):
    api.post(PUBLISH, {"config": load_preset(), "baseVersion": 0}, format="json")
    first = api.get(CONFIG)
    assert first["Cache-Control"] == "no-cache"
    again = api.get(CONFIG, HTTP_IF_NONE_MATCH=first["ETag"])
    assert again.status_code == 304


def png_bytes(size=(40, 20)):
    buffer = io.BytesIO()
    Image.new("RGB", size, (10, 140, 222)).save(buffer, format="PNG")
    return buffer.getvalue()


@pytest.mark.django_db
def test_uploaded_images_are_served_publicly_and_cached_forever(api, manager):
    upload = SimpleUploadedFile("logo.png", png_bytes(), content_type="image/png")
    response = api.post(ASSETS, {"file": upload}, format="multipart")
    assert response.status_code == 201, response.data
    assert response.data["ref"].startswith("asset:")
    assert (response.data["width"], response.data["height"]) == (40, 20)

    api.credentials()  # anonymous visitor
    served = api.get(f"{ASSETS}{response.data['id']}/")
    assert served.status_code == 200
    assert served["Content-Type"] == "image/png"
    assert "immutable" in served["Cache-Control"]
    assert served["X-Content-Type-Options"] == "nosniff"
    assert b"".join(served.streaming_content if served.streaming else [served.content])


@pytest.mark.django_db
def test_identical_uploads_are_stored_once(api, manager):
    raw = png_bytes()
    first = api.post(
        ASSETS, {"file": SimpleUploadedFile("a.png", raw)}, format="multipart"
    )
    second = api.post(
        ASSETS, {"file": SimpleUploadedFile("b.png", raw)}, format="multipart"
    )
    assert first.status_code == 201 and second.status_code == 200
    assert first.data["id"] == second.data["id"]
    assert len(api.get(ASSETS).data) == 1


@pytest.mark.django_db
@pytest.mark.parametrize(
    "name, raw",
    [
        ("notes.png", b"this is not an image"),
        (
            "x.svg",
            b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
        ),
        ("x.svg", b'<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>'),
        ("map.json", b'{"hello": "world"}'),
        ("page.html", b"<html><body>hi</body></html>"),
    ],
)
def test_unsafe_or_unknown_files_are_rejected(api, manager, name, raw):
    response = api.post(
        ASSETS, {"file": SimpleUploadedFile(name, raw)}, format="multipart"
    )
    assert response.status_code == 400, response.data


@pytest.mark.django_db
def test_plain_svgs_and_geojson_maps_are_accepted(api, manager):
    svg = (
        b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">'
        b'<circle r="4"/></svg>'
    )
    geojson = b'{"type": "Polygon", "coordinates": [[[0,0],[1,0],[1,1],[0,0]]]}'
    for name, raw, kind in (
        ("logo.svg", svg, "image"),
        ("map.geojson", geojson, "geojson"),
    ):
        response = api.post(
            ASSETS, {"file": SimpleUploadedFile(name, raw)}, format="multipart"
        )
        assert response.status_code == 201, response.data
        assert response.data["kind"] == kind


@pytest.mark.django_db
def test_uploads_require_a_translator_manager(api, native_admin):
    upload = SimpleUploadedFile("logo.png", png_bytes())
    assert api.post(ASSETS, {"file": upload}, format="multipart").status_code == 403
