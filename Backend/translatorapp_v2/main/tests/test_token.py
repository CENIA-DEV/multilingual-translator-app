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
from django.contrib.auth.models import User
from rest_framework.test import APIClient


@pytest.mark.django_db
def test_valid_login():
    user = User.objects.create_user(username="testuser", password="testpassword")
    client = APIClient()
    response = client.post(
        "/api/users/token/", {"username": "testuser", "password": "testpassword"}
    )
    assert response.status_code == 200
    assert "token" in response.data
    assert "user_id" in response.data
    assert "email" in response.data


@pytest.mark.django_db
def test_invalid_login():
    client = APIClient()
    response = client.post(
        "/api/users/token/", {"username": "wronguser", "password": "wrongpassword"}
    )
    assert response.status_code == 400
    assert "non_field_errors" in response.data


@pytest.mark.django_db
def test_missing_data():
    client = APIClient()
    response = client.post("/api/users/token/", {"username": "testuser"})
    assert response.status_code == 400
    assert "password" in response.data
