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
from fixtures import api_client, admin_auth, user_auth, create_languages
from django.urls import reverse
from main.models import Lang
# 1. List all languages (Success)
@pytest.mark.django_db
def test_list_languages(api_client, user_auth, create_languages):
    url = reverse('language-list')
    response = api_client.get(url)
    assert response.status_code == 200
    assert len(response.data) == 4
    

# 2. Update language name (Success)
@pytest.mark.django_db
def test_update_language(api_client, admin_auth, create_languages):
    english, spanish, _, _ = create_languages
    url = reverse('language-detail', kwargs={'pk': english.id})
    updated_data = {
        'name': 'new_name',
    }
    
    response = api_client.patch(url, updated_data)
    
    assert response.status_code == 200
    assert response.data['name'] == 'new_name'  
    assert Lang.objects.get(id=english.id).name == 'new_name'
    

# 3. Update language name (Fail - Unauthorized)
@pytest.mark.django_db
def test_update_language_fail(api_client, user_auth, create_languages):
    english, spanish, _, _ = create_languages
    url = reverse('language-detail', kwargs={'pk': english.id})
    updated_data = {
        'name': 'new_name',
    }       
    
    response = api_client.patch(url, updated_data)
    
    assert response.status_code == 403 # user not allowed to update lang
    

# 4. Update language name (Fail - Not found)
@pytest.mark.django_db
def test_update_language_not_found(api_client, admin_auth, create_languages):
    url = reverse('language-detail', kwargs={'pk': 999})
    updated_data = {
        'name': 'new_name',
    }

    response = api_client.patch(url, updated_data)
    
    assert response.status_code == 404 # not found
    assert not Lang.objects.filter(pk=999).exists()
    

# 5. Add language (Success)
@pytest.mark.django_db
def test_add_language(api_client, admin_auth, create_languages):
    url = reverse('language-list')
    new_language_data = {
        'name': 'new_language',
        'code': 'NL',
        'script': {
            'code': 'Latn',
            'name': 'Latin'
        },
        'dialect': {
            'code': 'dlct',
            'name': 'New Dialect'
        }
    }
    
    
    
    response = api_client.post(url, new_language_data, format='json')
    print(response.data)
    assert response.status_code == 201 # created
    assert Lang.objects.filter(name='new_language').exists()
    

# 6. Add language (Fail - Unauthorized)
@pytest.mark.django_db
def test_add_language_fail(api_client, user_auth, create_languages):
    url = reverse('language-list')
    new_language_data = {
        'name': 'new_language',
        'code': 'NL', 
        'script': {
            'code': 'Latn',
            'name': 'Latin'
        },
        'dialect': {
            'code': 'dlct',
            'name': 'New Dialect'
        },  
    }
    
    response = api_client.post(url, new_language_data, format='json')
    
    assert response.status_code == 403 # user not allowed to add lang
    

# 7. Add language (Fail - Invalid data)
@pytest.mark.django_db
def test_add_language_invalid_data(api_client, admin_auth, create_languages):
    url = reverse('language-list')
    invalid_language_data = {
        'name': 'new_language',
        'script': 'Latn',
        'dialect': 'New Dialect',  
    }
    
    response = api_client.post(url, invalid_language_data)
    
    assert response.status_code == 400 # bad request
    assert 'code' in response.data # code is required
    assert not Lang.objects.filter(name='new_language').exists()
    

# 8. Delete language (Success)
@pytest.mark.django_db
def test_delete_language(api_client, admin_auth, create_languages):
    english, spanish, _, _ = create_languages
    url = reverse('language-detail', kwargs={'pk': english.id})
    
    response = api_client.delete(url)
    
    assert response.status_code == 204 # no content
    assert not Lang.objects.filter(pk=english.id).exists()
    assert Lang.objects.count() == 3
    

# 9. Delete language (Fail - Unauthorized)
@pytest.mark.django_db
def test_delete_language_fail(api_client, user_auth, create_languages):
    english, spanish, _, _ = create_languages
    url = reverse('language-detail', kwargs={'pk': english.id})
    
    response = api_client.delete(url)
    
    assert response.status_code == 403 # forbidden
    assert Lang.objects.filter(pk=english.id).exists()
    

# 10. Delete language (Fail - Not found)
    
    


