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
"""Who may use each feature ("Visibilidad" in Administrar Traductor).

The rules live in the published customization document (`access`), so the
top-tier admins change them without a deployment, and this module enforces
them on the API: the frontend reads the same rules, but only to show or hide
things. Until a document with rules is published, the defaults below apply;
they keep the behaviour of the old deployment variables.

Rules are cached per process for a few seconds, so a check costs no query; a
publish clears the cache of the process that handled it, and the others pick
the change up within CACHE_SECONDS.
"""
import time

from django.conf import settings
from main.models import Profile
from main.roles import can_manage_translator
from rest_framework import permissions

from .models import TranslatorCustomization

# The features with a rule, in the order the editor lists them
FEATURES = (
    "translatorPage",
    "translation",
    "tts",
    "separateGenders",
    "asr",
    "wordInformation",
    "suggestions",
)
LEVELS = ("public", "login", "roles")
ROLES = (
    Profile.ADMIN,
    Profile.NATIVEADMIN,
    Profile.ANNOTATOR,
    Profile.NATIVE,
    Profile.USER,
)
MAX_WORDS_LIMIT = 2000
CACHE_SECONDS = 10

_cache = {"at": 0.0, "rules": None, "key": None}


def default_access():
    """The rules before any are published: those of the old variables.

    TRANSLATION_REQUIRES_AUTH guarded translation and, on the API, the voice
    features too; everything else was public.
    """
    login = {"level": "login", "roles": []}
    public = {"level": "public", "roles": []}
    translation = (
        login if getattr(settings, "TRANSLATION_REQUIRES_AUTH", False) else public
    )
    return {
        "translatorPage": dict(public),
        "translation": dict(translation),
        "tts": dict(translation),
        "separateGenders": dict(public),
        "asr": dict(translation),
        "wordInformation": dict(public),
        # rating, correcting or commenting a translation
        "suggestions": dict(public),
        "maintenance": False,
        "maxWordsTranslation": int(getattr(settings, "MAX_WORDS_TRANSLATION", 150)),
    }


def _merge(stored):
    rules = default_access()
    if not isinstance(stored, dict):
        return rules
    for feature in FEATURES:
        rule = stored.get(feature)
        if isinstance(rule, dict) and rule.get("level") in LEVELS:
            roles = [r for r in rule.get("roles") or [] if r in ROLES]
            rules[feature] = {"level": rule["level"], "roles": roles}
    if isinstance(stored.get("maintenance"), bool):
        rules["maintenance"] = stored["maintenance"]
    words = stored.get("maxWordsTranslation")
    if (
        isinstance(words, int)
        and not isinstance(words, bool)
        and 1 <= words <= MAX_WORDS_LIMIT
    ):
        rules["maxWordsTranslation"] = words
    return rules


def effective_access():
    """The rules in force: the published ones over the defaults (cached)."""
    now = time.monotonic()
    # the defaults come from settings: a change there is a new entry
    key = (
        getattr(settings, "TRANSLATION_REQUIRES_AUTH", False),
        getattr(settings, "MAX_WORDS_TRANSLATION", 150),
    )
    if (
        _cache["rules"] is None
        or _cache["key"] != key
        or now - _cache["at"] > CACHE_SECONDS
    ):
        published = TranslatorCustomization.load().published
        _cache["rules"] = _merge((published or {}).get("access"))
        _cache["at"] = now
        _cache["key"] = key
    return _cache["rules"]


def clear_cache():
    """After a publish: this process applies the new rules at once."""
    _cache["rules"] = None


def max_words():
    return effective_access()["maxWordsTranslation"]


def can_use(user, feature):
    """Whether `user` (anonymous or not) may use `feature`. Top-tier admins
    always may, so they can try what they restrict."""
    if can_manage_translator(user):
        return True
    rule = effective_access().get(feature) or {"level": "public", "roles": []}
    if rule["level"] == "public":
        return True
    if not (user and user.is_authenticated):
        return False
    if rule["level"] == "login":
        return True
    try:
        return user.profile.role in rule["roles"]
    except Exception:  # no profile: no role
        return False


def feature_access(*features):
    """A DRF permission requiring every one of `features`."""

    class FeatureAccess(permissions.BasePermission):
        message = "No tienes acceso a esta función."

        def has_permission(self, request, view):
            return all(can_use(request.user, feature) for feature in features)

    FeatureAccess.__name__ = "FeatureAccess_" + "_".join(features)
    return FeatureAccess
