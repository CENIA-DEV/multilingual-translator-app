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
from django.contrib import admin

from .models import CustomizationAsset, CustomizationRevision, TranslatorCustomization


@admin.register(TranslatorCustomization)
class TranslatorCustomizationAdmin(admin.ModelAdmin):
    list_display = ("id", "published_version", "published_at", "draft_version")
    readonly_fields = (
        "draft_version",
        "draft_updated_at",
        "draft_updated_by",
        "published_version",
        "published_at",
        "published_by",
    )


@admin.register(CustomizationRevision)
class CustomizationRevisionAdmin(admin.ModelAdmin):
    list_display = ("version", "note", "created_at", "created_by")
    readonly_fields = ("version", "data", "created_at", "created_by")


@admin.register(CustomizationAsset)
class CustomizationAssetAdmin(admin.ModelAdmin):
    list_display = ("original_name", "kind", "content_type", "size", "created_at")
    exclude = ("data",)
    readonly_fields = (
        "kind",
        "sha256",
        "content_type",
        "size",
        "width",
        "height",
        "created_at",
        "created_by",
    )
