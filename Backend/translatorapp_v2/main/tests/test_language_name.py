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
"""Tests for editing a language (name, code, script, dialect) through the API."""

import pytest
from django.urls import reverse
from fixtures import admin_auth, api_client, user_auth  # noqa: F401
from main.models import Dialect, Lang, Script, TranslationPair
from main.serializers import LanguageSerializer


def list_url():
    return reverse("language-list")


def detail_url(lang):
    return reverse("language-detail", kwargs={"pk": lang.id})


# --- Serializer -------------------------------------------------------------


@pytest.mark.django_db
def test_create_sets_name_and_reuses_script_by_code():
    Script.objects.create(code="Latn", name="Latin")

    serializer = LanguageSerializer(
        data={
            "code": "aas",
            "name": "Aasax",
            # A different name for an already-known script code must not blow
            # up on the unique constraint.
            "script": {"code": "Latn", "name": "Latino"},
        }
    )
    assert serializer.is_valid(), serializer.errors
    lang = serializer.save()

    assert lang.name == "Aasax"
    assert Script.objects.filter(code="Latn").count() == 1
    # Latn is shared by most of the catalogue, so linking to it must not
    # rename it for every other language.
    assert lang.script.name == "Latin"


@pytest.mark.django_db
def test_language_payload_cannot_rename_a_shared_script():
    script = Script.objects.create(code="Latn", name="Latin")
    other = Lang.objects.create(code="rap", name="Rapa Nui", script=script)
    lang = Lang.objects.create(code="cku", name="Ckunza", script=script)

    serializer = LanguageSerializer(
        lang,
        data={"name": "Kunza", "script": {"code": "Latn", "name": "Latino"}},
        partial=True,
    )
    assert serializer.is_valid(), serializer.errors
    serializer.save()

    other.refresh_from_db()
    script.refresh_from_db()
    assert script.name == "Latin"
    assert other.script.name == "Latin"


@pytest.mark.django_db
def test_partial_update_changes_name():
    lang = Lang.objects.create(code="cku", name="Nombre viejo")

    serializer = LanguageSerializer(lang, data={"name": "Ckunza"}, partial=True)
    assert serializer.is_valid(), serializer.errors
    serializer.save()

    lang.refresh_from_db()
    assert lang.name == "Ckunza"


@pytest.mark.django_db
def test_partial_update_accepts_nested_script_and_dialect():
    lang = Lang.objects.create(
        code="arn",
        name="Nombre viejo",
        script=Script.objects.create(code="Latn", name="Latin"),
    )

    serializer = LanguageSerializer(
        lang,
        data={
            "name": "Mapuzungun",
            "script": {"code": "a0", "name": "Azümchefe"},
            "dialect": {"code": "n", "name": "Nguluche"},
        },
        partial=True,
    )
    assert serializer.is_valid(), serializer.errors
    serializer.save()

    lang.refresh_from_db()
    assert lang.name == "Mapuzungun"
    assert lang.script.code == "a0"
    assert lang.dialect.code == "n"
    assert Dialect.objects.filter(code="n").count() == 1


@pytest.mark.django_db
def test_name_is_trimmed_and_cannot_be_blank():
    lang = Lang.objects.create(code="rap", name="Rapa Nui")

    padded = LanguageSerializer(lang, data={"name": "  Rapanui  "}, partial=True)
    assert padded.is_valid(), padded.errors
    assert padded.save().name == "Rapanui"

    blank = LanguageSerializer(lang, data={"name": "   "}, partial=True)
    assert not blank.is_valid()
    assert "name" in blank.errors


# --- API: rename and list freshness -----------------------------------------


@pytest.mark.django_db
def test_rename_requires_admin(api_client, user_auth):  # noqa: F811
    lang = Lang.objects.create(code="cku", name="Nombre viejo")

    res = api_client.patch(detail_url(lang), {"name": "Ckunza"}, format="json")
    assert res.status_code in (401, 403)

    lang.refresh_from_db()
    assert lang.name == "Nombre viejo"


@pytest.mark.django_db
def test_admin_can_rename_and_list_reflects_it(api_client, admin_auth):  # noqa: F811
    lang = Lang.objects.create(code="cku", name="Nombre viejo")

    res = api_client.patch(detail_url(lang), {"name": "Ckunza"}, format="json")
    assert res.status_code == 200, res.data
    assert res.data["name"] == "Ckunza"

    listed = api_client.get(list_url())
    assert [(item["code"], item["name"]) for item in listed.data] == [
        ("cku", "Ckunza")
    ]


@pytest.mark.django_db
def test_list_reflects_a_rename_made_after_an_earlier_list(
    api_client, admin_auth  # noqa: F811
):
    """The unfiltered list must not serve a cached pre-rename name.

    `LanguageViewSet.queryset` is one queryset instance shared by the whole
    process; serializing it directly caches its rows until the worker
    restarts, which hid every rename from the site.
    """
    lang = Lang.objects.create(code="cku", name="Nombre viejo")

    first = api_client.get(list_url())
    assert [item["name"] for item in first.data] == ["Nombre viejo"]

    api_client.patch(detail_url(lang), {"name": "Ckunza"}, format="json")

    second = api_client.get(list_url())
    assert [item["name"] for item in second.data] == ["Ckunza"]


@pytest.mark.django_db
def test_list_reflects_a_newly_created_language(api_client):  # noqa: F811
    """Same cache, seen from the other side: new rows must appear too."""
    Lang.objects.create(code="cku", name="Ckunza")

    assert len(api_client.get(list_url()).data) == 1

    Lang.objects.create(code="rap", name="Rapa Nui")
    assert len(api_client.get(list_url()).data) == 2


@pytest.mark.django_db
def test_list_keeps_its_response_shape(api_client):  # noqa: F811
    """The list stays a plain array of {id, script, code, dialect, name}."""
    Lang.objects.create(
        code="rap",
        name="Rapa Nui",
        script=Script.objects.create(code="Latn", name="Latin"),
    )

    res = api_client.get(list_url())
    assert res.status_code == 200
    assert isinstance(res.data, list)
    assert set(res.data[0].keys()) == {"id", "script", "code", "dialect", "name"}
    assert res.data[0]["script"] == {"code": "Latn", "name": "Latin"}
    assert res.data[0]["dialect"] is None


@pytest.mark.django_db
def test_recreating_a_deleted_translator_refreshes_the_name(
    api_client, admin_auth  # noqa: F811
):
    """Re-creating under an existing code is rejected; updating the row works."""
    lang = Lang.objects.create(
        code="cku",
        name="Nombre viejo",
        script=Script.objects.create(code="Latn", name="Latin"),
    )

    # Re-creating under the same ISO code is rejected as a duplicate...
    created = api_client.post(
        list_url(),
        {
            "code": "cku",
            "name": "Ckunza",
            "script": {"code": "Latn", "name": "Latin"},
        },
        format="json",
    )
    assert created.status_code == 400

    # ...so the client updates the surviving row instead.
    updated = api_client.patch(
        detail_url(lang),
        {
            "code": "cku",
            "name": "Ckunza",
            "script": {"code": "Latn", "name": "Latin"},
        },
        format="json",
    )
    assert updated.status_code == 200, updated.data

    lang.refresh_from_db()
    assert lang.name == "Ckunza"
    assert Lang.objects.filter(code="cku").count() == 1


# --- API: editing code, script and dialect in one PATCH ---------------------


@pytest.fixture
def cku():
    script = Script.objects.create(code="Latn", name="Latin")
    return Lang.objects.create(code="cku", name="Ckunza", script=script)


@pytest.mark.django_db
def test_sets_script_and_dialect(api_client, admin_auth, cku):  # noqa: F811
    res = api_client.patch(
        detail_url(cku),
        {
            "name": "Ckunza",
            "code": "cku",
            "script": {"code": "Cyrl", "name": "Cyrillic"},
            "dialect": {"code": "norte", "name": "norte"},
        },
        format="json",
    )
    assert res.status_code == 200, res.data

    cku.refresh_from_db()
    assert cku.script.code == "Cyrl"
    assert cku.dialect.code == "norte"


@pytest.mark.django_db
def test_null_clears_script_and_dialect(api_client, admin_auth, cku):  # noqa: F811
    cku.dialect = Dialect.objects.create(code="norte", name="norte")
    cku.save()

    res = api_client.patch(
        detail_url(cku),
        {"name": "Ckunza", "code": "cku", "script": None, "dialect": None},
        format="json",
    )
    assert res.status_code == 200, res.data

    cku.refresh_from_db()
    assert cku.script is None
    assert cku.dialect is None
    # Clearing the link must not delete the shared lookup rows.
    assert Script.objects.filter(code="Latn").exists()
    assert Dialect.objects.filter(code="norte").exists()


@pytest.mark.django_db
def test_changing_the_code_keeps_every_relation(
    api_client, admin_auth, cku  # noqa: F811
):
    """Relations are FKs by id, so renaming the code must not orphan them."""
    spanish = Lang.objects.create(code="spa_Latn", name="Castellano")
    pair = TranslationPair.objects.create(
        src_lang=spanish, dst_lang=cku, src_text="hola", dst_text="x"
    )

    res = api_client.patch(detail_url(cku), {"code": "ckz"}, format="json")
    assert res.status_code == 200, res.data

    cku.refresh_from_db()
    pair.refresh_from_db()
    assert cku.code == "ckz"
    assert pair.dst_lang_id == cku.id


@pytest.mark.django_db
def test_code_collision_is_rejected(api_client, admin_auth, cku):  # noqa: F811
    Lang.objects.create(code="rap", name="Rapa Nui")

    res = api_client.patch(detail_url(cku), {"code": "rap"}, format="json")
    assert res.status_code == 400
    assert "code" in res.data

    cku.refresh_from_db()
    assert cku.code == "cku"


@pytest.mark.django_db
def test_editing_other_fields_leaves_the_code_alone(
    api_client, admin_auth, cku  # noqa: F811
):
    res = api_client.patch(detail_url(cku), {"name": "Kunza"}, format="json")
    assert res.status_code == 200, res.data

    cku.refresh_from_db()
    assert cku.code == "cku"
    assert cku.name == "Kunza"
