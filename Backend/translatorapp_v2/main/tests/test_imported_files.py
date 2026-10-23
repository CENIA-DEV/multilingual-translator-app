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
"""CSVs uploaded in "Explorar datos": the upload steps, who may use them, and
where their rows rank among the answers of the translation cache."""
import csv
import io
from datetime import datetime, timedelta

import pytest
from django.contrib.auth.models import User
from django.test import override_settings
from fixtures import (  # noqa: F401
    admin_auth,
    api_client,
    create_languages,
    mock_get_prediction,
    native_admin_auth,
    user_auth,
)
from main.models import (
    Dialect,
    ImportedFile,
    ImportedPair,
    Lang,
    Profile,
    Script,
    TranslationPair,
    TranslationRequest,
)
from main.serializers import LanguageSerializer
from rest_framework.test import APIClient

URL = "/api/imported-files/"


def _mapuzungun():
    """arn_raguileo (territory unknown) and two variants with a territory."""
    raguileo = Script.objects.create(code="raguileo", name="Raguileo")
    nagche = Dialect.objects.create(code="nagche", name="Nagche")
    pewenche = Dialect.objects.create(code="pewenche", name="Pewenche")
    variant = lambda code, dialect=None: Lang.objects.create(  # noqa: E731
        code=code, name=code, script=raguileo, dialect=dialect, is_native=True
    )
    return {
        "raguileo": variant("arn_raguileo"),
        "nagche": variant("arn_raguileo_nagche", nagche),
        "pewenche": variant("arn_raguileo_pewenche", pewenche),
    }


def _upload(client, rows, name="datos.csv", finish=True):
    response = client.post(URL, {"name": name, "filename": name}, format="json")
    assert response.status_code == 201, response.data
    file_id = response.data["id"]
    response = client.post(f"{URL}{file_id}/rows/", {"rows": rows}, format="json")
    assert response.status_code == 200, response.data
    if finish:
        assert client.post(f"{URL}{file_id}/finish/").status_code == 200
    return ImportedFile.objects.get(pk=file_id)


def _translate(text, src_lang, dst_lang):
    response = APIClient().post(
        "/api/translate/",
        {
            "src_text": text,
            "src_lang": LanguageSerializer(src_lang).data,
            "dst_lang": LanguageSerializer(dst_lang).data,
        },
        format="json",
    )
    assert response.status_code == 200, response.data
    return response.data


def _validated(src_lang, dst_lang, src_text, dst_text):
    return TranslationPair.objects.create(
        src_text=src_text,
        dst_text=dst_text,
        src_lang=src_lang,
        dst_lang=dst_lang,
        correct=True,
        validated=True,
    )


@pytest.fixture
def model_answers(mock_get_prediction):
    mock_get_prediction.side_effect = None
    mock_get_prediction.return_value = ("respuesta del modelo", "NativeModel", "V1")
    return mock_get_prediction


# --- who may use it ---------------------------------------------------------


@pytest.mark.django_db
def test_native_admin_may_not_list_files(api_client, native_admin_auth):
    assert api_client.get(URL).status_code == 403
    assert api_client.post(URL, {"name": "x"}, format="json").status_code == 403


@pytest.mark.django_db
def test_user_may_not_list_files(api_client, user_auth):
    assert api_client.get(URL).status_code == 403


@pytest.mark.django_db
def test_anonymous_may_not_list_files(api_client):
    assert api_client.get(URL).status_code in (401, 403)


@pytest.mark.django_db
def test_staff_without_profile_may_list_files(api_client):
    user = User.objects.create_user(username="staff", password="pw", is_staff=True)
    api_client.force_authenticate(user)
    assert api_client.get(URL).status_code == 200


# --- the upload steps ---------------------------------------------------------


@pytest.mark.django_db
def test_upload_stores_rows_and_skips_the_unusable(
    api_client, admin_auth, create_languages
):
    english, spanish, rapanui, _ = create_languages
    imported = _upload(
        api_client,
        [
            ["spa_Latn", "rap_Latn", "Hola", "Iorana"],
            ["spa_Latn", "rap_Latn", "  Gracias ", " Maururu "],
            ["spa_Latn", "eng_Latn", "Hola", "Hello"],
            ["", "rap_Latn", "ignored", "language"],  # a code mapped to "ignore"
            ["xxx_Latn", "rap_Latn", "unknown", "code"],
            ["spa_Latn", "rap_Latn", "", "empty"],
            ["spa_Latn", "spa_Latn", "same", "language"],
            ["spa_Latn", "rap_Latn", "x" * 10001, "too long"],
            "not a row",
        ],
    )
    assert imported.status == ImportedFile.READY
    assert imported.row_count == 3
    assert imported.skipped_count == 6
    assert imported.uploaded_by == admin_auth
    assert sorted(imported.lang_pairs, key=lambda p: p["dst"]) == [
        {"src": "spa_Latn", "dst": "eng_Latn", "rows": 1},
        {"src": "spa_Latn", "dst": "rap_Latn", "rows": 2},
    ]
    stored = ImportedPair.objects.get(src_text="Gracias")
    assert stored.dst_text == "Maururu"  # trimmed

    listed = api_client.get(URL).data
    assert [f["id"] for f in listed] == [imported.id]
    assert listed[0]["row_count"] == 3


@pytest.mark.django_db
def test_rows_are_refused_once_finished_and_batches_are_bounded(
    api_client, admin_auth, create_languages
):
    imported = _upload(api_client, [["spa_Latn", "rap_Latn", "Hola", "Iorana"]])
    response = api_client.post(
        f"{URL}{imported.id}/rows/",
        {"rows": [["spa_Latn", "rap_Latn", "Chao", "Ka oho"]]},
        format="json",
    )
    assert response.status_code == 400

    pending = _upload(api_client, [], finish=False)
    response = api_client.post(
        f"{URL}{pending.id}/rows/", {"rows": [["a"]] * 5001}, format="json"
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_long_texts_are_stored_and_found(
    api_client, admin_auth, create_languages, model_answers
):
    _, spanish, rapanui, _ = create_languages
    # beyond what a btree index entry may hold, in few words (the translator
    # caps the words of a request)
    long_text = " ".join(["palabra" * 400] * 3)
    _upload(api_client, [["spa_Latn", "rap_Latn", long_text, "kupu"]])
    assert _translate(long_text, spanish, rapanui)["dst_text"] == "kupu"


@pytest.mark.django_db
def test_rename_and_delete(api_client, admin_auth, create_languages):
    imported = _upload(api_client, [["spa_Latn", "rap_Latn", "Hola", "Iorana"]])
    response = api_client.patch(
        f"{URL}{imported.id}/", {"name": "Diccionario", "row_count": 99}, format="json"
    )
    assert response.status_code == 200
    imported.refresh_from_db()
    assert (imported.name, imported.row_count) == ("Diccionario", 1)

    assert api_client.delete(f"{URL}{imported.id}/").status_code == 204
    assert not ImportedPair.objects.exists()


@pytest.mark.django_db
def test_pairs_lists_the_rows_in_file_order(api_client, admin_auth, create_languages):
    rows = [["spa_Latn", "rap_Latn", f"texto {i}", f"kupu {i}"] for i in range(25)]
    imported = _upload(api_client, rows)
    data = api_client.get(f"{URL}{imported.id}/pairs/").data
    assert data["count"] == 25
    assert data["results"][0] == {
        "id": data["results"][0]["id"],
        "src_lang": "spa_Latn",
        "dst_lang": "rap_Latn",
        "src_text": "texto 0",
        "dst_text": "kupu 0",
    }
    assert len(api_client.get(f"{URL}{imported.id}/pairs/?page=2").data["results"]) == 5


@pytest.mark.django_db
def test_new_files_come_last_and_reorder_sets_priority(
    api_client, admin_auth, create_languages
):
    first = _upload(api_client, [], name="a")
    second = _upload(api_client, [], name="b")
    third = _upload(api_client, [], name="c")
    assert [f["id"] for f in api_client.get(URL).data] == [first.id, second.id, third.id]

    response = api_client.post(
        f"{URL}reorder/", {"ids": [third.id, first.id]}, format="json"
    )
    assert response.status_code == 200
    # the one left out keeps its place after those listed
    assert [f["id"] for f in response.data] == [third.id, first.id, second.id]

    for bad in ([third.id, third.id], [999999], "x"):
        response = api_client.post(f"{URL}reorder/", {"ids": bad}, format="json")
        assert response.status_code == 400


# --- where the rows rank in the translation cache ----------------------------


@pytest.mark.django_db
@override_settings(TRANSLATION_REQUIRES_AUTH=False)
def test_rows_answer_both_directions_ignoring_case_and_spaces(
    api_client, admin_auth, create_languages, model_answers
):
    english, spanish, rapanui, _ = create_languages
    _upload(api_client, [["spa_Latn", "rap_Latn", "Buenos días", "Iorana koe"]])

    assert _translate("  buenos   DÍAS ", spanish, rapanui)["dst_text"] == "Iorana koe"
    logged = TranslationRequest.objects.latest("id")
    assert (logged.from_cache, logged.model_name) == (True, "csv_import")
    assert _translate("iorana koe", rapanui, spanish)["dst_text"] == "Buenos días"
    # only between its own two languages
    _translate("Buenos días", spanish, english)
    model_answers.assert_called_once()


@pytest.mark.django_db
@override_settings(TRANSLATION_REQUIRES_AUTH=False)
def test_unfinished_files_do_not_answer(
    api_client, admin_auth, create_languages, model_answers
):
    _, spanish, rapanui, _ = create_languages
    _upload(api_client, [["spa_Latn", "rap_Latn", "Hola", "Iorana"]], finish=False)
    assert _translate("Hola", spanish, rapanui)["dst_text"] == "respuesta del modelo"


@pytest.mark.django_db
@override_settings(TRANSLATION_REQUIRES_AUTH=False)
def test_file_priority_decides_duplicates(api_client, admin_auth, create_languages):
    _, spanish, rapanui, _ = create_languages
    first = _upload(
        api_client,
        [
            ["spa_Latn", "rap_Latn", "Hola", "uno"],
            ["spa_Latn", "rap_Latn", "Hola", "uno bis"],  # same file: first row wins
        ],
    )
    second = _upload(api_client, [["spa_Latn", "rap_Latn", "Hola", "dos"]])
    assert _translate("Hola", spanish, rapanui)["dst_text"] == "uno"

    api_client.post(f"{URL}reorder/", {"ids": [second.id, first.id]}, format="json")
    assert _translate("Hola", spanish, rapanui)["dst_text"] == "dos"

    api_client.delete(f"{URL}{second.id}/")
    assert _translate("Hola", spanish, rapanui)["dst_text"] == "uno"


@pytest.mark.django_db
@override_settings(TRANSLATION_REQUIRES_AUTH=False)
def test_suggestions_answer_before_rows(api_client, admin_auth, create_languages):
    _, spanish, rapanui, _ = create_languages
    _upload(api_client, [["spa_Latn", "rap_Latn", "Hola", "del archivo"]])
    _validated(spanish, rapanui, "Hola", "validada")
    assert _translate("Hola", spanish, rapanui)["dst_text"] == "validada"


@pytest.mark.django_db
@override_settings(TRANSLATION_REQUIRES_AUTH=False)
def test_trusted_users_suggestions_answer_before_rows(
    api_client, admin_auth, create_languages
):
    _, spanish, rapanui, _ = create_languages
    _upload(api_client, [["spa_Latn", "rap_Latn", "Hola", "del archivo"]])
    trusted = User.objects.create_user(username="trusted", password="pw")
    Profile.objects.create(
        user=trusted,
        trusted_feedback=True,
        date_of_birth=datetime.now() - timedelta(days=365 * 20),
    )
    TranslationPair.objects.create(
        src_text="Hola",
        dst_text="del modelo",
        suggestion="de confianza",
        src_lang=spanish,
        dst_lang=rapanui,
        feedback=False,
        user=trusted,
    )
    assert _translate("Hola", spanish, rapanui)["dst_text"] == "de confianza"


@pytest.mark.django_db
@override_settings(TRANSLATION_REQUIRES_AUTH=False)
def test_variant_tiers(api_client, admin_auth, create_languages, model_answers):
    """For arn_raguileo_nagche: its suggestions, then its CSV rows, then the
    suggestions with the territory unknown (arn_raguileo), then those rows."""
    _, spanish, _, _ = create_languages
    arn = _mapuzungun()
    nagche = arn["nagche"]

    _upload(api_client, [["spa_Latn", "arn_raguileo", "hola", "csv sin territorio"]])
    assert _translate("hola", spanish, nagche)["dst_text"] == "csv sin territorio"

    _validated(spanish, arn["raguileo"], "hola", "sugerencia sin territorio")
    assert _translate("hola", spanish, nagche)["dst_text"] == "sugerencia sin territorio"

    _upload(
        api_client,
        [["spa_Latn", "arn_raguileo_nagche", "hola", "csv nagche"]],
        name="nagche.csv",
    )
    assert _translate("hola", spanish, nagche)["dst_text"] == "csv nagche"
    # the other territories still get the suggestion with the territory unknown
    assert (
        _translate("hola", spanish, arn["pewenche"])["dst_text"]
        == "sugerencia sin territorio"
    )
    # and the reverse direction ranks the same way
    assert _translate("csv nagche", nagche, spanish)["dst_text"] == "hola"

    _validated(nagche, spanish, "sugerencia nagche", "hola")
    assert _translate("hola", spanish, nagche)["dst_text"] == "sugerencia nagche"
    model_answers.assert_not_called()


@pytest.mark.django_db
def test_download_writes_the_stored_rows_with_the_mapped_codes(
    api_client, admin_auth, create_languages
):
    imported = _upload(
        api_client,
        [
            ["spa_Latn", "rap_Latn", "Hola, amigo", "Iorana"],
            ["rap_Latn", "spa_Latn", 'Dijo "sí"\nluego', "Ka oho"],
            ["", "rap_Latn", "ignored", "row"],
        ],
        name="Diccionario ñandú",
    )
    response = api_client.get(f"{URL}{imported.id}/download/")
    assert response.status_code == 200
    assert response["Content-Type"].startswith("text/csv")
    assert "attachment" in response["Content-Disposition"]
    body = b"".join(response.streaming_content).decode("utf-8")
    assert body.startswith("﻿")
    assert list(csv.reader(io.StringIO(body.lstrip("﻿")))) == [
        ["src_text", "tgt_text", "src_lang", "tgt_lang"],
        ["Hola, amigo", "Iorana", "spa_Latn", "rap_Latn"],
        ['Dijo "sí"\nluego', "Ka oho", "rap_Latn", "spa_Latn"],
    ]


@pytest.mark.django_db
def test_download_is_for_the_technical_team(
    api_client, native_admin_auth, create_languages
):
    imported = ImportedFile.objects.create(name="x", status=ImportedFile.READY)
    assert api_client.get(f"{URL}{imported.id}/download/").status_code == 403
