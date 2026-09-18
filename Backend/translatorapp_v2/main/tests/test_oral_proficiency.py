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
import datetime

import pytest
from django.contrib.auth.models import User
from fixtures import api_client, user_auth
from main.models import InvitationToken, Profile
from main.serializers import FullProfileSerializer, ProfileSerializer


@pytest.fixture
def profile():
    user = User.objects.create_user(
        username="testuser", password="password", email="test@example.com"
    )
    return Profile.objects.create(
        user=user,
        date_of_birth=datetime.date(1990, 1, 1),
        proficiency=Profile.BEGINNER,
        oral_proficiency=Profile.NON_SPEAKER,
    )


@pytest.mark.django_db
def test_profile_creation_with_oral_proficiency(profile):
    """Test that oral_proficiency is correctly saved."""
    assert profile.oral_proficiency == Profile.NON_SPEAKER

    profile2 = Profile.objects.create(
        user=User.objects.create_user(username="testuser2"),
        date_of_birth=datetime.date(1995, 5, 5),
        oral_proficiency=Profile.BASIC,
    )
    assert profile2.oral_proficiency == Profile.BASIC


@pytest.mark.django_db
def test_oral_proficiency_defaults_to_non_speaker():
    profile = Profile.objects.create(
        user=User.objects.create_user(username="testuser3"),
        date_of_birth=datetime.date(1995, 5, 5),
    )
    assert profile.oral_proficiency == Profile.NON_SPEAKER


@pytest.mark.django_db
def test_profile_serializer_includes_oral_proficiency(profile):
    """Test that ProfileSerializer includes and handles oral_proficiency."""
    serializer = ProfileSerializer(instance=profile)
    assert "oral_proficiency" in serializer.data
    assert serializer.data["oral_proficiency"] == Profile.NON_SPEAKER

    data = {"oral_proficiency": Profile.FLUENT, "date_of_birth": "1990-01-01"}
    serializer = ProfileSerializer(instance=profile, data=data, partial=True)
    assert serializer.is_valid()
    serializer.save()
    profile.refresh_from_db()
    assert profile.oral_proficiency == Profile.FLUENT


@pytest.mark.django_db
def test_full_profile_serializer_includes_oral_proficiency(profile):
    """Test that FullProfileSerializer includes and handles oral_proficiency."""
    serializer = FullProfileSerializer(instance=profile)
    assert "oral_proficiency" in serializer.data
    assert serializer.data["oral_proficiency"] == Profile.NON_SPEAKER

    data = {"oral_proficiency": Profile.BASIC, "date_of_birth": "1990-01-01"}
    serializer = FullProfileSerializer(instance=profile, data=data, partial=True)
    assert serializer.is_valid()
    serializer.save()
    profile.refresh_from_db()
    assert profile.oral_proficiency == Profile.BASIC


@pytest.mark.django_db
def test_serializer_rejects_invalid_oral_proficiency(profile):
    # "Beginner" is a written-proficiency level, not an oral one
    data = {"oral_proficiency": Profile.BEGINNER}
    serializer = ProfileSerializer(instance=profile, data=data, partial=True)
    assert not serializer.is_valid()
    assert "oral_proficiency" in serializer.errors


@pytest.mark.django_db
def test_create_by_invitation_with_oral_proficiency(api_client):
    token = InvitationToken(
        email="email@admin.com",
        role=Profile.USER,
        first_name="John",
        last_name="Doe",
    )
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
                "proficiency": Profile.BEGINNER,
                "oral_proficiency": Profile.FLUENT,
                "date_of_birth": "1990-01-01",
            },
        },
        format="json",
    )
    assert response.status_code == 201
    assert response.data["profile"]["proficiency"] == Profile.BEGINNER
    assert response.data["profile"]["oral_proficiency"] == Profile.FLUENT
    profile = User.objects.get(username="email@admin.com").profile
    assert profile.proficiency == Profile.BEGINNER
    assert profile.oral_proficiency == Profile.FLUENT


@pytest.mark.django_db
def test_get_by_token_returns_oral_proficiency(api_client, user_auth):
    response = api_client.get("/api/users/get_by_token/")
    assert response.status_code == 200
    assert response.data["profile"]["oral_proficiency"] == Profile.NON_SPEAKER


@pytest.mark.django_db
def test_update_user_profile_proficiencies(api_client, user_auth):
    response = api_client.patch(
        "/api/users/update_user_profile/",
        {
            "profile": {
                "proficiency": Profile.FLUENT,
                "oral_proficiency": Profile.BASIC,
            }
        },
        format="json",
    )
    assert response.status_code == 200
    assert response.data["profile"]["proficiency"] == Profile.FLUENT
    assert response.data["profile"]["oral_proficiency"] == Profile.BASIC
    user_auth.profile.refresh_from_db()
    assert user_auth.profile.proficiency == Profile.FLUENT
    assert user_auth.profile.oral_proficiency == Profile.BASIC
