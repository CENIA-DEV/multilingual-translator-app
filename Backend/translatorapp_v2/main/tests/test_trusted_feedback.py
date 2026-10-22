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
"""Trusted users: suggestions that answer from the cache without validation."""
from datetime import datetime, timedelta

import pytest
from django.contrib.auth.models import User
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import override_settings
from fixtures import (  # noqa: F401
    admin_auth,
    api_client,
    create_languages,
    mock_get_prediction,
    user_auth,
)
from main.models import Profile, TranslationPair
from main.serializers import LanguageSerializer
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient


def _client_for(username, role=Profile.USER, trusted=False):
    """A user (with profile) and an API client logged in as them."""
    user = User.objects.create_user(
        username=username, email=f"{username}@example.com", password="pw"
    )
    Profile.objects.create(
        user=user,
        role=role,
        trusted_feedback=trusted,
        date_of_birth=datetime.now() - timedelta(days=365 * 20),
    )
    client = APIClient()
    client.credentials(
        HTTP_AUTHORIZATION=f"Token {Token.objects.get_or_create(user=user)[0].key}"
    )
    return user, client


def _set_trusted(user, trusted):
    Profile.objects.filter(user=user).update(trusted_feedback=trusted)


def _correct(client, src_lang, dst_lang, src_text, model_text, suggestion, **extra):
    """A thumbs-down with the user's correction, as the feedback modal sends it."""
    response = client.post(
        "/api/suggestions/reject_translation/",
        {
            "src_text": src_text,
            "dst_text": model_text,
            "suggestion": suggestion,
            "src_lang": {"code": src_lang.code},
            "dst_lang": {"code": dst_lang.code},
            "model_name": "NativeModel",
            "model_version": "V1",
            **extra,
        },
        format="json",
    )
    assert response.status_code == 201, response.data
    return TranslationPair.objects.get(pk=response.data["id"])


def _translate(text, src_lang, dst_lang):
    response = APIClient().post(
        "/api/translate/",
        {
            "src_text": text,
            "src_lang": LanguageSerializer(src_lang).data,
            "dst_lang": LanguageSerializer(dst_lang).data,
        },
        format="json",
    )
    assert response.status_code == 200, response.data
    return response.data["dst_text"]


@pytest.mark.django_db
def test_profiles_start_untrusted():
    user = User.objects.create_user(username="nuevo", password="pw")
    profile = Profile.objects.create(user=user, date_of_birth=datetime(2000, 1, 1))
    assert profile.trusted_feedback is False


@pytest.mark.django_db(transaction=True)
def test_users_existing_before_the_migration_start_untrusted():
    """Production and staging users: none ends up trusted by migrating."""
    before = [("main", "0062_word_variant_labels")]
    after = [("main", "0063_profile_trusted_feedback")]
    executor = MigrationExecutor(connection)
    executor.migrate(before)
    old = executor.loader.project_state(before).apps
    for role in (Profile.ADMIN, Profile.NATIVEADMIN, Profile.USER):
        user = old.get_model("auth", "User").objects.create(username=role)
        old.get_model("main", "Profile").objects.create(
            user=user, role=role, date_of_birth=datetime(2000, 1, 1)
        )

    executor = MigrationExecutor(connection)
    executor.migrate(after)
    profiles = executor.loader.project_state(after).apps.get_model("main", "Profile")
    assert profiles.objects.count() == 3
    assert not profiles.objects.filter(trusted_feedback=True).exists()

    executor = MigrationExecutor(connection)
    executor.migrate(executor.loader.graph.leaf_nodes())


@pytest.mark.django_db
@override_settings(TRANSLATION_REQUIRES_AUTH=False)
def test_correction_waits_for_validation_until_the_author_is_trusted(
    create_languages, mock_get_prediction
):
    _, spanish, rapanui, _ = create_languages
    author, client = _client_for("hablante")
    _correct(client, spanish, rapanui, "Hola", "Iorana", "Iorana koe")

    assert _translate("hola", spanish, rapanui) == "Iorana"  # the model

    _set_trusted(author, True)
    assert _translate("hola", spanish, rapanui) == "Iorana koe"
    # the other direction answers with the source text of the correction
    assert _translate("iorana koe", rapanui, spanish) == "Hola"

    # read at translation time: turning it off takes the correction out again
    _set_trusted(author, False)
    assert _translate("hola", spanish, rapanui) == "Iorana"


@pytest.mark.django_db
@override_settings(TRANSLATION_REQUIRES_AUTH=False)
def test_only_feedback_that_says_something_is_used(
    create_languages, mock_get_prediction
):
    english, spanish, rapanui, _ = create_languages
    _, client = _client_for("hablante", trusted=True)
    # a thumbs-down without changing the text, and "no sé cómo"
    _correct(client, spanish, rapanui, "Hola", "Iorana", "Iorana")
    _correct(client, spanish, rapanui, "Hola", "Iorana", "Iorana ra", is_uncertain=True)
    assert _translate("hola", spanish, rapanui) == "Iorana"
    assert mock_get_prediction.call_count == 1

    # a thumbs-up confirms the model's translation
    response = client.post(
        "/api/suggestions/accept_translation/",
        {
            "src_text": "Gracias",
            "dst_text": "Maururu",
            "src_lang": {"code": spanish.code},
            "dst_lang": {"code": rapanui.code},
            "model_name": "NativeModel",
            "model_version": "V1",
        },
        format="json",
    )
    assert response.status_code == 201
    assert _translate("gracias", spanish, rapanui) == "Maururu"
    assert mock_get_prediction.call_count == 1


@pytest.mark.django_db
@override_settings(TRANSLATION_REQUIRES_AUTH=False)
def test_newest_matching_pair_answers(create_languages, mock_get_prediction):
    _, spanish, rapanui, _ = create_languages
    _, trusted = _client_for("confiable", trusted=True)
    TranslationPair.objects.create(
        src_text="hola", dst_text="Iorana (validada)", src_lang=spanish,
        dst_lang=rapanui, correct=True, validated=True,
    )
    _correct(trusted, spanish, rapanui, "Hola", "Iorana", "Iorana (confiable)")
    assert _translate("hola", spanish, rapanui) == "Iorana (confiable)"

    TranslationPair.objects.create(
        src_text="hola", dst_text="Iorana (validada, nueva)", src_lang=spanish,
        dst_lang=rapanui, correct=True, validated=True,
    )
    assert _translate("hola", spanish, rapanui) == "Iorana (validada, nueva)"
    mock_get_prediction.assert_not_called()


@pytest.mark.django_db
@override_settings(TRANSLATION_REQUIRES_AUTH=False)
def test_inactive_users_are_not_trusted(create_languages, mock_get_prediction):
    _, spanish, rapanui, _ = create_languages
    author, client = _client_for("hablante", trusted=True)
    _correct(client, spanish, rapanui, "Hola", "Iorana", "Iorana koe")
    User.objects.filter(pk=author.pk).update(is_active=False)
    assert _translate("hola", spanish, rapanui) == "Iorana"


@pytest.mark.django_db
@override_settings(TRANSLATION_REQUIRES_AUTH=False)
def test_review_still_decides(api_client, admin_auth, create_languages, mock_get_prediction):
    _, spanish, rapanui, _ = create_languages
    _, client = _client_for("hablante", trusted=True)
    pair = _correct(client, spanish, rapanui, "Hola", "Iorana", "Iorana koe")
    # it stays in the review queue
    pending = api_client.get("/api/suggestions/", {"validated": "false"})
    assert pair.id in [s["id"] for s in pending.data["results"]]

    response = api_client.patch(f"/api/suggestions/{pair.id}/reject_suggestion/", {})
    assert response.status_code == 200
    assert _translate("hola", spanish, rapanui) == "Iorana"


@pytest.mark.django_db
def test_toggle_is_for_admins(api_client, admin_auth):
    member, member_client = _client_for("hablante")
    url = f"/api/users/{member.id}/update_trusted_feedback/"

    # a user can't trust anyone, themselves included
    response = member_client.patch(url, {"trusted_feedback": True}, format="json")
    assert response.status_code == 403
    response = member_client.patch(
        "/api/users/update_user_profile/",
        {"profile": {"trusted_feedback": True}},
        format="json",
    )
    member.profile.refresh_from_db()
    assert member.profile.trusted_feedback is False

    response = api_client.patch(url, {"trusted_feedback": "sí"}, format="json")
    assert response.status_code == 400

    response = api_client.patch(url, {"trusted_feedback": True}, format="json")
    assert response.status_code == 200
    assert response.data["profile"]["trusted_feedback"] is True
    member.profile.refresh_from_db()
    assert member.profile.trusted_feedback is True
    assert member.profile.role == Profile.USER  # the role is kept

    listed = api_client.get("/api/users/").data
    assert next(u for u in listed if u["id"] == member.id)["profile"]["trusted_feedback"]

    # nor can the role endpoint set it
    api_client.patch(url, {"trusted_feedback": False}, format="json")
    api_client.patch(
        f"/api/users/{member.id}/update_user_role/",
        {"role": Profile.USER, "trusted_feedback": True},
        format="json",
    )
    member.profile.refresh_from_db()
    assert member.profile.trusted_feedback is False


@pytest.mark.django_db
@override_settings(TRANSLATION_REQUIRES_AUTH=False)
def test_administrators_follow_their_own_switch(create_languages, mock_get_prediction):
    """Being an administrator does not make one's suggestions trusted."""
    _, spanish, rapanui, _ = create_languages
    admin, client = _client_for("administradora", role=Profile.NATIVEADMIN)
    _correct(client, spanish, rapanui, "Hola", "Iorana", "Iorana koe")
    assert _translate("hola", spanish, rapanui) == "Iorana"  # the model

    # they turn their own switch on, and then off
    url = f"/api/users/{admin.id}/update_trusted_feedback/"
    response = client.patch(url, {"trusted_feedback": True}, format="json")
    assert response.status_code == 200
    assert _translate("hola", spanish, rapanui) == "Iorana koe"
    response = client.patch(url, {"trusted_feedback": False}, format="json")
    assert response.status_code == 200
    assert _translate("hola", spanish, rapanui) == "Iorana"
