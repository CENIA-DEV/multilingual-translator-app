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
from datetime import datetime, timedelta
from django.contrib.auth.models import User
from django.utils import timezone
from main.models import InvitationToken, Lang, PasswordResetToken, Profile, Script
from rest_framework.authtoken.models import Token
from django.conf import settings
# API
@pytest.fixture
def api_client():
    from rest_framework.test import APIClient

    return APIClient()


# USERS
@pytest.fixture(
    params=[
        {"username": "testuser1", "password": "testpassword1", "role": Profile.ADMIN}
    ]
)
def admin_auth(api_client, request):
    user_data = request.param.copy()
    role = user_data.pop("role")
    user = User.objects.create_user(**user_data)
    Profile.objects.create(user=user, role=role, date_of_birth=datetime.now() - timedelta(days=365*20))
    token, _ = Token.objects.get_or_create(user=user)
    api_client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")
    return user

@pytest.fixture(
    params=[
        {"username": "testuser1", "password": "testpassword1", "role": Profile.NATIVEADMIN}
    ]
)
def native_admin_auth(api_client, request):
    user_data = request.param.copy()
    role = user_data.pop("role")
    user = User.objects.create_user(**user_data)
    Profile.objects.create(user=user, role=role, date_of_birth=datetime.now() - timedelta(days=365*20))
    token, _ = Token.objects.get_or_create(user=user)
    api_client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")
    return user


@pytest.fixture(
    params=[
        {"username": "testuser1", "password": "testpassword1", "role": Profile.USER}
    ]
)
def user_auth(api_client, request):
    user_data = request.param.copy()
    role = user_data.pop("role")
    user = User.objects.create_user(**user_data)
    Profile.objects.create(user=user, role=role, date_of_birth=datetime.now() - timedelta(days=365*20))
    token, _ = Token.objects.get_or_create(user=user)
    api_client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")
    return user


@pytest.fixture
def user():
    user = User.objects.create_user(
        username="testuser@example.com",
        email="testuser@example.com",
        password="testpassword",
    )
    Profile.objects.create(user=user, role=Profile.USER, date_of_birth=datetime.now() - timedelta(days=365*20))
    return user


# OBJECTS
@pytest.fixture
def reset_token(user):
    reset_token = PasswordResetToken(user=user)
    reset_token.generate_token()
    reset_token.save()
    return reset_token


@pytest.fixture
def create_invitation(admin_auth):
    invitation = InvitationToken(
        first_name="John",
        last_name="Doe", 
        organization="test_organization",
        email="invited_user@example.com",
        role="User",
        invited_by=admin_auth,  # Use the authenticated user
    )
    invitation.generate_token()
    invitation.save()
    return invitation


@pytest.fixture
def create_languages():
    script, _ = Script.objects.get_or_create(code="Latn", name="Latin")
    english, _ = Lang.objects.get_or_create(code="eng_Latn", script=script, name="English")
    spanish, _ = Lang.objects.get_or_create(code="spa_Latn", script=script, name="Spanish")
    rapanui, _ = Lang.objects.get_or_create(code="rap_Latn", script=script, name="Rapanui", is_native=True)
    french, _ = Lang.objects.get_or_create(code="fra_Latn", script=script, name="French")
    return english, spanish, rapanui, french


# MOCKS
@pytest.fixture
def mock_timezone(mocker):
    # mock timezone now so the current date is + 2 days and expired is only + 1
    return mocker.patch(
        "main.models.timezone.now",
        return_value=timezone.now() + timezone.timedelta(days=2),
    )


@pytest.fixture
def mock_invite_email(mocker):
    # Mock the send_invite_email function so we dont send email
    return mocker.patch("main.views.send_invite_email")


@pytest.fixture
def mock_recovery_email(mocker):
    # mock email function  so we dont send the actual email
    return mocker.patch("main.views.send_recovery_email")  # Adjust the import path
    
@pytest.fixture
def mock_get_prediction(mocker):
    # mock translate function so we dont call model endpoint
    def custom_prediction(*args, **kwargs):
        # You can access the arguments and return different values based on them
        if 'dst_lang' in kwargs:
            dst_lang = kwargs['dst_lang']
        else:
            dst_lang = args[2]
            
        if 'deployment' in kwargs:
            deployment = kwargs['deployment']
        else:
            deployment = args[3]
            
        if dst_lang == "spa_Latn":
            return "Hola", "NativeModel", "V1"
        elif dst_lang == "rap_Latn":
            return "Iorana", "NativeModel", "V1"
        elif dst_lang == "eng_Latn":
            return 'Hello', "NativeModel", "V1"
        elif dst_lang == "fra_Latn":
            return "Bonjour", "NativeModel", "V1"
        print(f"No match for {dst_lang}")
        return "Default response"

    return mocker.patch(
        "main.utils.get_prediction",
        side_effect=custom_prediction
    )


@pytest.fixture
def mock_model_status(mocker):
    # mock model status function so we dont call model endpoint
    return mocker.patch("main.views.get_model_status", return_value="up")

@pytest.fixture
def mock_model_up(mocker):
    # mock model status function so we dont call model endpoint
    return mocker.patch("main.views.turn_model_on", return_value="booting")

@pytest.fixture
def mock_participate_email(mocker):
    # mock email function so we dont send the actual      
    return mocker.patch("main.views.send_participate_email", return_value=None)
