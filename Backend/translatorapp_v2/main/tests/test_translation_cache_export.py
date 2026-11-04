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
"""GET /api/translate/cache/: the translation cache the mobile app downloads
for its offline model, in the precedence the website's lookup answers with."""
import gzip
import hashlib
from datetime import datetime, timedelta

import pytest
from django.contrib.auth.models import User
from django.db import connection
from django.test import override_settings
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from fixtures import api_client, create_languages, user_auth  # noqa: F401
from main.models import ImportedFile, ImportedPair, Profile, TranslationPair
from main.serializers import LanguageSerializer
from main.utils import text_key

URL = "/api/translate/cache/"


def _pair(src_lang, dst_lang, src_text, dst_text, **fields):
    """A TranslationPair, validated as correct unless `fields` say otherwise."""
    fields = {"correct": True, "validated": True, **fields}
    return TranslationPair.objects.create(
        src_lang=src_lang,
        dst_lang=dst_lang,
        src_text=src_text,
        dst_text=dst_text,
        **fields,
    )


def _trusted_user():
    user = User.objects.create_user(username="trusted", password="pw")
    Profile.objects.create(
        user=user,
        trusted_feedback=True,
        date_of_birth=datetime.now() - timedelta(days=365 * 20),
    )
    return user


def _file(name, priority, rows, status=ImportedFile.READY):
    """An uploaded CSV with `rows` of (src_lang, dst_lang, src_text, dst_text)."""
    imported = ImportedFile.objects.create(name=name, priority=priority, status=status)
    ImportedPair.objects.bulk_create(
        ImportedPair(
            file=imported,
            src_lang=src_lang,
            dst_lang=dst_lang,
            src_text=src_text,
            dst_text=dst_text,
            src_key=text_key(src_text),
            dst_key=text_key(dst_text),
        )
        for src_lang, dst_lang, src_text, dst_text in rows
    )
    return imported


def _texts(response):
    """(src_text, dst_text) of the exported pairs, in order."""
    assert response.status_code == 200, response.content
    return [(p["src_text"], p["dst_text"]) for p in response.json()["pairs"]]


# --- what is exported, and in which order -------------------------------------


@pytest.mark.django_db
@override_settings(TRANSLATION_REQUIRES_AUTH=False)
def test_only_the_pairs_that_answer_from_the_cache_are_exported(
    api_client, create_languages
):
    _, spanish, rapanui, _ = create_languages
    _pair(spanish, rapanui, "Hola", "Iorana")
    # validated: its dst_text answers, not a correction left on it
    _pair(spanish, rapanui, "Gracias", "Maururu", suggestion="otra cosa")
    # waiting for validation, from a user who is not trusted
    _pair(
        spanish,
        rapanui,
        "Adiós",
        "del modelo",
        suggestion="sin validar",
        correct=None,
        validated=False,
        feedback=False,
    )
    # rejected by a reviewer, even though its author is trusted
    _pair(
        spanish,
        rapanui,
        "Perro",
        "del modelo",
        suggestion="rechazada",
        correct=False,
        feedback=False,
        user=_trusted_user(),
    )

    response = api_client.get(URL)
    assert response.status_code == 200
    assert response.json() == {
        "pairs": [
            {
                "src_lang": "spa_Latn",
                "dst_lang": "rap_Latn",
                "src_text": "Gracias",
                "dst_text": "Maururu",
            },
            {
                "src_lang": "spa_Latn",
                "dst_lang": "rap_Latn",
                "src_text": "Hola",
                "dst_text": "Iorana",
            },
        ]
    }


@pytest.mark.django_db
@override_settings(TRANSLATION_REQUIRES_AUTH=False)
def test_a_trusted_users_correction_is_exported_with_its_suggestion(
    api_client, create_languages
):
    _, spanish, rapanui, _ = create_languages
    _pair(
        spanish,
        rapanui,
        "Hola",
        "del modelo",
        suggestion="de confianza",
        correct=None,
        validated=False,
        feedback=False,
        user=_trusted_user(),
    )
    assert _texts(api_client.get(URL)) == [("Hola", "de confianza")]


@pytest.mark.django_db
@override_settings(TRANSLATION_REQUIRES_AUTH=False)
def test_suggestions_are_newest_first(api_client, create_languages):
    _, spanish, rapanui, _ = create_languages
    newest = _pair(spanish, rapanui, "Hola", "la más nueva")  # lowest id
    older = _pair(spanish, rapanui, "Hola", "antigua")
    same_time = _pair(spanish, rapanui, "Hola", "antigua, id mayor")
    now = timezone.now()
    TranslationPair.objects.filter(pk=newest.pk).update(created_at=now)
    TranslationPair.objects.filter(pk__in=[older.pk, same_time.pk]).update(
        created_at=now - timedelta(days=1)
    )
    assert _texts(api_client.get(URL)) == [
        ("Hola", "la más nueva"),
        ("Hola", "antigua, id mayor"),
        ("Hola", "antigua"),
    ]


@pytest.mark.django_db
@override_settings(TRANSLATION_REQUIRES_AUTH=False)
def test_imported_rows_follow_the_suggestions_in_priority_order(
    api_client, create_languages
):
    _, spanish, rapanui, _ = create_languages
    # created first, but answers after the file with priority 0
    _file("segundo", 1, [(spanish, rapanui, "Uno", "del segundo")])
    _file(
        "primero",
        0,
        [(spanish, rapanui, "Dos", "fila 1"), (rapanui, spanish, "Toru", "fila 2")],
    )
    _file(
        "cargando",
        2,
        [(spanish, rapanui, "Cuatro", "sin terminar")],
        status=ImportedFile.UPLOADING,
    )
    _pair(spanish, rapanui, "Hola", "Iorana")

    response = api_client.get(URL)
    assert _texts(response) == [
        ("Hola", "Iorana"),
        ("Dos", "fila 1"),
        ("Toru", "fila 2"),
        ("Uno", "del segundo"),
    ]
    # each row under its own codes
    assert [(p["src_lang"], p["dst_lang"]) for p in response.json()["pairs"]] == [
        ("spa_Latn", "rap_Latn"),
        ("spa_Latn", "rap_Latn"),
        ("rap_Latn", "spa_Latn"),
        ("spa_Latn", "rap_Latn"),
    ]


@pytest.mark.django_db
@override_settings(TRANSLATION_REQUIRES_AUTH=False)
def test_pairs_without_languages_or_texts_are_left_out(api_client, create_languages):
    _, spanish, rapanui, _ = create_languages
    _pair(spanish, rapanui, "Hola", "Iorana")
    _pair(spanish, None, "Hola", "sin idioma de destino")
    _pair(None, rapanui, "Hola", "sin idioma de origen")
    _pair(spanish, rapanui, "  \n", "sin texto de origen")
    _pair(spanish, rapanui, "Gracias", " ")
    _file(
        "datos",
        0,
        [(spanish, rapanui, "Dos", "\t"), (spanish, rapanui, "Tres", "Toru")],
    )
    assert _texts(api_client.get(URL)) == [("Hola", "Iorana"), ("Tres", "Toru")]


@pytest.mark.django_db
@override_settings(TRANSLATION_REQUIRES_AUTH=False)
def test_the_queries_do_not_grow_with_the_rows(api_client, create_languages):
    """The language codes come in the same query as the rows (no N+1)."""
    english, spanish, rapanui, french = create_languages
    _pair(spanish, rapanui, "Hola", "Iorana")
    _file("datos", 0, [(spanish, rapanui, "Dos", "Rua")])
    api_client.get(URL)  # the access rules are cached from here on

    def queries():
        with CaptureQueriesContext(connection) as captured:
            assert api_client.get(URL).status_code == 200
        return len(captured)

    few = queries()
    langs = [(english, rapanui), (rapanui, french), (french, spanish)] * 10
    for n, (src_lang, dst_lang) in enumerate(langs):
        _pair(src_lang, dst_lang, f"frase {n}", f"traducción {n}")
    _file("más", 1, [(english, french, f"fila {n}", f"ligne {n}") for n in range(30)])
    assert queries() == few


# --- who may download it --------------------------------------------------------


@pytest.mark.django_db
@override_settings(TRANSLATION_REQUIRES_AUTH=False)
def test_anonymous_users_may_download_it_when_translation_is_public(
    api_client, create_languages
):
    _, spanish, rapanui, _ = create_languages
    _pair(spanish, rapanui, "Hola", "Iorana")
    assert _texts(api_client.get(URL)) == [("Hola", "Iorana")]


@pytest.mark.django_db
@override_settings(TRANSLATION_REQUIRES_AUTH=True)
def test_anonymous_users_are_refused_like_translate_when_it_requires_auth(
    api_client, create_languages
):
    english, spanish, _, _ = create_languages
    translate = api_client.post(
        "/api/translate/",
        {
            "src_text": "Hello",
            "src_lang": LanguageSerializer(english).data,
            "dst_lang": LanguageSerializer(spanish).data,
        },
        format="json",
    )
    assert translate.status_code == 401
    assert api_client.get(URL).status_code == 401


@pytest.mark.django_db
@override_settings(TRANSLATION_REQUIRES_AUTH=True)
def test_logged_in_users_may_download_it_when_translation_requires_auth(
    api_client, user_auth, create_languages
):
    _, spanish, rapanui, _ = create_languages
    _pair(spanish, rapanui, "Hola", "Iorana")
    assert _texts(api_client.get(URL)) == [("Hola", "Iorana")]


# --- daily checks and compression -----------------------------------------------


@pytest.mark.django_db
@override_settings(TRANSLATION_REQUIRES_AUTH=False)
def test_the_etag_gives_a_304_until_the_cache_changes(api_client, create_languages):
    _, spanish, rapanui, _ = create_languages
    _pair(spanish, rapanui, "Hola", "Iorana")

    first = api_client.get(URL)
    etag = first["ETag"]
    # strong, from the body
    assert etag == f'"{hashlib.sha256(first.content).hexdigest()}"'
    assert first["Cache-Control"] == "no-cache"

    again = api_client.get(URL, HTTP_IF_NONE_MATCH=etag)
    assert again.status_code == 304
    assert again.content == b""
    assert again["ETag"] == etag
    assert again["Cache-Control"] == "no-cache"
    # the W/ the gzipped response adds still matches
    assert api_client.get(URL, HTTP_IF_NONE_MATCH=f"W/{etag}").status_code == 304

    _pair(spanish, rapanui, "Gracias", "Maururu")
    changed = api_client.get(URL, HTTP_IF_NONE_MATCH=etag)
    assert changed.status_code == 200
    assert changed["ETag"] != etag
    assert len(changed.json()["pairs"]) == 2


@pytest.mark.django_db
@override_settings(TRANSLATION_REQUIRES_AUTH=False)
def test_the_body_is_gzipped_when_asked_for(api_client, create_languages):
    _, spanish, rapanui, _ = create_languages
    for n in range(20):
        _pair(spanish, rapanui, f"frase {n}", f"traducción {n}")

    plain = api_client.get(URL)
    assert plain.status_code == 200
    assert "Content-Encoding" not in plain

    zipped = api_client.get(URL, HTTP_ACCEPT_ENCODING="gzip, deflate, br")
    assert zipped.status_code == 200
    assert zipped["Content-Encoding"] == "gzip"
    assert "Accept-Encoding" in zipped["Vary"]
    assert len(zipped.content) < len(plain.content)
    assert gzip.decompress(zipped.content) == plain.content
    assert len(plain.json()["pairs"]) == 20
    # the same version: gzip only makes the ETag weak
    assert zipped["ETag"] == f"W/{plain['ETag']}"

    not_modified = api_client.get(
        URL, HTTP_ACCEPT_ENCODING="gzip", HTTP_IF_NONE_MATCH=zipped["ETag"]
    )
    assert not_modified.status_code == 304
    assert not_modified.content == b""
