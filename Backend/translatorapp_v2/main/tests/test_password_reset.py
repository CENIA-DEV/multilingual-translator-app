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
from urllib.parse import urlencode

import pytest
from fixtures import *
from main.models import PasswordResetToken


# 1. recover_password - Success
@pytest.mark.django_db
def test_recover_password_success(api_client, user, mock_recovery_email):
    url = "/api/password_reset/recover_password/"
    data = {"email": user.email}

    response = api_client.post(url, data, format="json")

    assert response.status_code == 200
    assert "token" in response.data
    # assert reset token was created correctly
    assert PasswordResetToken.objects.filter(user=user).exists()
    # assert the email was sent with the correct info
    mock_recovery_email.assert_called_once_with(
        user_email=user.email, raw_token=response.data["token"]
    )


# 2. recover_password - Invalid Email
@pytest.mark.django_db
def test_recover_password_invalid_email(api_client, mock_recovery_email):
    url = "/api/password_reset/recover_password/"
    data = {"email": "invalid_email"}

    response = api_client.post(url, data, format="json")

    assert response.status_code == 400
    assert "user" in response.data  # Expecting an error related to the 'user' field
    assert PasswordResetToken.objects.count() == 0  # No object created
    # Assert that the email wasnt sent
    mock_recovery_email.assert_not_called()


# 3. check_reset_token - Active Token
@pytest.mark.django_db
def test_check_reset_token_active(api_client, user, reset_token):
    url = "/api/password_reset/check_reset_token/"
    params = {"token": reset_token.token}

    response = api_client.get(f"{url}?{urlencode(params)}", format="json")

    assert response.status_code == 200
    assert response.data["is_active"] == True  # check token active


# 4. check_reset_token - Expired Token
@pytest.mark.django_db
def test_check_reset_token_expired(api_client, user, reset_token, mock_timezone):
    # We use mock timezone since given the logic of reset_token.is_expired()
    # we dont want to modify the expiry date just to make sure that is properly set

    url = "/api/password_reset/check_reset_token/"
    params = {"token": reset_token.token}

    response = api_client.get(f"{url}?{urlencode(params)}", format="json")

    assert response.status_code == 200
    assert response.data["is_active"] == False  # check token expired


# 5. check_reset_token - Invalid Token
@pytest.mark.django_db
def test_check_reset_token_invalid(api_client):
    url = "/api/password_reset/check_reset_token/"
    params = {"token": "invalid_token"}

    response = api_client.get(f"{url}?{urlencode(params)}", format="json")

    assert response.status_code == 404  # token not found
