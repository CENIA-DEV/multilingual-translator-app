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
from rest_framework.routers import DefaultRouter

from .views import (
    InvitationViewSet,
    LanguageViewSet,
    PasswordResetViewSet,
    RequestViewSet,
    SuggestionViewSet,
    TranslateViewSet,
    UserViewSet,
)

router = DefaultRouter()
router.register(r"users", UserViewSet, basename="user")
router.register(r"invitations", InvitationViewSet, basename="invitation")
router.register(r"suggestions", SuggestionViewSet, basename="suggestion")
router.register(r"requests", RequestViewSet, basename="request")
router.register(r"password_reset", PasswordResetViewSet, basename="password_reset")
router.register(r"translate", TranslateViewSet, basename="translate")
router.register(r"languages", LanguageViewSet, basename="language")
urlpatterns = router.urls
