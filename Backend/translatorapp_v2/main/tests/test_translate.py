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
from unittest.mock import patch

import pytest
from django.test import override_settings
from fixtures import api_client, create_languages, mock_get_prediction, user_auth
from main.models import Dialect, Lang, Script, TranslationPair
from main.serializers import LanguageSerializer
from unittest.mock import call, ANY

# 1. translate - base2native - Success (No Cache Hit)
@pytest.mark.django_db
@override_settings(TRANSLATION_REQUIRES_AUTH=False)
def test_translate_spanish_to_rapanui_no_auth_required(
    api_client, create_languages, mock_get_prediction
):
    
    english, spanish, rapanui, french = create_languages

    url = "/api/translate/"
    data = {
        "src_text": "Hola",
        "src_lang": LanguageSerializer(spanish).data,
        "dst_lang": LanguageSerializer(rapanui).data,
    }

    response = api_client.post(url, data, format="json")
    print(response.data)
    assert response.status_code == 200
    assert response.data["src_text"] == "Hola"
    assert response.data["dst_text"] == "Iorana"
    mock_get_prediction.assert_called_once_with("Hola", spanish.code, rapanui.code, deployment=ANY)
        
# 2. translate - native2base - Success (No Cache Hit)
@pytest.mark.django_db
@override_settings(TRANSLATION_REQUIRES_AUTH=False)
def test_translate_rapanui_to_spanish_no_auth_required(api_client, create_languages, mock_get_prediction):
    english, spanish, rapanui, french = create_languages

    url = "/api/translate/"
    data = {
        "src_text": "Iorana",
        "src_lang": LanguageSerializer(rapanui).data,
        "dst_lang": LanguageSerializer(spanish).data,
    }   

    response = api_client.post(url, data, format="json")
    assert response.status_code == 200
    assert response.data["dst_text"] == "Hola"
    mock_get_prediction.assert_called_once_with("Iorana", rapanui.code, spanish.code, deployment=ANY)
    
# 3. translate - any2native - Success (No Cache Hit)
@pytest.mark.django_db
@override_settings(TRANSLATION_REQUIRES_AUTH=False)
def test_translate_french_to_rapanui_no_auth_required(api_client, create_languages, mock_get_prediction):
    english, spanish, rapanui, french = create_languages
    
    url = "/api/translate/"
    data = {
        "src_text": "Bonjour",
        "src_lang": LanguageSerializer(french).data,
        "dst_lang": LanguageSerializer(rapanui).data,
    }
    
    response = api_client.post(url, data, format="json")
    assert response.status_code == 200
    assert response.data["dst_text"] == "Iorana"
    # two calls because of the two deployments
    mock_get_prediction.assert_has_calls([
        call("Bonjour", src_lang=french.code, dst_lang=spanish.code, deployment=ANY),
        call("Hola", src_lang=spanish.code, dst_lang=rapanui.code, deployment=ANY)
    ])

# 4. translate - native2any - Success (No Cache Hit)
@pytest.mark.django_db
@override_settings(TRANSLATION_REQUIRES_AUTH=False)
def test_translate_rapanui_to_french_no_auth_required(api_client, create_languages, mock_get_prediction):
    english, spanish, rapanui, french = create_languages

    url = "/api/translate/"
    data = {
        "src_text": "Iorana",
        "src_lang": LanguageSerializer(rapanui).data,
        "dst_lang": LanguageSerializer(french).data,
    }

    response = api_client.post(url, data, format="json")
    assert response.status_code == 200
    assert response.data["dst_text"] == "Bonjour"
    # two calls because of the two deployments
    mock_get_prediction.assert_has_calls([
        call("Iorana", src_lang=rapanui.code, dst_lang=spanish.code, deployment=ANY),
        call("Hola", src_lang=spanish.code, dst_lang=french.code, deployment=ANY)
    ])


# 5. translate - any2any - Success (No Cache Hit)
@pytest.mark.django_db
@override_settings(TRANSLATION_REQUIRES_AUTH=False)
def test_translate_french_to_english_no_auth_required(api_client, create_languages, mock_get_prediction):
    english, spanish, rapanui, french = create_languages
    
    url = "/api/translate/"
    data = {
        "src_text": "Bonjour",
        "src_lang": LanguageSerializer(french).data,
        "dst_lang": LanguageSerializer(english).data,
    }

    response = api_client.post(url, data, format="json")
    assert response.status_code == 200
    assert response.data["dst_text"] == "Hello"
    mock_get_prediction.assert_called_once_with("Bonjour", french.code, english.code, deployment=ANY)

# 6. translate - Success (Cache Hit)
@pytest.mark.django_db
@override_settings(TRANSLATION_REQUIRES_AUTH=True)
def test_translate_success_cache_hit_user_auth_required(
    api_client, user_auth, create_languages, mock_get_prediction
):
    # assert no user auth needed
    english, spanish, rapanui, french = create_languages
    TranslationPair.objects.create(
        src_text="Hello",
        dst_text="Hola",
        src_lang=english,
        dst_lang=spanish,
        correct=True,
        validated=True,
    )

    url = "/api/translate/"
    data = {
        "src_text": "hello",  # try lower case
        "src_lang": LanguageSerializer(english).data,
        "dst_lang": LanguageSerializer(spanish).data,
    }

    response = api_client.post(url, data, format="json")
    assert response.status_code == 200
    assert response.data["dst_text"] == "Hola"
    mock_get_prediction.assert_not_called()  # translate function not called -> cache hit

# 7. translate - Fail (Cache Hit - Unauthorized)
@pytest.mark.django_db
@override_settings(TRANSLATION_REQUIRES_AUTH=True)
def test_translate_success_cache_hit_auth_required(
    api_client, create_languages, mock_get_prediction
):
    english, spanish, rapanui, french = create_languages
    url = "/api/translate/"
    data = {
        "src_text": "hello",  # try lower case
        "src_lang": LanguageSerializer(english).data,
        "dst_lang": LanguageSerializer(spanish).data,
    }
    response = api_client.post(url, data, format="json")
    assert response.status_code == 401 #unauthorized
    


# 8. translate - Same Language
@pytest.mark.django_db
@override_settings(TRANSLATION_REQUIRES_AUTH=True)
def test_translate_same_language(api_client, user_auth, create_languages):
    english, _, _, _ = create_languages

    url = "/api/translate/"
    data = {
        "src_text": "Hello",
        "src_lang": LanguageSerializer(english).data,
        "dst_lang": LanguageSerializer(english).data,
    }

    response = api_client.post(url, data, format="json")
    print(response.data)
    assert response.status_code == 200
    assert (
        response.data["dst_text"] == "Hello"
    )  # Source and destination text should be the same


# 9. translate - Invalid Data
@pytest.mark.django_db
@override_settings(TRANSLATION_REQUIRES_AUTH=True)
def test_translate_invalid_data(api_client, user_auth, create_languages):
    _, spanish, _, _ = create_languages
    url = "/api/translate/"
    data = {
        "src_text": "Hello",
        "dst_lang": LanguageSerializer(spanish).data,  # Missing src_lang
    }

    response = api_client.post(url, data, format="json")
    print(response.data)
    assert response.status_code == 400
    assert "src_lang" in response.data


# Additional tests for permission behavior

# 10. translate - Anonymous User - No Auth Required
@pytest.mark.django_db
@override_settings(TRANSLATION_REQUIRES_AUTH=False)
def test_translate_anonymous_user_when_auth_not_required(api_client, create_languages, mock_get_prediction):
    """Test that anonymous users can translate when TRANSLATION_REQUIRES_AUTH=False."""
    english, spanish, _, _ = create_languages

    url = "/api/translate/"
    data = {
        "src_text": "Hello",
        "src_lang": LanguageSerializer(english).data,
        "dst_lang": LanguageSerializer(spanish).data,
    }

    response = api_client.post(url, data, format="json")
    assert response.status_code == 200
    assert response.data["dst_text"] == "Hola"
    mock_get_prediction.assert_called_once()


# 11. translate - Anonymous User - Auth Required
@pytest.mark.django_db
@override_settings(TRANSLATION_REQUIRES_AUTH=True)
def test_translate_anonymous_user_when_auth_required(api_client, create_languages):
    """Test that anonymous users cannot translate when TRANSLATION_REQUIRES_AUTH=True."""
    english, spanish, _, _ = create_languages

    url = "/api/translate/"
    data = {
        "src_text": "Hello",
        "src_lang": LanguageSerializer(english).data,
        "dst_lang": LanguageSerializer(spanish).data,
    }

    response = api_client.post(url, data, format="json")
    assert response.status_code == 401  # Unauthorized


# 12. translate - Authenticated User - Auth Required
@pytest.mark.django_db
@override_settings(TRANSLATION_REQUIRES_AUTH=True)
def test_translate_authenticated_user_when_auth_required(api_client, user_auth, create_languages, mock_get_prediction):
    """Test that authenticated users can translate when TRANSLATION_REQUIRES_AUTH=True."""
    english, spanish, _, _ = create_languages

    url = "/api/translate/"
    data = {
        "src_text": "Hello",
        "src_lang": LanguageSerializer(english).data,
        "dst_lang": LanguageSerializer(spanish).data,
    }

    response = api_client.post(url, data, format="json")
    assert response.status_code == 200
    assert response.data["dst_text"] == "Hola"
    mock_get_prediction.assert_called_once()
    
#13. translate - success - Max Words - Border Case
@pytest.mark.django_db
@override_settings(TRANSLATION_REQUIRES_AUTH=False)
@override_settings(MAX_WORDS_TRANSLATION=10)
def test_translate_max_words(api_client, user_auth, create_languages, mock_get_prediction):
    """Test that the translation service handles the maximum number of words correctly."""
    english, spanish, _, _ = create_languages

    url = "/api/translate/"
    data = {
        "src_text": "Hello \n" * 10,
        "src_lang": LanguageSerializer(english).data,
        "dst_lang": LanguageSerializer(spanish).data,
    }

    response = api_client.post(url, data, format="json")
    assert response.status_code == 200
    assert response.data["dst_text"] == "Hola"
    

#14. translate - Success - Max Words - Border Case - 1
@pytest.mark.django_db
@override_settings(TRANSLATION_REQUIRES_AUTH=False)
@override_settings(MAX_WORDS_TRANSLATION=10)
def test_translate_max_words_border_case_1(api_client, user_auth, create_languages, mock_get_prediction):
    """Test that the translation service handles the maximum number of words correctly."""
    english, spanish, _, _ = create_languages
    url = "/api/translate/"
    data = {
        "src_text": "Hello " * 9,
        "src_lang": LanguageSerializer(english).data,
        "dst_lang": LanguageSerializer(spanish).data,
    }

    response = api_client.post(url, data, format="json")
    assert response.status_code == 200
    assert response.data["dst_text"] == "Hola"
    
#15. translate - fail - Max Words - Border Case + 1
@pytest.mark.django_db
@override_settings(TRANSLATION_REQUIRES_AUTH=False)
@override_settings(MAX_WORDS_TRANSLATION=10)
def test_translate_max_words_fail(api_client, user_auth, create_languages, mock_get_prediction):
    """Test that the translation service handles the maximum number of words correctly."""
    english, spanish, _, _ = create_languages
    url = "/api/translate/"
    data = {
        "src_text": "Hello " * 11,
        "src_lang": LanguageSerializer(english).data,
        "dst_lang": LanguageSerializer(spanish).data,
    }
    
    response = api_client.post(url, data, format="json")
    assert response.status_code == 400
    assert "src_text" in response.data # check that the error is in the src_text field


#16. translate - fail - Max Words - Border Case + Newlines
@pytest.mark.django_db
@override_settings(TRANSLATION_REQUIRES_AUTH=False)
@override_settings(MAX_WORDS_TRANSLATION=10)
def test_translate_max_words_fail_newlines(api_client, user_auth, create_languages, mock_get_prediction):
    """Test that the translation service handles the maximum number of words correctly."""
    english, spanish, _, _ = create_languages
    url = "/api/translate/"
    data = {
        "src_text": "Hello\n" * 11,
        "src_lang": LanguageSerializer(english).data,
        "dst_lang": LanguageSerializer(spanish).data,
    }
    
    response = api_client.post(url, data, format="json")
    assert response.status_code == 400
    assert "src_text" in response.data # check that the error is in the src_text field


# 17-20. translate - native_only: the native model takes every step
NATIVE = "http://native.test/v2/models/native-model/infer"
RAW = "http://raw.test/v2/models/raw-model/infer"


@pytest.fixture
def deployments(monkeypatch):
    """Distinct URLs for the two models, so a test can tell which one ran."""
    from django.conf import settings

    app = settings.APP_SETTINGS
    monkeypatch.setattr(app, "inference_model_url", "http://native.test")
    monkeypatch.setattr(app, "inference_model_name", "native-model")
    monkeypatch.setattr(app, "raw_inference_model_url", "http://raw.test")
    monkeypatch.setattr(app, "raw_inference_model_name", "raw-model")


def _translate(api_client, src, dst, text, **extra):
    return api_client.post(
        "/api/translate/",
        {
            "src_text": text,
            "src_lang": LanguageSerializer(src).data,
            "dst_lang": LanguageSerializer(dst).data,
            **extra,
        },
        format="json",
    )


@pytest.mark.django_db
@override_settings(TRANSLATION_REQUIRES_AUTH=False)
def test_translate_any2any_uses_raw_model_by_default(
    api_client, create_languages, mock_get_prediction, deployments
):
    english, _, _, french = create_languages

    response = _translate(api_client, french, english, "Bonjour")

    assert response.status_code == 200
    mock_get_prediction.assert_called_once_with(
        "Bonjour", french.code, english.code, deployment=RAW
    )


@pytest.mark.django_db
@override_settings(TRANSLATION_REQUIRES_AUTH=False)
@pytest.mark.parametrize("value", [True, "true", "1"])
def test_translate_native_only_any2any_uses_native_model(
    api_client, create_languages, mock_get_prediction, deployments, value
):
    english, _, _, french = create_languages

    response = _translate(api_client, french, english, "Bonjour", native_only=value)

    assert response.status_code == 200
    assert response.data["dst_text"] == "Hello"
    mock_get_prediction.assert_called_once_with(
        "Bonjour", french.code, english.code, deployment=NATIVE
    )


@pytest.mark.django_db
@override_settings(TRANSLATION_REQUIRES_AUTH=False)
def test_translate_native_only_native2any_pivots_on_native_model(
    api_client, create_languages, mock_get_prediction, deployments
):
    _, spanish, rapanui, french = create_languages

    response = _translate(api_client, rapanui, french, "Iorana", native_only=True)

    assert response.status_code == 200
    assert response.data["dst_text"] == "Bonjour"
    assert mock_get_prediction.call_args_list == [
        call("Iorana", src_lang=rapanui.code, dst_lang=spanish.code, deployment=NATIVE),
        call("Hola", src_lang=spanish.code, dst_lang=french.code, deployment=NATIVE),
    ]


@pytest.mark.django_db
@override_settings(TRANSLATION_REQUIRES_AUTH=False)
@pytest.mark.parametrize("value", [False, "false", "no", 0, None])
def test_translate_native_only_needs_an_explicit_true(
    api_client, create_languages, mock_get_prediction, deployments, value
):
    english, _, _, french = create_languages

    response = _translate(api_client, french, english, "Bonjour", native_only=value)

    assert response.status_code == 200
    mock_get_prediction.assert_called_once_with(
        "Bonjour", french.code, english.code, deployment=RAW
    )


# 21-23. translate - cache: a saved pair only answers its own two languages
@pytest.mark.django_db
@override_settings(TRANSLATION_REQUIRES_AUTH=False)
def test_translate_cached_pair_does_not_answer_a_third_language(
    api_client, create_languages, mock_get_prediction
):
    english, spanish, rapanui, _ = create_languages
    TranslationPair.objects.create(
        src_text="Hola",
        dst_text="Iorana",
        src_lang=spanish,
        dst_lang=rapanui,
        correct=True,
        validated=True,
    )

    response = _translate(api_client, spanish, english, "Hola")

    assert response.status_code == 200
    # The Spanish text used to come back as the "translation" into English.
    assert response.data["dst_text"] == "Hello"
    assert response.data["dst_lang"]["code"] == english.code
    mock_get_prediction.assert_called_once_with(
        "Hola", spanish.code, english.code, deployment=ANY
    )


@pytest.mark.django_db
@override_settings(TRANSLATION_REQUIRES_AUTH=False)
def test_translate_cached_pair_still_answers_the_reverse_direction(
    api_client, create_languages, mock_get_prediction
):
    _, spanish, rapanui, _ = create_languages
    TranslationPair.objects.create(
        src_text="Hola",
        dst_text="Iorana",
        src_lang=spanish,
        dst_lang=rapanui,
        correct=True,
        validated=True,
    )

    response = _translate(api_client, rapanui, spanish, "iorana")

    assert response.status_code == 200
    assert response.data["dst_text"] == "Hola"
    assert response.data["dst_lang"]["code"] == spanish.code
    mock_get_prediction.assert_not_called()


@pytest.mark.django_db
@override_settings(TRANSLATION_REQUIRES_AUTH=False)
def test_translate_cache_skips_a_pair_for_another_language(
    api_client, create_languages, mock_get_prediction
):
    english, spanish, rapanui, _ = create_languages
    TranslationPair.objects.create(
        src_text="Hola",
        dst_text="Hello there",
        src_lang=spanish,
        dst_lang=english,
        correct=True,
        validated=True,
    )
    # Newer, so it is looked at first, but it is a Rapa Nui pair.
    TranslationPair.objects.create(
        src_text="Hola",
        dst_text="Iorana",
        src_lang=spanish,
        dst_lang=rapanui,
        correct=True,
        validated=True,
    )

    response = _translate(api_client, spanish, english, "Hola")

    assert response.status_code == 200
    assert response.data["dst_text"] == "Hello there"
    mock_get_prediction.assert_not_called()


def _mapuzugun():
    """arn_raguileo (territory unknown) and three variants with a territory."""
    raguileo = Script.objects.create(code="raguileo", name="Raguileo")
    azumchefe = Script.objects.create(code="azumchefe", name="Azümchefe")
    nagche = Dialect.objects.create(code="nagche", name="Nagche")
    pewenche = Dialect.objects.create(code="pewenche", name="Pewenche")
    variant = lambda code, script, dialect=None: Lang.objects.create(  # noqa: E731
        code=code, name=code, script=script, dialect=dialect, is_native=True
    )
    return {
        "raguileo": variant("arn_raguileo", raguileo),
        "raguileo_nagche": variant("arn_raguileo_nagche", raguileo, nagche),
        "raguileo_pewenche": variant("arn_raguileo_pewenche", raguileo, pewenche),
        "azumchefe_nagche": variant("arn_azumchefe_nagche", azumchefe, nagche),
    }


def _model_answers(mock_get_prediction):
    mock_get_prediction.side_effect = None
    mock_get_prediction.return_value = ("respuesta del modelo", "NativeModel", "V1")


def _validated(src_lang, dst_lang, src_text, dst_text):
    return TranslationPair.objects.create(
        src_text=src_text, dst_text=dst_text, src_lang=src_lang,
        dst_lang=dst_lang, correct=True, validated=True,
    )


def _translate_data(api_client, text, src_lang, dst_lang):
    response = api_client.post("/api/translate/", {
        "src_text": text,
        "src_lang": LanguageSerializer(src_lang).data,
        "dst_lang": LanguageSerializer(dst_lang).data,
    }, format="json")
    assert response.status_code == 200, response.data
    return response.data


# 24. translate - cache hit of each variant, both directions: never the answer
# of another variant nor of another language (nor the input back)
@pytest.mark.django_db
@override_settings(TRANSLATION_REQUIRES_AUTH=False)
def test_translate_cache_hit_per_variant(api_client, create_languages, mock_get_prediction):
    english, spanish, _, _ = create_languages
    arn = _mapuzugun()
    variants = [arn["raguileo_nagche"], arn["raguileo_pewenche"], arn["azumchefe_nagche"]]
    for i, variant in enumerate(variants):
        _validated(spanish, variant, "Hola", f"mari mari {i}")
    _validated(spanish, english, "hola", "hello")  # newest, another language

    for i, variant in enumerate(variants):
        assert _translate_data(api_client, "hola", spanish, variant)["dst_text"] == f"mari mari {i}"
        assert _translate_data(api_client, f"Mari Mari {i}", variant, spanish)["dst_text"] == "Hola"
    mock_get_prediction.assert_not_called()


# 25. translate - a validated pair of another territory or alphabet is no hit
@pytest.mark.django_db
@override_settings(TRANSLATION_REQUIRES_AUTH=False)
def test_translate_no_cache_hit_from_other_variant(api_client, create_languages, mock_get_prediction):
    _, spanish, _, _ = create_languages
    arn = _mapuzugun()
    _model_answers(mock_get_prediction)
    _validated(spanish, arn["raguileo_nagche"], "hola", "mari mari")

    for other in (arn["raguileo_pewenche"], arn["azumchefe_nagche"], arn["raguileo"]):
        _translate_data(api_client, "hola", spanish, other)
    assert mock_get_prediction.call_count == 3


# 26. translate - a pair with the territory unknown applies to every territory
# of its alphabet, and the newest matching pair answers
@pytest.mark.django_db
@override_settings(TRANSLATION_REQUIRES_AUTH=False)
def test_translate_cache_hit_territory_unknown(api_client, create_languages, mock_get_prediction):
    _, spanish, _, _ = create_languages
    arn = _mapuzugun()
    _model_answers(mock_get_prediction)
    _validated(spanish, arn["raguileo_nagche"], "hola", "mari mari nagche")
    _validated(spanish, arn["raguileo"], "hola", "mari mari")  # newer

    for variant in (arn["raguileo_nagche"], arn["raguileo_pewenche"], arn["raguileo"]):
        data = _translate_data(api_client, "hola", spanish, variant)
        assert data["dst_text"] == "mari mari"
        assert data["dst_lang"]["code"] == variant.code  # the requested one
        assert _translate_data(api_client, "mari mari", variant, spanish)["dst_text"] == "hola"
    mock_get_prediction.assert_not_called()

    _validated(arn["raguileo_nagche"], spanish, "mari mari kom", "hola")  # newest
    assert _translate_data(api_client, "hola", spanish, arn["raguileo_nagche"])["dst_text"] == "mari mari kom"
    assert _translate_data(api_client, "hola", spanish, arn["raguileo_pewenche"])["dst_text"] == "mari mari"
    # another alphabet: no hit
    _translate_data(api_client, "hola", spanish, arn["azumchefe_nagche"])
    mock_get_prediction.assert_called_once()
