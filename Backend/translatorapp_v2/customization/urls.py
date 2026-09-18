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
from django.urls import path

from . import views

urlpatterns = [
    path("config/", views.PublishedConfigView.as_view(), name="customization-config"),
    path("draft/", views.DraftView.as_view(), name="customization-draft"),
    path("publish/", views.PublishView.as_view(), name="customization-publish"),
    path("discard/", views.DiscardView.as_view(), name="customization-discard"),
    path(
        "revisions/", views.RevisionListView.as_view(), name="customization-revisions"
    ),
    path(
        "revisions/<int:pk>/",
        views.RevisionDetailView.as_view(),
        name="customization-revision",
    ),
    path(
        "revisions/<int:pk>/restore/",
        views.RevisionRestoreView.as_view(),
        name="customization-revision-restore",
    ),
    path("assets/", views.AssetListView.as_view(), name="customization-assets"),
    path(
        "assets/<uuid:pk>/",
        views.AssetFileView.as_view(),
        name="customization-asset-file",
    ),
]
