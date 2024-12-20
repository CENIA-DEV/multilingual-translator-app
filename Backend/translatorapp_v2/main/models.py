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
import hashlib
import uuid
from datetime import timedelta

from django.contrib.auth.models import User
from django.db import models
from django.db.models.functions import Upper
from django.utils import timezone


class PasswordResetToken(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    token = models.CharField(max_length=128, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    def generate_token(self):
        while True:
            raw_token = str(uuid.uuid4())
            hash_object = hashlib.sha256()
            hash_object.update(raw_token.encode("utf-8"))
            hash_token = hash_object.hexdigest()
            if not PasswordResetToken.objects.filter(token=hash_token).exists():
                self.token = hash_token
                self.expires_at = timezone.now() + timedelta(hours=24)
                self.save()
                return raw_token

    def is_expired(self):
        return timezone.now() >= self.expires_at

    def __str__(self):
        return f"{self.token} | {self.is_expired()}"


class Script(models.Model):
    code = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=100)

    def __str__(self):
        return f"{self.code} {self.name}"


class Dialect(models.Model):
    code = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=100)

    def __str__(self):
        return f"{self.code} {self.name}"


class Lang(models.Model):
    code = models.CharField(max_length=50, unique=True)
    dialect = models.ForeignKey(Dialect, on_delete=models.SET_NULL, null=True)
    script = models.ForeignKey(Script, on_delete=models.SET_NULL, null=True)
    name = models.CharField(max_length=100, null=True)
    is_native = models.BooleanField(default=False)

    class Meta:
        indexes = [
            models.Index(fields=["code"]),
        ]


class TranslationPair(models.Model):
    src_lang = models.ForeignKey(
        Lang, related_name="src_pairs", on_delete=models.SET_NULL, null=True
    )
    dst_lang = models.ForeignKey(
        Lang, related_name="dst_pairs", on_delete=models.SET_NULL, null=True
    )
    src_text = models.CharField(max_length=10000)
    dst_text = models.CharField(max_length=10000)
    suggestion = models.CharField(max_length=10000, null=True)
    correct = models.BooleanField(null=True)
    feedback = models.BooleanField(null=True)
    validated = models.BooleanField(default=False)
    model_name = models.CharField(max_length=100, null=True)
    model_version = models.CharField(max_length=100, null=True)
    user = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name="user"
    )
    validated_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="validated_by",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["validated"]),
            models.Index(fields=["feedback"]),
            models.Index(fields=["correct"]),
            models.Index(fields=["src_lang", "dst_lang"]),
            models.Index(Upper("src_text"), Upper("dst_text"), name="text_index"),
        ]

    def __str__(self) -> str:
        return f"{self.src_lang}:{self.src_text} | \
            {self.dst_lang}:{self.dst_text}"


class InvitationToken(models.Model):
    email = models.CharField(max_length=128)
    first_name = models.CharField(max_length=120)
    last_name = models.CharField(max_length=128)
    organization = models.CharField(max_length=128, default=None, null=True)
    role = models.CharField(max_length=120, default="User")
    token = models.CharField(max_length=128, unique=True)
    invited_by = models.ForeignKey(
        User, on_delete=models.CASCADE, null=True, default=None
    )
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    def generate_token(self):
        while True:
            raw_token = str(uuid.uuid4())
            hash_object = hashlib.sha256()
            hash_object.update(raw_token.encode("utf-8"))
            hashed_token = hash_object.hexdigest()
            if not InvitationToken.objects.filter(token=hashed_token).exists():
                self.token = hashed_token
                self.expires_at = timezone.now() + timedelta(hours=48)
                self.save()
                return raw_token

    def is_expired(self):
        return timezone.now() >= self.expires_at

    def __str__(self) -> str:
        return f"{self.token} | {self.is_expired()}"


class RequestAccess(models.Model):

    CURIOSITY = "Curiosity"
    LEARNING = "Learning"
    WORK = "Work"
    COLLABORATION = "Collaboration"
    REASONS = [
        (CURIOSITY, "Curiosity"),
        (LEARNING, "Learning"),
        (WORK, "Work"),
        (COLLABORATION, "Collaboration"),
    ]
    email = models.CharField(max_length=128)
    first_name = models.CharField(max_length=120)
    last_name = models.CharField(max_length=128)
    organization = models.CharField(max_length=128, default=None, null=True)
    reason = models.CharField(max_length=120, default=CURIOSITY, choices=REASONS)
    approved = models.BooleanField(null=True)  # default is null
    created_at = models.DateTimeField(auto_now_add=True)


# Class to extend the default User class in Django
class Profile(models.Model):
    ADMIN = "Admin"
    NATIVEADMIN = "NativeAdmin"
    ANNOTATOR = "Annotator"
    NATIVE = "Native"
    USER = "User"
    NON_SPEAKER = "Non-Speaker"
    FLUENT = "Fluent"
    BEGINNER = "Beginner"
    ROLES = [
        (ADMIN, "Administrator"),
        (NATIVEADMIN, "Native-Administrator"),
        (ANNOTATOR, "Annotator"),
        (NATIVE, "Native"),
        (USER, "User"),
    ]
    PROFICIENCY = [
        (NON_SPEAKER, "Non-Speaker"),
        (FLUENT, "Fluent"),
        (BEGINNER, "Beginner"),
    ]
    date_joined = models.DateField(default=timezone.now)
    date_of_birth = models.DateField(null=False)
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    role = models.CharField(max_length=120, default="User", choices=ROLES)
    avatar = models.CharField(max_length=1000, default=None, null=True)
    organization = models.CharField(max_length=120, default=None, null=True)
    proficiency = models.CharField(
        max_length=120, default="Non-Speaker", choices=PROFICIENCY
    )

    def has_role(self, role):
        return self.role == role

    def __str__(self):
        return "Profile of " + str(self.user)
