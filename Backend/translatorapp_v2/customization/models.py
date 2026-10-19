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
import uuid

from django.contrib.auth.models import User
from django.db import models


class TranslatorCustomization(models.Model):
    """The one customization document of this deployment (always pk=1).

    ``published`` is what visitors see. ``draft`` holds edits that are not live
    yet; ``None`` means the draft is identical to the published version. Both
    are ``None`` until an admin saves for the first time, and the frontend then
    uses the preset for its variant. The version counters provide optimistic
    locking so two admins editing at once cannot overwrite each other silently.
    """

    draft = models.JSONField(null=True, blank=True)
    draft_version = models.PositiveIntegerField(default=0)
    draft_updated_at = models.DateTimeField(null=True, blank=True)
    draft_updated_by = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    published = models.JSONField(null=True, blank=True)
    published_version = models.PositiveIntegerField(default=0)
    published_at = models.DateTimeField(null=True, blank=True)
    published_by = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )

    class Meta:
        verbose_name = "personalización del traductor"
        verbose_name_plural = "personalización del traductor"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        # a publish (or restore) may change who can use what: apply it at once
        from .access import clear_cache

        clear_cache()

    @classmethod
    def load(cls):
        """Read-only access; an unsaved blank instance until the first save."""
        return cls.objects.filter(pk=1).first() or cls(pk=1)

    @classmethod
    def load_for_update(cls):
        """Row-locked access for writes. Call inside ``transaction.atomic()``."""
        cls.objects.get_or_create(pk=1)
        return cls.objects.select_for_update().get(pk=1)

    @property
    def working_copy(self):
        return self.draft if self.draft is not None else self.published

    @property
    def has_unpublished_changes(self):
        return self.draft is not None and self.draft != self.published

    def __str__(self):
        return f"Personalización (publicada v{self.published_version})"


class CustomizationRevision(models.Model):
    """A snapshot taken every time the customization is published."""

    version = models.PositiveIntegerField()
    data = models.JSONField()
    note = models.CharField(max_length=300, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return f"Versión {self.version} ({self.created_at:%Y-%m-%d %H:%M})"


class CustomizationAsset(models.Model):
    """An image or map file uploaded from the editor.

    Stored in the database next to the document that references it: the files
    are small (the editor compresses images before uploading), they are backed
    up with everything else and no public bucket is needed. The content never
    changes -- the id is served with an immutable cache header -- and identical
    uploads are de-duplicated by hash.
    """

    IMAGE = "image"
    GEOJSON = "geojson"
    KINDS = [(IMAGE, "Imagen"), (GEOJSON, "Mapa (GeoJSON)")]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    kind = models.CharField(max_length=20, choices=KINDS, default=IMAGE)
    sha256 = models.CharField(max_length=64, unique=True)
    content_type = models.CharField(max_length=100)
    data = models.BinaryField()
    size = models.PositiveIntegerField()
    width = models.PositiveIntegerField(null=True, blank=True)
    height = models.PositiveIntegerField(null=True, blank=True)
    original_name = models.CharField(max_length=255, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )

    class Meta:
        ordering = ["-created_at"]

    @property
    def ref(self):
        return f"asset:{self.id}"

    def __str__(self):
        return self.original_name or str(self.id)
