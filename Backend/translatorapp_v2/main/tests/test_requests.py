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
from fixtures import admin_auth, api_client
from main.models import RequestAccess, InvitationToken, Profile
from test_users import create_user

# 1. create - Success (Unauthenticated)
@pytest.mark.django_db
def test_create_request_success_unauthenticated(api_client):
    url = "/api/requests/"
    data = {
        "first_name": "John",
        "last_name": "Doe",
        "email": "john.doe@example.com",
        "reason": RequestAccess.CURIOSITY,
        "organization": "test_organization",
    }

    response = api_client.post(url, data, format="json")

    assert response.status_code == 201  # Created
    assert RequestAccess.objects.count() == 1
    request = RequestAccess.objects.first()
    assert request.email == "john.doe@example.com"
    assert request.reason == RequestAccess.CURIOSITY
    assert request.approved is None  # Pending approval


# 2. create - Invalid Data
@pytest.mark.django_db
def test_create_request_invalid_data(api_client):
    url = "/api/requests/"
    data = {
        "first_name": "John",
        "reason": RequestAccess.CURIOSITY,
    }  # Missing email and last name

    response = api_client.post(url, data, format="json")

    assert response.status_code == 400
    assert RequestAccess.objects.count() == 0  # check no object created
    assert "email" in response.data  # missing email
    assert "last_name" in response.data  # missing last name
    assert "organization" not in response.data  # organization is not required 
    assert "reason" not in response.data  # reason is not required

# 3. create - Fail User duplicated
@pytest.mark.django_db
def test_create_request_user_duplicated_active(api_client):
    url = "/api/requests/"
    user = create_user(
        username="john.doe@example.com",
        password="activepassword",
        role=Profile.NATIVEADMIN,
        is_active=True,
    )
    data = {
        "first_name": "John",
        "last_name": "Doe",
        "email": "john.doe@example.com",
        "organization": "test_organization",
        "reason": RequestAccess.WORK,
    }

    response = api_client.post(url, data, format="json")

    assert response.status_code == 400
    assert RequestAccess.objects.count() == 0  # check no object created
    assert "email" in response.data  # duplicate email
    

# 4. create - Success User duplicated but inactive 
@pytest.mark.django_db
def test_create_request_user_duplicated_inactive(api_client):
    url = "/api/requests/"
    user = create_user(
        username="john.doe@example.com",
        password="activepassword",
        role=Profile.NATIVEADMIN,
        is_active=False,
    )
    data = {
        "first_name": "John",
        "last_name": "Doe",
        "email": "john.doe@example.com",
        "reason": RequestAccess.WORK,
        "organization": "test_organization",
    }

    response = api_client.post(url, data, format="json")

    assert response.status_code == 201  # Created
    assert RequestAccess.objects.count() == 1
    request = RequestAccess.objects.first()
    assert request.email == "john.doe@example.com"

# 5. get_pending_requests - Success (Authenticated)
@pytest.mark.django_db
def test_get_pending_requests_success(api_client, admin_auth):
    RequestAccess.objects.create(
        first_name="John", last_name="Doe", email="pending@example.com", organization="test_organization",
        reason=RequestAccess.CURIOSITY
    )
    RequestAccess.objects.create(
        first_name="Charlie",
        last_name="Wonka",
        email="approved@example.com",
        approved=True,
        organization="test_organization",
        reason=RequestAccess.CURIOSITY
    )

    url = "/api/requests/get_pending_requests/"

    response = api_client.get(url)

    assert response.status_code == 200
    assert len(response.data) == 1  # Only one pending request
    assert response.data[0]["email"] == "pending@example.com"


# 6. get_pending_requests - Unauthorized
@pytest.mark.django_db
def test_get_pending_requests_unauthorized(api_client):
    url = "/api/requests/get_pending_requests/"

    response = api_client.get(url)

    assert response.status_code == 401  # Unauthorized request


# 7. Approve request - Success (Authenticated)
@pytest.mark.django_db
def test_get_pending_requests_unauthorized(api_client, admin_auth):
    request = RequestAccess.objects.create(
        first_name="John", last_name="Doe", email="pending@example.com", organization="test_organization",
        reason=RequestAccess.CURIOSITY  
    )
    url = f"/api/requests/{request.pk}/"
    data = {"approved": True}
    response = api_client.patch(url, data, format="json")

    assert response.status_code == 200
    assert response.data["approved"]
    assert RequestAccess.objects.first().approved
    
# 8. Create Request - Fail (Missing Organization)
@pytest.mark.django_db
def test_create_request_fail_missing_organization(api_client):
    url = "/api/requests/"
    data = {
        "first_name": "Charlie",
        "last_name": "Wonka",
        "email": "approved@example.com",
        "reason": RequestAccess.WORK
    }
    response = api_client.post(url, data, format="json")
    assert response.status_code == 400
    assert "organization" in response.data # missing organization