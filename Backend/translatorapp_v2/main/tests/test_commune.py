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
"""The comuna a user picked in "Ayúdame a decidir" is kept with their
translations and their feedback; the territory and alphabet are those of the
language variant stored next to it."""
import pytest
from django.test import override_settings
from fixtures import api_client, create_languages, mock_get_prediction  # noqa: F401
from main.models import GeneralSuggestion, TranslationPair, TranslationRequest


def pair_payload(**extra):
    return {
        "src_text": "Hola",
        "dst_text": "Iorana",
        "suggestion": "Iorana koe",
        "src_lang": {"code": "spa_Latn"},
        "dst_lang": {"code": "rap_Latn"},
        "model_name": "mock",
        "model_version": "1",
        "is_uncertain": False,
        **extra,
    }


@pytest.mark.django_db
def test_negative_feedback_keeps_the_commune(api_client, create_languages):
    response = api_client.post("/api/suggestions/reject_translation/", pair_payload(commune="Carahue"), format="json")
    assert response.status_code == 201
    assert TranslationPair.objects.get().commune == "Carahue"


@pytest.mark.django_db
def test_positive_feedback_keeps_the_commune(api_client, create_languages):
    response = api_client.post("/api/suggestions/accept_translation/", pair_payload(commune="Osorno"), format="json")
    assert response.status_code == 201
    assert TranslationPair.objects.get().commune == "Osorno"


@pytest.mark.django_db
def test_feedback_without_a_commune_still_works(api_client, create_languages):
    response = api_client.post("/api/suggestions/reject_translation/", pair_payload(), format="json")
    assert response.status_code == 201
    assert TranslationPair.objects.get().commune is None


@pytest.mark.django_db
def test_a_comment_keeps_its_languages_and_commune(api_client, create_languages):
    response = api_client.post(
        "/api/suggestions/add_suggestion/",
        {"comment": "Muy útil", "src_lang": {"code": "spa_Latn"}, "dst_lang": {"code": "rap_Latn"}, "commune": "Temuco"},
        format="json",
    )
    assert response.status_code == 201
    comment = GeneralSuggestion.objects.get()
    assert (comment.src_lang.code, comment.dst_lang.code, comment.commune) == ("spa_Latn", "rap_Latn", "Temuco")


@pytest.mark.django_db
def test_a_comment_without_languages_still_works(api_client, create_languages):
    response = api_client.post("/api/suggestions/add_suggestion/", {"comment": "Hola"}, format="json")
    assert response.status_code == 201
    comment = GeneralSuggestion.objects.get()
    assert comment.src_lang is None and comment.commune is None


@pytest.mark.django_db
@override_settings(TRANSLATION_REQUIRES_AUTH=False)
@pytest.mark.parametrize("sent, stored", [("  Puerto   Saavedra ", "Puerto Saavedra"), (None, None), ("", None)])
def test_a_translation_request_logs_the_commune(api_client, create_languages, mock_get_prediction, sent, stored):
    payload = {"src_text": "Hola", "src_lang": {"code": "spa_Latn"}, "dst_lang": {"code": "rap_Latn"}}
    if sent is not None:
        payload["commune"] = sent
    response = api_client.post("/api/translate/", payload, format="json")
    assert response.status_code == 200
    assert TranslationRequest.objects.get().commune == stored
