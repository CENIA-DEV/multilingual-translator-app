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
"""Role permissions must not crash for users that have no Profile."""

import pytest
from django.contrib.auth.models import User
from django.urls import reverse
from fixtures import api_client, create_languages  # noqa: F401
from main.models import Lang, Profile
from rest_framework.authtoken.models import Token


def authenticate(client, user):
    token, _ = Token.objects.get_or_create(user=user)
    client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")


@pytest.fixture
def superuser_without_profile(api_client):  # noqa: F811
    # What `manage.py createsuperuser` produces: no Profile row at all.
    user = User.objects.create_superuser(
        username="root", email="root@example.com", password="secret"
    )
    assert not Profile.objects.filter(user=user).exists()
    authenticate(api_client, user)
    return user


@pytest.mark.django_db
def test_superuser_without_profile_can_list_suggestions(
    api_client, superuser_without_profile  # noqa: F811
):
    # IsNativeAdmin | IsAdmin | IsAdminUser: the role checks run first and
    # used to raise RelatedObjectDoesNotExist (500) instead of returning False.
    response = api_client.get("/api/suggestions/")
    assert response.status_code == 200


@pytest.mark.django_db
def test_superuser_without_profile_can_edit_a_language(
    api_client, superuser_without_profile, create_languages  # noqa: F811
):
    english, _, _, _ = create_languages
    url = reverse("language-detail", kwargs={"pk": english.id})

    response = api_client.patch(url, {"name": "Inglés"}, format="json")
    assert response.status_code == 200, response.data
    assert Lang.objects.get(id=english.id).name == "Inglés"


@pytest.mark.django_db
def test_regular_user_without_profile_is_forbidden_not_500(api_client):  # noqa: F811
    user = User.objects.create_user(username="plain", password="secret")
    authenticate(api_client, user)

    response = api_client.get("/api/suggestions/")
    assert response.status_code == 403
