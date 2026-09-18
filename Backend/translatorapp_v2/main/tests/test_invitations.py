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
from fixtures import (admin_auth, api_client, create_invitation,
                      mock_invite_email, mock_timezone, user)
from main.models import InvitationToken
from main.utils import get_hashed_token
from rest_framework.authtoken.models import Token
from unittest.mock import ANY
from urllib.parse import urlencode


# 1. New invitation (Success)
@pytest.mark.django_db
def test_send_invitation(api_client, admin_auth, mock_invite_email):
    url = "/api/invitations/send_invitation/"
    data = {
        "email": "invited_user@example.com",
        "role": "User",
        "first_name": "John",
        "last_name": "Doe",
        "organization": "test_organization",
    }

    response = api_client.post(url, data, format="json")

    assert response.status_code == 200
    # the token is a secret for the email only, never part of the response
    assert "token" not in response.data
    assert InvitationToken.objects.filter(
        email="invited_user@example.com", invited_by=admin_auth
    )

    # Assert that the mocked function was called with the expected arguments
    mock_invite_email.assert_called_once_with(
        invited_by_user=admin_auth,
        user_email="invited_user@example.com",
        invitation_token=ANY,
    )
    # the email carries the raw token; the database keeps only its hash
    raw_token = mock_invite_email.call_args.kwargs["invitation_token"]
    stored = InvitationToken.objects.get(email="invited_user@example.com").token
    assert get_hashed_token(raw_token) == stored


# 2. Duplicate invitation (Fail)
@pytest.mark.django_db
def test_invalid_duplicate_invitation(
    api_client, admin_auth, create_invitation, mock_invite_email
):
    url = "/api/invitations/send_invitation/"
    data = {
        "email": "invited_user@example.com",
        "role": "User",
    }

    response = api_client.post(url, data, format="json")

    assert response.status_code == 400  # bad request duplicate invitaions

    # Assert that the email wasnt sent
    mock_invite_email.assert_not_called()


# 3. Invalid invitation - missing fields (Fail)
@pytest.mark.django_db
def test_invalid_invitation(
    api_client, admin_auth, create_invitation, mock_invite_email
):
    url = "/api/invitations/send_invitation/"
    data = {
        "role": "User",  # missing email
    }

    response = api_client.post(url, data, format="json")

    assert response.status_code == 400  # bad request duplicate invitaions
    assert "email" in response.data
    # Assert that the email wasnt sent
    mock_invite_email.assert_not_called()


# 4. List invitations (Success)
@pytest.mark.django_db
def test_list_invitations(api_client, admin_auth, create_invitation):
    url = "/api/invitations/"

    response = api_client.get(url)
    print(response.data)
    assert response.status_code == 200
    assert len(response.data) == 1


# 5. List Invitations (Fail - Forbidden)
@pytest.mark.django_db
def test_list_invitations_unauthorized(api_client, user):
    # change api credentials to standard user
    token, _ = Token.objects.get_or_create(user=user)
    api_client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")
    url = "/api/requests/get_pending_requests/"

    response = api_client.get(url)

    assert response.status_code == 403  # Forbidden request


# 6. Resend invitation (Success)
@pytest.mark.django_db
def test_resend_invitation(
    api_client, admin_auth, create_invitation, mock_invite_email
):
    url = f"/api/invitations/{create_invitation.pk}/resend_invitation/"

    response = api_client.post(url)

    assert response.status_code == 200
    assert "token" not in response.data

    # Only the hash is stored, so the original token cannot be re-sent: a resend
    # always emails a new token and replaces the stored hash.
    mock_invite_email.assert_called_once_with(
        invited_by_user=admin_auth,
        user_email="invited_user@example.com",
        invitation_token=ANY,
    )
    raw_token = mock_invite_email.call_args.kwargs["invitation_token"]
    assert raw_token != create_invitation._raw_token
    create_invitation.refresh_from_db()
    assert get_hashed_token(raw_token) == create_invitation.token


# 7. Resend invitation - expired -> new (Success)
@pytest.mark.django_db
def test_resend_invitation_expired(
    api_client, admin_auth, create_invitation, mock_invite_email, mock_timezone
):
    # mock timezone will give a date of now() = + 2 so token should be expired. Test new token is generated
    url = f"/api/invitations/{create_invitation.pk}/resend_invitation/"

    response = api_client.post(url)

    assert response.status_code == 200
    assert "token" not in response.data

    # Assert that the mocked function was called with the expected arguments
    mock_invite_email.assert_called_once_with(
        invited_by_user=admin_auth,
        user_email="invited_user@example.com",
        invitation_token=ANY,
    )
    raw_token = mock_invite_email.call_args.kwargs["invitation_token"]
    assert raw_token != create_invitation._raw_token  # new token generated
    create_invitation.refresh_from_db()
    assert get_hashed_token(raw_token) == create_invitation.token
    assert not create_invitation.is_expired()  # with a fresh expiry


# 8. Check active invitation (Success)
@pytest.mark.django_db
def test_active_invitation_token(api_client, admin_auth, create_invitation):
    url = "/api/invitations/check_invitation_token/"
    params = {"token": create_invitation._raw_token}

    response = api_client.get(f"{url}?{urlencode(params)}", format="json")

    assert response.status_code == 200
    assert "is_active" in response.data
    assert response.data["is_active"] == True
    assert "email" in response.data
    assert response.data["email"] == create_invitation.email




# 9. Check expired invitation (Success)
@pytest.mark.django_db
def test_expired_invitation_token(
    api_client, admin_auth, create_invitation, mock_timezone
):
    # mock timezone will give a date of now() = + 2 so token should be expired
    params = {"token": create_invitation._raw_token}
    url = "/api/invitations/check_invitation_token/"

    response = api_client.get(f"{url}?{urlencode(params)}", format="json")

    assert response.status_code == 200
    assert response.data["is_active"] == False


# 10. Check invitation from user
@pytest.mark.django_db
def test_get_invitation_by_user(api_client, admin_auth, create_invitation):
    url = "/api/invitations/get_invitation_by_user/"
    data = {"email": create_invitation.email}

    response = api_client.post(url, data, format="json")

    assert response.status_code == 200
    assert response.data["email"] == create_invitation.email
    assert "token" not in response.data

    # test wrong email
    data = {"email": "example@test.cl"}

    response = api_client.post(url, data, format="json")

    assert response.status_code == 404  # not found


# 11. Update user role (Success)
@pytest.mark.django_db
def test_update_user_role(api_client, admin_auth, create_invitation):
    url = f"/api/invitations/{create_invitation.pk}/"
    data = {"role": "Admin"}

    response = api_client.patch(url, data, format="json")

    assert response.status_code == 200
    assert response.data["role"] == "Admin"  # check correct user role update
    assert "token" not in response.data
    assert response.data["invited_by"]["email"] == admin_auth.email


# 12. Update user role (Fail - Forbidden)
@pytest.mark.django_db
def test_update_user_role(api_client, admin_auth, create_invitation, user):
    # change api credentials to standard user
    token, _ = Token.objects.get_or_create(user=user)
    api_client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")

    url = f"/api/invitations/{create_invitation.pk}/"
    data = {"role": "Admin"}

    response = api_client.patch(url, data, format="json")

    assert response.status_code == 403  # Forbidden
