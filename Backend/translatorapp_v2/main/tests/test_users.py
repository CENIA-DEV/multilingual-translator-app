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
from fixtures import api_client, user_auth, admin_auth, mock_timezone
from main.models import *
from rest_framework.authtoken.models import Token
from datetime import datetime, timedelta

def create_user(username, password, role, is_active=True):
    user = User.objects.create_user(
        username=username, password=password, is_active=is_active, email=username
    )
    profile = Profile.objects.create(user=user, role=role, date_of_birth=datetime.now() - timedelta(days=365*20))
    return user


@pytest.mark.django_db
def test_list_active_users_permission_denied(api_client):
    user1 = create_user(
        username="activeuser",
        password="activepassword",
        role=Profile.USER,
        is_active=True,
    )
    user2 = create_user(
        username="inactiveuser",
        password="inactivepassword",
        role=Profile.USER,
        is_active=False,
    )
    response = api_client.get("/api/users/")
    assert response.status_code == 401


@pytest.mark.django_db
def test_list_active_users(api_client):
    user1 = create_user(
        username="activeuser",
        password="activepassword",
        role=Profile.NATIVEADMIN,
        is_active=True,
    )
    user2 = create_user(
        username="inactiveuser",
        password="inactivepassword",
        role=Profile.USER,
        is_active=False,
    )
    token, _ = Token.objects.get_or_create(user=user1)
    api_client.credentials(HTTP_AUTHORIZATION="Token " + token.key)
    response = api_client.get("/api/users/")
    assert response.status_code == 200
    assert len(response.data) == 1
    assert response.data[0]["username"] == "activeuser"


@pytest.mark.django_db
def test_change_status_permission_denied(api_client):
    user = create_user(username="user", password="testpassword", role=Profile.USER)
    token, _ = Token.objects.get_or_create(user=user)
    api_client.credentials(HTTP_AUTHORIZATION="Token " + token.key)
    response = api_client.post(
        f"/api/users/{user.id}/change_status/", {"status": "inactive"}, format="json"
    )
    assert response.status_code == 403  # Assuming only admins can change status
    
@pytest.mark.django_db
def test_get_user_by_token(api_client):
    user = create_user(username="user", password="testpassword", role=Profile.USER)
    token, _ = Token.objects.get_or_create(user=user)
    api_client.credentials(HTTP_AUTHORIZATION="Token " + token.key)
    response = api_client.get("/api/users/get_by_token/")
    print(response.data)
    assert response.status_code == 200
    assert response.data["username"] == "user"
    assert response.data["profile"]["age"] == 20


@pytest.mark.django_db
def test_change_status(api_client):
    user = create_user(username="user", password="testpassword", role=Profile.USER)
    admin = create_user(
        username=Profile.ADMIN, password="adminpassword", role=Profile.ADMIN
    )
    token, _ = Token.objects.get_or_create(user=admin)
    api_client.credentials(HTTP_AUTHORIZATION="Token " + token.key)
    response = api_client.patch(
        f"/api/users/{user.id}/change_status/", {"status": "inactive"}, format="json"
    )
    assert response.status_code == 200  # Assuming only admins can change status


@pytest.mark.django_db
def test_create_by_invitation(api_client):
    token = InvitationToken(email="email@admin.com", role=Profile.ADMIN, organization="org", first_name="James", last_name="doe")
    token.generate_token()
    token.save()
    birth_date = (datetime.now() - timedelta(days=365*20)).strftime("%Y-%m-%d")
    response = api_client.post(
        "/api/users/create_by_invitation/",
        {
            "token": token.token,
            "email": "email@admin.com",
            "username": "email@admin.com",
            "password": "adminpassword",
            "first_name": "John",
            "last_name": "Doe",
            "profile": {
                "organization": "neworg",
                "proficiency": "Fluent",
                "date_of_birth": birth_date
            }
        },
        format="json",
    )
    assert response.status_code == 201
    assert response.data["profile"]["role"] == Profile.ADMIN
    assert response.data["profile"]["organization"] == "neworg" # field updated
    assert InvitationToken.objects.count() == 0 # invitation token is deleted
    assert User.objects.first().first_name == "John" # field udpated
    assert User.objects.first().last_name == "Doe" # field udpated
    assert User.objects.first().email == "email@admin.com" # field stays the same
    assert User.objects.first().username == "email@admin.com"
    assert User.objects.first().profile.date_of_birth.strftime("%Y-%m-%d") == birth_date
    assert User.objects.first().profile.proficiency == Profile.FLUENT
    
@pytest.mark.django_db
def test_create_by_invitation_user_inactive(api_client):
    user = create_user(
        username="email@admin.com",
        password="activepassword",
        role=Profile.ADMIN,
        is_active=False,
    )
    token = InvitationToken(email="email@admin.com", role=Profile.NATIVEADMIN, organization="testorg", first_name="John", last_name="Doe")
    token.generate_token()
    token.save()
    birth_date = (datetime.now() - timedelta(days=365*20)).strftime("%Y-%m-%d")
    response = api_client.post(
        "/api/users/create_by_invitation/",
        {
            "token": token.token,
            "email": "email@admin.com",
            "username": "email@admin.com",
            "password": "newadminpassword",
            "first_name": "John",
            "last_name": "Doe",
            "profile": {
                "organization": "testorg",
                "proficiency": "Fluent",
                "date_of_birth": birth_date
            }
        },
        format="json",
    )
    assert response.status_code == 201
    assert response.data["profile"]["role"] == Profile.NATIVEADMIN
    assert response.data["profile"]["organization"] == token.organization
    # no more users created
    assert User.objects.count() == 1
    # user is active
    assert User.objects.first().is_active == True
    # correctly updates other fields
    assert InvitationToken.objects.count() == 0 # invitation token is deleted
    assert User.objects.first().first_name == "John"    
    assert User.objects.first().last_name == "Doe"
    assert User.objects.first().email == "email@admin.com"
    assert User.objects.first().username == "email@admin.com"
    assert User.objects.first().profile.date_of_birth.strftime("%Y-%m-%d") == birth_date
    assert User.objects.first().profile.proficiency == Profile.FLUENT

@pytest.mark.django_db
def test_create_by_invitation_invalid_date_of_birth(api_client):
    token = InvitationToken(email="email@admin.com", role=Profile.ADMIN, organization="testorg", first_name="John", last_name="Doe")
    token.generate_token()
    token.save()
    birth_date = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
    response = api_client.post(
        "/api/users/create_by_invitation/",
        {
            "token": token.token,
            "email": "email@admin.com",
            "username": "email@admin.com",
            "password": "adminpassword",
            "first_name": "John",
            "last_name": "Doe",
            "profile": {
                "organization": "testorg",
                "proficiency": "Fluent",
                "date_of_birth": birth_date
            }
        },
        format="json",
    )
    assert "date_of_birth" in response.data["profile"] # invalid date of birth
    
    
@pytest.mark.django_db
def test_create_by_invitation_organization_not_required(api_client):
    token = InvitationToken(email="email@admin.com", role=Profile.ADMIN, first_name="John", last_name="Doe")
    token.generate_token()
    token.save()
    response = api_client.post(
        "/api/users/create_by_invitation/",
        {
            "token": token.token,
            "email": "email@admin.com",
            "username": "email@admin.com",
            "password": "adminpassword",
            "first_name": "John",
            "last_name": "Doe",
            "profile": {
                "date_of_birth": (datetime.now() - timedelta(days=365*20)).strftime("%Y-%m-%d"),
                "proficiency": "Fluent",
            }
        },
        format="json",
    )
    assert response.status_code == 201
    assert InvitationToken.objects.count() == 0 # invitation token is deleted
    assert response.data["profile"]["organization"] is None
    
@pytest.mark.django_db
def test_update_password_with_token(api_client):
    user = create_user(username="user", password="oldpassword", role=Profile.USER)
    token = PasswordResetToken(user=user)
    token.generate_token()
    token.save()
    response = api_client.patch(
        "/api/users/update_password_token/",
        {"token": token.token, "password": "newpassword"},
        format="json",
    )
    assert response.status_code == 200
    user.refresh_from_db()
    assert user.check_password("newpassword")
    
@pytest.mark.django_db
def test_update_password_token_expired_token(api_client):
    user = create_user(username="user", password="oldpassword", role=Profile.USER)
    token = PasswordResetToken(user=user)
    token.generate_token()
    token.save()
    token.expires_at = timezone.now() - timedelta(days=1)
    token.save()
    # mock timezone will give a date of now() = + 2 so token should be expired. 
    response = api_client.patch(
        "/api/users/update_password_token/",
        {"token": token.token, "password": "newpassword"},
        format="json",
    )
    assert response.status_code == 400
    assert response.data["detail"] == "Token has expired"
    
@pytest.mark.django_db
def test_update_password(api_client):
    user = create_user(username="user", password="oldpassword", role=Profile.USER)
    token, _ = Token.objects.get_or_create(user=user)
    api_client.credentials(HTTP_AUTHORIZATION="Token " + token.key)
    response = api_client.patch(
        "/api/users/update_password/",
        {"new_password": "newpassword", "old_password": "oldpassword"},
        format="json",
    )
    assert response.status_code == 200
    user.refresh_from_db()
    assert user.check_password("newpassword") # check correct update
    
@pytest.mark.django_db
def test_update_password_incorrect_old_password(api_client):
    user = create_user(username="user", password="oldpassword", role=Profile.USER)
    token, _ = Token.objects.get_or_create(user=user)
    api_client.credentials(HTTP_AUTHORIZATION="Token " + token.key)
    response = api_client.patch(
        "/api/users/update_password/",
        {"password": "newpassword", "old_password": "wrongpassword"},
        format="json",
    )
    assert response.status_code == 400
    assert response.data["detail"] == "Old password is incorrect"
    
@pytest.mark.django_db
def test_change_user_role_permission_denied_nativeadmin(api_client):
    user = create_user(username="user", password="testpassword", role=Profile.NATIVEADMIN)
    token, _ = Token.objects.get_or_create(user=user)
    api_client.credentials(HTTP_AUTHORIZATION="Token " + token.key)
    response = api_client.patch(
        f"/api/users/{user.id}/update_user_role/",
        {"role": Profile.ADMIN},
        format="json",
    )
    print(response.data)
    assert response.status_code == 400  # Nativeadmins cant grant admins
    
@pytest.mark.django_db
def test_change_user_role_permission_denied_user(api_client):
    user = create_user(username="user", password="testpassword", role=Profile.USER)
    token, _ = Token.objects.get_or_create(user=user)
    api_client.credentials(HTTP_AUTHORIZATION="Token " + token.key)
    response = api_client.patch(
        f"/api/users/{user.id}/update_user_role/",
        {"role": Profile.NATIVEADMIN},
        format="json",
    )
    assert response.status_code == 403  # Assuming only admins or nativeadmins can change status


@pytest.mark.django_db
def test_change_user_role(api_client, admin_auth):
    user = create_user(username="user", password="testpassword", role=Profile.USER)
    response = api_client.patch(
        f"/api/users/{user.id}/update_user_role/",
        {"role": Profile.ADMIN},
        format="json",
    )
    assert response.status_code == 200  # Assuming only admins can change status
    assert response.data["profile"]["role"] == Profile.ADMIN


@pytest.mark.django_db
def test_update_user_profile(api_client, admin_auth):
    new_birth_date = (datetime.now() - timedelta(days=365*25)).strftime("%Y-%m-%d")
    data = {
        "first_name": "John",
        "last_name": "Doe",
        "profile": {
            "date_of_birth": new_birth_date,
        }
    }
    response = api_client.patch(
        "/api/users/update_user_profile/",
        data,
        format="json",
    )
    assert response.status_code == 200 
    assert response.data["first_name"] == "John"
    assert response.data["last_name"] == "Doe"
    assert User.objects.first().first_name == "John"
    assert User.objects.first().last_name == "Doe"
    assert User.objects.first().profile.date_of_birth.strftime("%Y-%m-%d") == new_birth_date
    
@pytest.mark.django_db
def test_update_user_profile_invalid_data(api_client, user_auth):
    
    data = {
        "profile": {
            "role": Profile.ADMIN,
        }   
    }
    response = api_client.patch(
        f"/api/users/update_user_profile/",
        data,
        format="json",
    )
    # invalid change role in update (no change)
    assert User.objects.first().profile.role == Profile.USER 
