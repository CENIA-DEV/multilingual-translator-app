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
"""Password-reset and invitation tokens are secrets that only the email carries.

The database stores a SHA-256 hash of each token. The raw token goes out by
email and is hashed again whenever it comes back, so neither the stored value
nor anything the API returns can stand in for it.
"""
import pytest
from fixtures import *
from main.models import InvitationToken, PasswordResetToken, Profile
from rest_framework.test import APIClient


def emailed_token(mock_email, kwarg):
    """The raw token the view handed to the (mocked) email function."""
    return mock_email.call_args.kwargs[kwarg]


# ── Password reset ──────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_recover_password_does_not_return_the_token(
    api_client, user, mock_recovery_email
):
    response = api_client.post(
        "/api/password_reset/recover_password/", {"email": user.email}, format="json"
    )
    assert response.status_code == 200
    assert "token" not in response.data


@pytest.mark.django_db
def test_only_the_emailed_token_resets_the_password(
    api_client, user, mock_recovery_email
):
    api_client.post(
        "/api/password_reset/recover_password/", {"email": user.email}, format="json"
    )
    stored = PasswordResetToken.objects.get(user=user).token
    raw = emailed_token(mock_recovery_email, "raw_token")
    assert raw != stored

    # The stored hash is not a usable token.
    response = api_client.patch(
        "/api/users/update_password_token/",
        {"token": stored, "password": "hijacked-pw-123"},
        format="json",
    )
    assert response.status_code == 404
    user.refresh_from_db()
    assert not user.check_password("hijacked-pw-123")

    # The emailed token is.
    response = api_client.patch(
        "/api/users/update_password_token/",
        {"token": raw, "password": "new-password-123"},
        format="json",
    )
    assert response.status_code == 200
    user.refresh_from_db()
    assert user.check_password("new-password-123")
    assert not PasswordResetToken.objects.filter(user=user).exists()


@pytest.mark.django_db
def test_check_reset_token_takes_the_emailed_token_only(
    api_client, user, mock_recovery_email
):
    api_client.post(
        "/api/password_reset/recover_password/", {"email": user.email}, format="json"
    )
    stored = PasswordResetToken.objects.get(user=user).token
    raw = emailed_token(mock_recovery_email, "raw_token")

    url = "/api/password_reset/check_reset_token/"
    assert api_client.get(url, {"token": stored}).status_code == 404
    response = api_client.get(url, {"token": raw})
    assert response.status_code == 200
    assert response.data["is_active"] is True
    assert "token" not in response.data


@pytest.mark.django_db
def test_reset_tokens_cannot_be_listed_or_fetched(api_client, reset_token):
    """Only the two reset actions are exposed; no generic list/detail routes."""
    assert api_client.get("/api/password_reset/").status_code == 404
    assert api_client.get(f"/api/password_reset/{reset_token.pk}/").status_code == 404


@pytest.mark.django_db
def test_a_missing_reset_token_is_a_bad_request(api_client):
    response = api_client.patch(
        "/api/users/update_password_token/", {"password": "x"}, format="json"
    )
    assert response.status_code == 400
    response = api_client.get("/api/password_reset/check_reset_token/")
    assert response.status_code == 400


# ── Invitations ─────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_send_invitation_emails_the_raw_token_and_does_not_return_it(
    api_client, admin_auth, mock_invite_email
):
    response = api_client.post(
        "/api/invitations/send_invitation/",
        {
            "email": "invitee@example.com",
            "role": Profile.ADMIN,
            "first_name": "Ana",
            "last_name": "Pérez",
        },
        format="json",
    )
    assert response.status_code == 200
    assert "token" not in response.data

    stored = InvitationToken.objects.get(email="invitee@example.com").token
    raw = emailed_token(mock_invite_email, "invitation_token")
    assert raw != stored

    anonymous = APIClient()
    url = "/api/invitations/check_invitation_token/"
    assert anonymous.get(url, {"token": stored}).status_code == 404
    response = anonymous.get(url, {"token": raw})
    assert response.status_code == 200
    assert response.data["email"] == "invitee@example.com"
    assert "token" not in response.data


@pytest.mark.django_db
def test_only_the_emailed_token_registers_an_invited_user(
    api_client, admin_auth, mock_invite_email
):
    api_client.post(
        "/api/invitations/send_invitation/",
        {
            "email": "invitee@example.com",
            "role": Profile.ADMIN,
            "first_name": "Ana",
            "last_name": "Pérez",
        },
        format="json",
    )
    stored = InvitationToken.objects.get(email="invitee@example.com").token
    raw = emailed_token(mock_invite_email, "invitation_token")

    def register(token):
        return APIClient().post(
            "/api/users/create_by_invitation/",
            {
                "username": "invitee@example.com",
                "email": "invitee@example.com",
                "password": "invitee-pw-123",
                "first_name": "Ana",
                "last_name": "Pérez",
                "profile": {"date_of_birth": "2000-01-01", "proficiency": "Fluent"},
                "token": token,
            },
            format="json",
        )

    assert register(stored).status_code == 404
    response = register(raw)
    assert response.status_code == 201, response.data
    assert not InvitationToken.objects.filter(email="invitee@example.com").exists()


@pytest.mark.django_db
def test_invitation_lookup_by_email_requires_an_admin(create_invitation):
    response = APIClient().post(
        "/api/invitations/get_invitation_by_user/",
        {"email": create_invitation.email},
        format="json",
    )
    assert response.status_code in (401, 403)


@pytest.mark.django_db
def test_resend_invitation_issues_a_new_token(
    api_client, admin_auth, create_invitation, mock_invite_email
):
    old_raw = create_invitation._raw_token
    response = api_client.post(
        f"/api/invitations/{create_invitation.pk}/resend_invitation/"
    )
    assert response.status_code == 200
    assert "token" not in response.data

    new_raw = emailed_token(mock_invite_email, "invitation_token")
    assert new_raw != old_raw
    url = "/api/invitations/check_invitation_token/"
    assert api_client.get(url, {"token": new_raw}).status_code == 200
    assert api_client.get(url, {"token": old_raw}).status_code == 404


@pytest.mark.django_db
def test_a_missing_invitation_token_is_a_bad_request(api_client):
    response = api_client.get("/api/invitations/check_invitation_token/")
    assert response.status_code == 400
    response = api_client.post(
        "/api/users/create_by_invitation/", {"email": "a@b.com"}, format="json"
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_registration_does_not_log_the_password(api_client, create_invitation, capsys):
    api_client.post(
        "/api/users/create_by_invitation/",
        {
            "username": create_invitation.email,
            "email": create_invitation.email,
            "password": "secret-pw-do-not-log",
            "first_name": "John",
            "last_name": "Doe",
            "profile": {"date_of_birth": "2000-01-01", "proficiency": "Fluent"},
            "token": create_invitation._raw_token,
        },
        format="json",
    )
    assert "secret-pw-do-not-log" not in capsys.readouterr().out
