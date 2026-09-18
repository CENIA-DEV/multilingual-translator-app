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
"""Admin list endpoints return rows in a stable, meaningful order."""

from datetime import timedelta

import pytest
from django.utils import timezone
from fixtures import admin_auth, api_client  # noqa: F401
from main.models import InvitationToken, Lang, RequestAccess


def backdate(obj, days):
    """Pin created_at so the expected order never depends on insert timing."""
    type(obj).objects.filter(pk=obj.pk).update(
        created_at=timezone.now() - timedelta(days=days)
    )


@pytest.mark.django_db
def test_languages_are_listed_by_name(api_client):  # noqa: F811
    Lang.objects.create(code="rap", name="Rapa Nui")
    Lang.objects.create(code="arn", name="Mapuzungun")
    Lang.objects.create(code="spa", name="Castellano")

    response = api_client.get("/api/languages/")

    assert response.status_code == 200
    assert [lang["name"] for lang in response.data] == [
        "Castellano",
        "Mapuzungun",
        "Rapa Nui",
    ]


@pytest.mark.django_db
def test_invitations_are_listed_newest_first(api_client, admin_auth):  # noqa: F811
    for days, email in ((3, "old@example.com"), (1, "new@example.com")):
        invitation = InvitationToken.objects.create(
            email=email,
            first_name="Ana",
            last_name="Tuki",
            token=f"token-{email}",
            expires_at=timezone.now() + timedelta(days=1),
        )
        backdate(invitation, days)

    response = api_client.get("/api/invitations/")

    assert response.status_code == 200
    assert [row["email"] for row in response.data] == [
        "new@example.com",
        "old@example.com",
    ]


@pytest.mark.django_db
def test_requests_are_listed_newest_first(api_client, admin_auth):  # noqa: F811
    for days, email in ((5, "oldest@example.com"), (1, "newest@example.com")):
        backdate(
            RequestAccess.objects.create(
                email=email, first_name="Ana", last_name="Tuki", organization="org"
            ),
            days,
        )

    listed = api_client.get("/api/requests/")
    pending = api_client.get("/api/requests/get_pending_requests/")

    expected = ["newest@example.com", "oldest@example.com"]
    assert listed.status_code == 200
    assert [row["email"] for row in listed.data] == expected
    assert pending.status_code == 200
    assert [row["email"] for row in pending.data] == expected
