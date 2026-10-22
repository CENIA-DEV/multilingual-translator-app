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
"""Feedback saved before the territory selector, the administrators' editing of
a pair's variant, the "Visibilidad" rules and the word labels."""
import importlib

import pytest
from customization.models import TranslatorCustomization
from django.apps import apps
from fixtures import (  # noqa: F401
    admin_auth,
    api_client,
    create_languages,
    mock_get_prediction,
    native_admin_auth,
    user_auth,
)
from main.models import Dialect, Lang, Script, TranslationPair, Word

unknown_territory = importlib.import_module("main.migrations.0061_unknown_territory_codes")


@pytest.fixture
def mapuzungun(create_languages):
    latin = Script.objects.get(code="Latn")
    azumchefe = Script.objects.create(code="azumchefe", name="Azümchefe")
    raguileo = Script.objects.create(code="raguileo", name="Raguileo")
    nguluche = Dialect.objects.create(code="n", name="Nguluche")
    nagche = Dialect.objects.create(code="nagche", name="Nagche")
    return {
        "spa": Lang.objects.get(code="spa_Latn"),
        "rap": Lang.objects.get(code="rap_Latn"),
        "base": Lang.objects.create(code="arn_Latn", script=latin, name="Mapuzungun", is_native=True),
        "legacy": Lang.objects.create(code="arn_a0_n", script=azumchefe, dialect=nguluche, name="Nguluche Azümchefe", is_native=True),
        "nagche": Lang.objects.create(code="arn_raguileo_nagche", script=raguileo, dialect=nagche, name="Nagche Raguileo", is_native=True),
    }


def pair(src, dst, **extra):
    return TranslationPair.objects.create(src_text="Hola", dst_text="Mari mari", src_lang=src, dst_lang=dst, **extra)


def publish_access(**rules):
    public = {"level": "public", "roles": []}
    access = {
        "translatorPage": public, "translation": public, "tts": public, "separateGenders": public,
        "asr": public, "wordInformation": public, "maintenance": False, "maxWordsTranslation": 150,
    }
    access.update(rules)
    TranslatorCustomization.objects.update_or_create(pk=1, defaults={"published": {"access": access}, "published_version": 1})


# ----------------------------------------------- feedback from before selectors
@pytest.mark.django_db
def test_feedback_from_before_the_selector_keeps_its_alphabet_with_no_territory(mapuzungun):
    feedback = pair(mapuzungun["spa"], mapuzungun["legacy"], feedback=False)
    unknown_territory.forward(apps, None)
    feedback.refresh_from_db()
    assert feedback.dst_lang.code == "arn_azumchefe"
    assert feedback.dst_lang.dialect is None and feedback.dst_lang.script.code == "azumchefe"
    assert not Dialect.objects.filter(code="n").exists()  # the placeholder territory


@pytest.mark.django_db
def test_when_the_new_code_exists_the_feedback_moves_to_it(mapuzungun):
    target = Lang.objects.create(code="arn_azumchefe", script=Script.objects.get(code="azumchefe"), name="Azümchefe")
    feedback = pair(mapuzungun["spa"], mapuzungun["legacy"])
    unknown_territory.forward(apps, None)
    feedback.refresh_from_db()
    assert feedback.dst_lang_id == target.id
    assert not Lang.objects.filter(code="arn_a0_n").exists()


@pytest.mark.django_db
def test_explore_data_lists_every_code_of_the_family(api_client, native_admin_auth, mapuzungun):
    pair(mapuzungun["spa"], mapuzungun["legacy"])  # old code
    pair(mapuzungun["nagche"], mapuzungun["spa"])  # new code, other direction
    pair(mapuzungun["spa"], mapuzungun["rap"])  # another language
    response = api_client.get("/api/suggestions/", {"lang_prefix": "arn", "page_size": 50})
    assert response.status_code == 200
    rows = response.json().get("results", response.json())
    codes = sorted({r["src_lang"]["code"] for r in rows} | {r["dst_lang"]["code"] for r in rows})
    assert codes == ["arn_a0_n", "arn_raguileo_nagche", "spa_Latn"]


# --------------------------------------- administrators relabel a pair's variant
@pytest.mark.django_db
@pytest.mark.parametrize("reverse", [False, True])
def test_an_administrator_sets_the_territory_and_commune(api_client, native_admin_auth, mapuzungun, reverse):
    legacy, spa = mapuzungun["legacy"], mapuzungun["spa"]
    feedback = pair(legacy, spa) if reverse else pair(spa, legacy)
    response = api_client.patch(
        f"/api/suggestions/{feedback.id}/relabel/", {"lang": "arn_raguileo_nagche", "commune": " Purén "}, format="json"
    )
    assert response.status_code == 200
    feedback.refresh_from_db()
    native = feedback.src_lang if reverse else feedback.dst_lang
    other = feedback.dst_lang if reverse else feedback.src_lang
    assert (native.code, other.code, feedback.commune) == ("arn_raguileo_nagche", "spa_Latn", "Purén")


@pytest.mark.django_db
def test_relabel_only_within_the_same_language(api_client, native_admin_auth, mapuzungun):
    feedback = pair(mapuzungun["spa"], mapuzungun["rap"])
    response = api_client.patch(f"/api/suggestions/{feedback.id}/relabel/", {"lang": "arn_raguileo_nagche"}, format="json")
    assert response.status_code == 400


@pytest.mark.django_db
def test_relabel_is_for_administrators(api_client, user_auth, mapuzungun):
    feedback = pair(mapuzungun["spa"], mapuzungun["legacy"])
    response = api_client.patch(f"/api/suggestions/{feedback.id}/relabel/", {"lang": "arn_raguileo_nagche"}, format="json")
    assert response.status_code in (401, 403)


# ------------------------------------------------------------- visibility rules
def translate(client, text="Hola"):
    return client.post(
        "/api/translate/",
        {"src_text": text, "src_lang": {"code": "spa_Latn"}, "dst_lang": {"code": "rap_Latn"}},
        format="json",
    )


@pytest.mark.django_db
def test_without_published_rules_translation_is_public(api_client, create_languages, mock_get_prediction):
    assert translate(api_client).status_code == 200


@pytest.mark.django_db
def test_a_login_rule_blocks_anonymous_visitors(api_client, create_languages, mock_get_prediction):
    publish_access(translation={"level": "login", "roles": []})
    assert translate(api_client).status_code in (401, 403)


@pytest.mark.django_db
def test_a_login_rule_lets_users_in(api_client, user_auth, create_languages, mock_get_prediction):
    publish_access(translation={"level": "login", "roles": []})
    assert translate(api_client).status_code == 200


@pytest.mark.django_db
def test_the_page_rule_also_guards_its_features(api_client, create_languages, mock_get_prediction):
    publish_access(translatorPage={"level": "login", "roles": []})
    assert translate(api_client).status_code in (401, 403)


@pytest.mark.django_db
def test_a_roles_rule_checks_the_role(api_client, user_auth, create_languages, mock_get_prediction):
    publish_access(translation={"level": "roles", "roles": ["NativeAdmin"]})
    assert translate(api_client).status_code == 403


@pytest.mark.django_db
def test_a_roles_rule_lets_the_role_in(api_client, native_admin_auth, create_languages, mock_get_prediction):
    publish_access(translation={"level": "roles", "roles": ["NativeAdmin"]})
    assert translate(api_client).status_code == 200


@pytest.mark.django_db
def test_top_tier_admins_always_may(api_client, admin_auth, create_languages, mock_get_prediction):
    publish_access(translation={"level": "roles", "roles": ["Native"]})
    assert translate(api_client).status_code == 200


@pytest.mark.django_db
def test_the_word_limit_comes_from_the_rules(api_client, create_languages, mock_get_prediction):
    publish_access(maxWordsTranslation=3)
    assert translate(api_client, "uno dos tres").status_code == 200
    assert translate(api_client, "uno dos tres cuatro").status_code == 400


@pytest.mark.django_db
def test_a_gendered_voice_needs_its_rule(api_client, create_languages):
    publish_access(separateGenders={"level": "login", "roles": []})
    response = api_client.post(
        "/api/text-to-speech/",
        {"text": "Hola", "language": "rap_Latn", "gender": "male", "model_name": "m", "model_version": "1"},
        format="json",
    )
    assert response.status_code == 403


@pytest.mark.django_db
def test_the_config_reports_the_rules_in_force(api_client):
    publish_access(asr={"level": "login", "roles": []}, maxWordsTranslation=40)
    body = api_client.get("/api/customization/config/").json()
    assert body["access"]["asr"]["level"] == "login" and body["access"]["maxWordsTranslation"] == 40


@pytest.mark.django_db
def test_rejected_rules_fall_back_to_defaults(api_client):
    TranslatorCustomization.objects.create(
        pk=1, published={"access": {"translation": {"level": "everyone"}, "maxWordsTranslation": -5}}, published_version=1
    )
    body = api_client.get("/api/customization/config/").json()
    assert body["access"]["translation"]["level"] == "public" and body["access"]["maxWordsTranslation"] == 150


# ------------------------------------------------------------------ word labels
@pytest.mark.django_db
def test_a_word_is_labelled_with_territories_and_alphabets(api_client, native_admin_auth, mapuzungun):
    Dialect.objects.create(code="lafkenche", name="Lafkenche")
    response = api_client.post(
        "/api/words/", {"text": "ruka", "territories": ["nagche", "lafkenche"], "writings": ["raguileo"]}, format="json"
    )
    assert response.status_code == 201
    word = Word.objects.get(text="ruka")
    assert sorted(word.dialects.values_list("code", flat=True)) == ["lafkenche", "nagche"]
    response = api_client.patch(f"/api/words/{word.id}/", {"territories": ["nagche"], "writings": []}, format="json")
    assert response.status_code == 200
    assert response.json()["territories"] == ["nagche"] and response.json()["writings"] == []


@pytest.mark.django_db
def test_an_unknown_label_is_refused(api_client, native_admin_auth, mapuzungun):
    response = api_client.post("/api/words/", {"text": "ruka", "territories": ["atlantis"]}, format="json")
    assert response.status_code == 400


# ------------------------------------- explanations follow the text's variant
@pytest.fixture
def labelled_words(mapuzungun):
    azumchefe, raguileo = Script.objects.get(code="azumchefe"), Script.objects.get(code="raguileo")
    pewenche = Dialect.objects.create(code="pewenche", name="Pewenche")
    Lang.objects.create(code="arn_raguileo_pewenche", script=raguileo, dialect=pewenche, name="Pewenche Raguileo")
    Lang.objects.create(code="arn_azumchefe_pewenche", script=azumchefe, dialect=pewenche, name="Pewenche Azümchefe")
    Word.objects.create(text="ruka")  # no labels: every variant
    Word.objects.create(text="kawellu").dialects.set([Dialect.objects.get(code="nagche")])
    pewen = Word.objects.create(text="pewen")
    pewen.dialects.set([pewenche])
    pewen.scripts.set([raguileo])


def analyzed(client, lang=None):
    body = {"sentence": "ruka kawellu pewen"}
    if lang:
        body["lang"] = lang
    response = client.post("/api/words/analyze_sentence/", body, format="json")
    assert response.status_code == 200
    return sorted(w["text"] for w in response.json()["results"])


@pytest.mark.django_db
@pytest.mark.parametrize(
    "lang, words",
    [
        ("arn_raguileo_nagche", ["kawellu", "ruka"]),  # nagche words, and unlabelled ones
        ("arn_raguileo_pewenche", ["pewen", "ruka"]),
        ("arn_azumchefe_pewenche", ["ruka"]),  # pewen is pewenche, but written in raguileo
        ("spa_Latn", ["kawellu", "pewen", "ruka"]),  # a language without variants: no filter
        (None, ["kawellu", "pewen", "ruka"]),  # as before, when no language is sent
    ],
)
def test_explanations_follow_the_variant(api_client, labelled_words, lang, words):
    assert analyzed(api_client, lang) == words
