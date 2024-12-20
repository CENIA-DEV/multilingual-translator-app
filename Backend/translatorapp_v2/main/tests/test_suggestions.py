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
import pytest
from fixtures import *
from main.models import TranslationPair
from test_users import create_user
from urllib.parse import urlencode

def create_suggestion(src_text, dst_text, src_lang, dst_lang, user, feedback, model_name, model_version, suggestion=None):
    suggestion = TranslationPair.objects.create(   
        src_text=src_text,
        dst_text=dst_text,
        src_lang=src_lang,
        dst_lang=dst_lang,
        user=user,
        suggestion=dst_text if suggestion is None else suggestion,
        model_name=model_name,
        model_version=model_version,
        feedback=feedback,
    )
    return suggestion
    

# 1. accept_translation - Success
@pytest.mark.django_db
def test_accept_translation_success(api_client, user_auth, create_languages):
   spanish, english, _, _ = create_languages
   data = {
       "src_text": "Hello",
       "dst_text": "Hola",
       "src_lang": {"code": english.code},
       "dst_lang": {"code": spanish.code},
       "model_name": "test_model",
       "model_version": "1.0"
   }
   url = "/api/suggestions/accept_translation/"
   response = api_client.post(url, data, format="json")
   print(response.data)
   assert response.status_code == 201
   assert TranslationPair.objects.count() == 1
   created_suggestion = TranslationPair.objects.first()
   assert created_suggestion.src_text == "Hello"
   assert created_suggestion.dst_text == "Hola"
   assert created_suggestion.src_lang == english
   assert created_suggestion.dst_lang == spanish
   assert created_suggestion.user == user_auth
   assert created_suggestion.model_name == "test_model"
   assert created_suggestion.model_version == "1.0"
   assert created_suggestion.feedback == True
   assert created_suggestion.suggestion == created_suggestion.dst_text # suggestion text is equal to dst_text
   assert created_suggestion.correct == None # correct is not yet set
   assert created_suggestion.validated == False # default false not yet validated
   
   

# 2. reject_translation - Feedback is False - Success
@pytest.mark.django_db
def test_reject_translation_success(api_client, admin_auth, create_languages):
    english, spanish, _, _ = create_languages
    data = {
        "src_text": "Hello",
        "dst_text": "Como estas?",
        "src_lang": {"code": english.code},
        "dst_lang": {"code": spanish.code}, 
        "suggestion": "Hola",
        "model_name": "test_model",
        "model_version": "1.0"
    }
    url = "/api/suggestions/reject_translation/"
    response = api_client.post(url, data, format="json")
    assert response.status_code == 201
    assert TranslationPair.objects.count() == 1
    created_suggestion = TranslationPair.objects.first()
    assert created_suggestion.src_text == "Hello"
    assert created_suggestion.dst_text == "Como estas?"
    assert created_suggestion.src_lang == english
    assert created_suggestion.dst_lang == spanish
    assert created_suggestion.user == admin_auth
    assert created_suggestion.model_name == "test_model"
    assert created_suggestion.model_version == "1.0"
    assert created_suggestion.feedback == False
    assert created_suggestion.suggestion == "Hola"
    assert created_suggestion.correct == None # correct is not yet set
    assert created_suggestion.validated == False # default false not yet validated
    
@pytest.mark.django_db
def test_reject_translation_native_admin_success(api_client, native_admin_auth, create_languages):
    english, spanish, _, _ = create_languages
    data = {
        "src_text": "Hello",
        "dst_text": "Como estas?",
        "src_lang": {"code": english.code},
        "dst_lang": {"code": spanish.code}, 
        "suggestion": "Hola",
        "model_name": "test_model",
        "model_version": "1.0"
    }
    url = "/api/suggestions/reject_translation/"
    response = api_client.post(url, data, format="json")
    assert response.status_code == 201
    assert TranslationPair.objects.count() == 2
    incorrect_suggestion = TranslationPair.objects.first()
    correct_suggestion = TranslationPair.objects.last()
    
    assert incorrect_suggestion.user == native_admin_auth
    assert incorrect_suggestion.validated_by == native_admin_auth
    assert incorrect_suggestion.feedback == False
    assert incorrect_suggestion.suggestion == "Hola"
    assert incorrect_suggestion.dst_text == "Como estas?"
    assert incorrect_suggestion.correct == False
    assert incorrect_suggestion.validated == True
    
    assert correct_suggestion.user == native_admin_auth
    assert correct_suggestion.validated_by == native_admin_auth
    assert correct_suggestion.feedback == False
    assert correct_suggestion.suggestion == correct_suggestion.dst_text # store the correct translation
    assert correct_suggestion.correct == True
    assert correct_suggestion.validated == True 

@pytest.mark.django_db
def test_accept_translation_native_admin_success(api_client, native_admin_auth, create_languages):
    english, spanish, _, _ = create_languages
    data = {
        "src_text": "Hello",
        "dst_text": "Hola",
        "src_lang": {"code": english.code},
        "dst_lang": {"code": spanish.code},
        "model_name": "test_model",
        "model_version": "1.0"
    }
    url = "/api/suggestions/accept_translation/"
    response = api_client.post(url, data, format="json")
    assert response.status_code == 201
    assert TranslationPair.objects.count() == 1
    created_suggestion = TranslationPair.objects.first()
    assert created_suggestion.user == native_admin_auth
    assert created_suggestion.validated_by == native_admin_auth
    assert created_suggestion.feedback == True
    assert created_suggestion.suggestion == created_suggestion.dst_text
    # native admin automatically validates suggestion
    assert created_suggestion.correct == True 
    assert created_suggestion.validated == True 

@pytest.mark.django_db
def test_reject_translation_anonymous_success(api_client, create_languages):
    english, spanish, _, _ = create_languages
    data = {
        "src_text": "Hello",
        "dst_text": "Como estas?",
        "src_lang": {"code": english.code},
        "dst_lang": {"code": spanish.code}, 
        "suggestion": "Hola",
        "model_name": "test_model",
        "model_version": "1.0"
    }
    url = "/api/suggestions/reject_translation/"
    response = api_client.post(url, data, format="json")
    assert response.status_code == 201
    assert TranslationPair.objects.count() == 1
    created_suggestion = TranslationPair.objects.first()
    assert created_suggestion.user == None
    assert created_suggestion.feedback == False
    assert created_suggestion.suggestion == "Hola"
    # not yet validated
    assert created_suggestion.correct == None 
    assert created_suggestion.validated == False 
    
@pytest.mark.django_db
def test_accept_translation_anonymous_success(api_client, create_languages):
    english, spanish, _, _ = create_languages
    data = {
        "src_text": "Hello",
        "dst_text": "Hola",
        "src_lang": {"code": english.code},
        "dst_lang": {"code": spanish.code},
        "model_name": "test_model",
        "model_version": "1.0"
    }
    url = "/api/suggestions/accept_translation/"
    response = api_client.post(url, data, format="json")
    assert response.status_code == 201
    assert TranslationPair.objects.count() == 1
    created_suggestion = TranslationPair.objects.first()
    assert created_suggestion.user == None
    assert created_suggestion.feedback == True
    assert created_suggestion.suggestion == created_suggestion.dst_text
    # not yet validated
    assert created_suggestion.correct == None 
    assert created_suggestion.validated == False 
    
#3. accept_suggestion - Positive feedback - Success
@pytest.mark.django_db
def test_accept_suggestion_positive_feedback_success(api_client, admin_auth, create_languages):
    english, spanish, _, _ = create_languages
    user = create_user(username="testuser", password="testpassword", role=Profile.USER)
    suggestion = create_suggestion("HEllo", "HOla", english, spanish, user, True, "test_model", "1.0")
    url = f"/api/suggestions/{suggestion.id}/accept_suggestion/"
    response = api_client.patch(url, {"src_text": "Hello", "updated_suggestion": "Hola"}, format="json")
    assert response.status_code == 200  
    assert TranslationPair.objects.count() == 1
    created_suggestion = TranslationPair.objects.first()
    assert created_suggestion.correct == True
    assert created_suggestion.validated == True
    assert created_suggestion.src_text == "Hello" # update src text
    assert created_suggestion.suggestion == "HOla" # keep original suggestion
    assert created_suggestion.dst_text == "Hola" # update to new suggestion
    assert created_suggestion.user == user # original user is not changed
    assert created_suggestion.feedback == True
    assert created_suggestion.model_name == "test_model"
    assert created_suggestion.model_version == "1.0"
    assert created_suggestion.validated_by == admin_auth # validated by admin

#4. accept_suggestion - Negative feedback - Success
@pytest.mark.django_db
def test_accept_suggestion_negative_feedback_success(api_client, admin_auth, create_languages):
    english, spanish, _, _ = create_languages
    user = create_user(username="testuser", password="testpassword", role=Profile.USER)
    suggestion = create_suggestion("HEllo", "Como estas?", english, spanish, user, False, "test_model", "1.0", suggestion="Hola.")
    url = f"/api/suggestions/{suggestion.id}/accept_suggestion/"
    response = api_client.patch(url, {"src_text": "Hello", "updated_suggestion": "Hola"}, format="json")
    assert response.status_code == 200
    first_suggestion = TranslationPair.objects.first()  
    assert TranslationPair.objects.count() == 2 # new suggestion created
    assert first_suggestion.correct == False
    assert first_suggestion.validated == True
    assert first_suggestion.suggestion == "Hola." #keep original suggestion
    assert first_suggestion.dst_text == "Como estas?"
    assert first_suggestion.user == user
    assert first_suggestion.feedback == False
    assert first_suggestion.model_name == "test_model"
    assert first_suggestion.model_version == "1.0"
    
    new_suggestion = TranslationPair.objects.last()
    assert new_suggestion.correct == True
    assert new_suggestion.src_text == "Hello" # update src text
    assert new_suggestion.validated == True
    assert new_suggestion.dst_text == "Hola"
    assert new_suggestion.feedback == None # no feedback, it is a new suggestion
    assert new_suggestion.model_name == "test_model"
    assert new_suggestion.model_version == "1.0"
    assert new_suggestion.validated_by == admin_auth # validated by admin
    assert new_suggestion.user == user # validated by user
    assert new_suggestion.suggestion == "Hola."
 
# 5. reject_suggestion_negative_feedback - Success
@pytest.mark.django_db
def test_reject_suggestion_negative_feedback_success(api_client, admin_auth, create_languages):
    english, spanish, _, _ = create_languages
    user = create_user(username="testuser", password="testpassword", role=Profile.USER)
    suggestion = create_suggestion("Hello", "Hola", english, spanish, user, False, "test_model", "1.0", suggestion="Como estas?")
    url = f"/api/suggestions/{suggestion.id}/reject_suggestion/"
    response = api_client.patch(url, format="json")
    assert response.status_code == 200
    assert TranslationPair.objects.count() == 1
    created_suggestion = TranslationPair.objects.first()
    assert created_suggestion.correct == False
    assert created_suggestion.validated == True
    assert created_suggestion.validated_by == admin_auth
    assert created_suggestion.dst_text == "Hola" # keep original translation
    assert created_suggestion.feedback == False
    assert created_suggestion.suggestion == "Como estas?" # keep original suggestion
    
# 6. reject_suggestion_positive_feedback - Success
@pytest.mark.django_db  
def test_reject_suggestion_positive_feedback_success(api_client, admin_auth, create_languages):
    english, spanish, _, _ = create_languages
    user = create_user(username="testuser", password="testpassword", role=Profile.USER)
    suggestion = create_suggestion("Hello", "Como estas?", english, spanish, user, True, "test_model", "1.0")
    url = f"/api/suggestions/{suggestion.id}/reject_suggestion/"
    response = api_client.patch(url, format="json")
    assert response.status_code == 200
    assert TranslationPair.objects.count() == 1
    created_suggestion = TranslationPair.objects.first()
    assert created_suggestion.correct == False
    assert created_suggestion.validated == True
    assert created_suggestion.validated_by == admin_auth
    assert created_suggestion.dst_text == "Como estas?" 
    assert created_suggestion.feedback == True
    assert created_suggestion.suggestion == "Como estas?"  # keep original suggestion
    
# 7. Invalid language code
@pytest.mark.django_db
def test_invalid_language_code(api_client, admin_auth, create_languages):
    english, spanish, _, _ = create_languages
    data = {
        "src_text": "How are you?",
        "dst_text": "Como estas?",
        "src_lang": {"code": english.code},
        "dst_lang": {"code": "en"}, 
        "suggestion": "Vie gets",
        "model_name": "test_model",
        "model_version": "1.0"
    }
    url = "/api/suggestions/reject_translation/"
    response = api_client.post(url, data, format="json")
    assert response.status_code == 400
    assert TranslationPair.objects.count() == 0
    assert "dst_lang" in response.data
    
# 8. List suggestions - Success
@pytest.mark.django_db
def test_list_suggestions_validated_success(api_client, admin_auth, create_languages):
    english, spanish, _, _ = create_languages 
    suggestion = create_suggestion(
        src_text="Hello", 
        dst_text="Como estas?", 
        src_lang=english, 
        dst_lang=spanish, 
        user=admin_auth, 
        feedback=False, 
        model_name="test_model", 
        model_version="1.0",
        suggestion="Hola"
    )
    
    suggestion.validated = True
    suggestion.correct = False
    suggestion.save()
    
    suggestion2 = create_suggestion(
        src_text="Hello", 
        dst_text="Hola", 
        src_lang=english, 
        dst_lang=spanish, 
        user=admin_auth, 
        feedback=False, 
        model_name="test_model", 
        model_version="1.0",
        suggestion="Hola"
    )
    
    suggestion2.validated = True
    suggestion2.correct = True
    suggestion2.save()
    
    suggestion3 = create_suggestion(
        src_text="How are you?", 
        dst_text="Como estas?", 
        src_lang=english, 
        dst_lang=spanish, 
        user=admin_auth, 
        feedback=True, 
        model_name="test_model", 
        model_version="1.0"
    )

    suggestion3.validated = False
    suggestion3.save()
    
    # test with no params
    params = {
        "validated": True,
        "lang": spanish.code,
        "correct": True
    }
    url = "/api/suggestions/"
    response = api_client.get(f'{url}?{urlencode(params)}', format="json")

    assert response.status_code == 200
    # show only validated AND CORRECT
    assert response.data['count'] == 1 # correct number unvalidated suggestions
    assert response.data['results'][0]['id'] == suggestion2.id
    assert response.data['results'][0]['validated'] == True
    assert response.data['results'][0]['correct'] == True
    
# 9. List suggestions - Not validated
@pytest.mark.django_db
def test_list_suggestions_not_validated_success(api_client, admin_auth, create_languages):
    english, spanish, _, _ = create_languages 
    suggestion = create_suggestion(
        src_text="Hello", 
        dst_text="Como estas?", 
        src_lang=english, 
        dst_lang=spanish, 
        user=admin_auth, 
        feedback=False, 
        model_name="test_model", 
        model_version="1.0",
        suggestion="Hola"
    )
    
    suggestion.validated = True
    suggestion.correct = False
    suggestion.save()
    
    suggestion2 = create_suggestion(
        src_text="Hello", 
        dst_text="Hola", 
        src_lang=english, 
        dst_lang=spanish, 
        user=admin_auth, 
        feedback=False, 
        model_name="test_model", 
        model_version="1.0",
        suggestion="Hola"
    )
    
    suggestion2.validated = True
    suggestion2.correct = True
    suggestion2.save()
    
    suggestion3 = create_suggestion(
        src_text="How are you?", 
        dst_text="Como estas?", 
        src_lang=english, 
        dst_lang=spanish, 
        user=admin_auth, 
        feedback=True, 
        model_name="test_model", 
        model_version="1.0"
    )

    suggestion3.validated = False
    suggestion3.save()
    
    suggestion4 = create_suggestion(
        src_text="I want to go to the park", 
        dst_text="Quiero ir a la playa", 
        src_lang=english, 
        dst_lang=spanish, 
        user=admin_auth, 
        feedback=False, 
        model_name="test_model", 
        model_version="1.0"
    )

    suggestion4.validated = False
    suggestion4.save()
    

    # test with no params
    params = {
        "validated": False,
        "lang": spanish.code,
    }
    
    url = "/api/suggestions/"
    response = api_client.get(f'{url}?{urlencode(params)}', format="json")

    assert response.status_code == 200
    # show only unvalidated suggestions
    assert response.data['count'] == 2 # correct number unvalidated suggestions
    assert response.data['results'][0]['validated'] == False
    assert response.data['results'][1]['validated'] == False
    assert response.data['results'][0]['correct'] == None
    assert response.data['results'][1]['correct'] == None
    
    
    

    
