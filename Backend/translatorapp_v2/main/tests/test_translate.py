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
from main.models import TranslationPair
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
