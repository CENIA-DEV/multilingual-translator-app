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
from datetime import date

import pytest
from django.contrib.auth.models import User
from main.models import Profile
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient


@pytest.fixture
def api():
    return APIClient()


def _login(client, user):
    token, _ = Token.objects.get_or_create(user=user)
    client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")
    return user


def _user_with_role(username, role):
    user = User.objects.create_user(username=username, password="secret")
    Profile.objects.create(user=user, role=role, date_of_birth=date(1990, 1, 1))
    return user


@pytest.fixture
def manager(api):
    """Technical team ("Admin" role): may administer the translator."""
    return _login(api, _user_with_role("tech", Profile.ADMIN))


@pytest.fixture
def native_admin(api):
    return _login(api, _user_with_role("community", Profile.NATIVEADMIN))


@pytest.fixture
def regular_user(api):
    return _login(api, _user_with_role("visitor", Profile.USER))


@pytest.fixture
def superuser_without_profile(api):
    user = User.objects.create_superuser(username="root", password="secret")
    return _login(api, user)
