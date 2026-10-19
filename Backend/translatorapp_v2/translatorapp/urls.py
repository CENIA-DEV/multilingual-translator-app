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
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from main.views import CustomAuthToken, ParticipateRequestEndpoint

urlpatterns = [
    path("admin/", admin.site.urls),
    path(
        "api/participate-request/",
        ParticipateRequestEndpoint.as_view(),
        name="participate-request",
    ),
    path("api/users/token/", CustomAuthToken.as_view(), name="token"),
    path("api-auth/", include("rest_framework.urls")),
    path("api/customization/", include("customization.urls")),
    path("api/", include("main.urls")),
]

# When serving uploads from the local filesystem during development, Django must
# also serve MEDIA_URL so the audio_url returned by the ASR endpoint resolves.
if settings.DEBUG and settings.USE_LOCAL_FILE_STORAGE:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
