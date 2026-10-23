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
"""Reviewing suggestions in "Explorar datos": who sent each one and when, the
ones already in use because their author is trusted, and the "Sugerencias"
rule of Visibilidad (who may send them)."""
from datetime import datetime, timedelta

import pytest
from customization.access import clear_cache
from customization.models import TranslatorCustomization
from customization.schema import validate_config
from django.contrib.auth.models import User
from fixtures import (  # noqa: F401
    api_client,
    create_languages,
    native_admin_auth,
    user_auth,
)
from main.models import GeneralSuggestion, Profile, TranslationPair
from rest_framework.test import APIClient
from test_visibility_and_labels import publish_access


def _author(username, trusted=False, **names):
    user = User.objects.create_user(
        username=username, email=f"{username}@example.com", password="pw", **names
    )
    Profile.objects.create(
        user=user,
        trusted_feedback=trusted,
        date_of_birth=datetime.now() - timedelta(days=365 * 20),
    )
    return user


def _correction(spanish, rapanui, user=None, **extra):
    fields = dict(
        src_text="Hola",
        dst_text="del modelo",
        suggestion="corregida",
        src_lang=spanish,
        dst_lang=rapanui,
        feedback=False,
        user=user,
    )
    fields.update(extra)
    return TranslationPair.objects.create(**fields)


def _feedback(client, path, spanish, rapanui):
    return client.post(
        f"/api/suggestions/{path}/",
        {
            "src_text": "Hola",
            "dst_text": "Iorana",
            "suggestion": "Iorana koe",
            "src_lang": {"code": spanish.code},
            "dst_lang": {"code": rapanui.code},
        },
        format="json",
    )


# --- who sent it and when ---------------------------------------------------


@pytest.mark.django_db
def test_each_suggestion_says_who_sent_it_and_when(
    api_client, native_admin_auth, create_languages
):
    _, spanish, rapanui, _ = create_languages
    named = _author("ana", first_name="Ana", last_name="Pérez")
    unnamed = _author("sin_nombre")
    _correction(spanish, rapanui, user=named)
    _correction(spanish, rapanui, user=unnamed)
    _correction(spanish, rapanui, user=None)

    results = api_client.get("/api/suggestions/", {"validated": "false"}).data[
        "results"
    ]
    assert [r["user_name"] for r in results] == [None, "sin_nombre@example.com", "Ana Pérez"]
    assert all(r["created_at"] for r in results)


# --- in use without validation --------------------------------------------------


@pytest.mark.django_db
def test_in_use_lists_only_the_trusted_suggestions_the_translator_uses(
    api_client, native_admin_auth, create_languages
):
    _, spanish, rapanui, _ = create_languages
    trusted = _author("confiable", trusted=True)
    other = _author("otro")
    used = _correction(spanish, rapanui, user=trusted)
    _correction(spanish, rapanui, user=other)  # not trusted
    _correction(spanish, rapanui, user=None)  # anonymous
    _correction(spanish, rapanui, user=trusted, is_uncertain=True)  # "no sé"
    _correction(spanish, rapanui, user=trusted, suggestion="del modelo")  # no change
    _correction(  # already reviewed
        spanish, rapanui, user=trusted, validated=True, correct=False
    )

    response = api_client.get(
        "/api/suggestions/", {"validated": "false", "in_use": "true"}
    )
    assert [r["id"] for r in response.data["results"]] == [used.id]

    # no longer in use once its author stops being trusted
    Profile.objects.filter(user=trusted).update(trusted_feedback=False)
    response = api_client.get(
        "/api/suggestions/", {"validated": "false", "in_use": "true"}
    )
    assert response.data["count"] == 0


# --- who may send suggestions -------------------------------------------------


@pytest.mark.django_db
@pytest.mark.parametrize(
    "path", ["accept_translation", "reject_translation"]
)
def test_anonymous_visitors_may_send_suggestions_by_default(
    api_client, create_languages, path
):
    _, spanish, rapanui, _ = create_languages
    assert _feedback(api_client, path, spanish, rapanui).status_code == 201


@pytest.mark.django_db
@pytest.mark.parametrize(
    "path", ["accept_translation", "reject_translation"]
)
def test_a_login_rule_keeps_anonymous_suggestions_out(
    api_client, create_languages, path
):
    _, spanish, rapanui, _ = create_languages
    publish_access(suggestions={"level": "login", "roles": []})
    clear_cache()
    assert _feedback(APIClient(), path, spanish, rapanui).status_code in (401, 403)
    assert not TranslationPair.objects.exists()


@pytest.mark.django_db
def test_a_login_rule_lets_users_send_suggestions(
    api_client, user_auth, create_languages
):
    _, spanish, rapanui, _ = create_languages
    publish_access(suggestions={"level": "login", "roles": []})
    clear_cache()
    response = _feedback(api_client, "reject_translation", spanish, rapanui)
    assert response.status_code == 201
    assert TranslationPair.objects.get().user == user_auth


@pytest.mark.django_db
def test_the_rule_also_covers_general_comments(api_client, create_languages):
    publish_access(suggestions={"level": "login", "roles": []})
    clear_cache()
    response = APIClient().post(
        "/api/suggestions/add_suggestion/", {"comment": "Hola"}, format="json"
    )
    assert response.status_code in (401, 403)
    assert not GeneralSuggestion.objects.exists()


@pytest.mark.django_db
def test_rules_published_before_it_existed_keep_suggestions_public(
    api_client, create_languages
):
    _, spanish, rapanui, _ = create_languages
    publish_access()  # no "suggestions" rule
    clear_cache()
    body = api_client.get("/api/customization/config/").json()
    assert body["access"]["suggestions"] == {"level": "public", "roles": []}
    assert _feedback(api_client, "accept_translation", spanish, rapanui).status_code == 201


def test_documents_without_the_rule_still_validate():
    from customization.tests.test_schema import load_preset

    document = load_preset("arn")
    del document["access"]["suggestions"]
    assert validate_config(document)["access"]["suggestions"] == {
        "level": "public",
        "roles": [],
    }
