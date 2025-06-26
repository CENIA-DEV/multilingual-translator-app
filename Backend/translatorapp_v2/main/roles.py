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
from django.conf import settings
from main.models import Profile
from rest_framework import permissions


class VerifyRolePermission(permissions.BasePermission):

    def __init__(self, role):
        self.role = role

    def has_permission(self, request, view):
        # checks user is authenticated and verifies role
        return request.user.is_authenticated and request.user.profile.role == self.role


class IsNativeAdmin(VerifyRolePermission):

    def __init__(self):
        super().__init__(role=Profile.NATIVEADMIN)


class IsAdmin(VerifyRolePermission):

    def __init__(self):
        super().__init__(role=Profile.ADMIN)


class TranslationRequiresAuth(permissions.BasePermission):
    """
    Dynamic permission that requires authentication only if
    TRANSLATION_REQUIRES_AUTH is True. If TRANSLATION_REQUIRES_AUTH
    is False, allows all users.
    """

    def has_permission(self, request, view):
        translation_requires_auth = getattr(
            settings, "TRANSLATION_REQUIRES_AUTH", False
        )

        if not translation_requires_auth:
            return True

        return request.user and request.user.is_authenticated
