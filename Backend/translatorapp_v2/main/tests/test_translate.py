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
from fixtures import api_client, create_languages, mock_get_prediction, user_auth
from main.models import TranslationPair
from main.serializers import LanguageSerializer
from unittest.mock import call, ANY

# 1. translate - Success (No Cache Hit)
@pytest.mark.django_db
def test_translate_spanish_to_rapanui(
    api_client, user_auth, create_languages, mock_get_prediction
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
        
@pytest.mark.django_db
def test_translate_rapanui_to_spanish(api_client, user_auth, create_languages, mock_get_prediction):
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
    
@pytest.mark.django_db
def test_translate_french_to_rapanui(api_client, user_auth, create_languages, mock_get_prediction):
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

    
@pytest.mark.django_db
def test_translate_rapanui_to_french(api_client, user_auth, create_languages, mock_get_prediction):
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

@pytest.mark.django_db
def test_translate_french_to_english(api_client, user_auth, create_languages, mock_get_prediction):
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

# 2. translate - Success (Cache Hit)
@pytest.mark.django_db
def test_translate_success_cache_hit(
    api_client, create_languages, mock_get_prediction
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
    print(response.data)
    assert response.status_code == 200
    assert response.data["dst_text"] == "Hola"
    mock_get_prediction.assert_not_called()  # translate function not called -> cache hit


# 3. translate - Same Language
@pytest.mark.django_db
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


# 4. translate - Invalid Data
@pytest.mark.django_db
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