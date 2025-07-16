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
from datetime import datetime

from django.conf import settings
from django.contrib.auth.hashers import make_password
from django.contrib.auth.models import User
from rest_framework import serializers
from rest_framework.authtoken.models import Token
from rest_framework.validators import UniqueValidator

from .models import (
    Dialect,
    InvitationToken,
    Lang,
    PasswordResetToken,
    Profile,
    RequestAccess,
    Script,
    TranslationPair,
)


# Serializers define the API representation.
class UserTokenSerializer(serializers.ModelSerializer):
    token = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["username", "email", "password", "token"]
        extra_kwargs = {"password": {"write_only": True}}

    def get_token(self, user):
        token, created = Token.objects.get_or_create(user=user)
        return token.key


class BaseProfileSerializer(serializers.ModelSerializer):
    age = serializers.SerializerMethodField()

    def validate_date_of_birth(self, date_of_birth):
        if date_of_birth > datetime.now().date():
            raise serializers.ValidationError(
                "Fecha de nacimiento no puede ser en el futuro"
            )
        return date_of_birth

    def get_age(self, obj):
        return (datetime.now().date() - obj.date_of_birth).days // 365


# two different user serializers so we can hide the user role for general users
class FullProfileSerializer(BaseProfileSerializer):
    class Meta:
        model = Profile
        fields = [
            "role",
            "avatar",
            "date_of_birth",
            "proficiency",
            "organization",
            "age",
        ]
        extra_kwargs = {"age": {"read_only": True}}


class ProfileSerializer(BaseProfileSerializer):
    class Meta:
        model = Profile
        fields = ["avatar", "date_of_birth", "organization", "age"]
        extra_kwargs = {"age": {"read_only": True}}


class BaseUserSerializer(serializers.ModelSerializer):
    # since profile is nested, write functions explicitely for create and update
    def create(self, validated_data):
        # check user exists (inactive)
        profile_data = validated_data.pop("profile")
        validated_data["password"] = make_password(validated_data.get("password"))
        user = User.objects.create(**validated_data)
        # since profile is nested, django will validate profile fields as well
        Profile.objects.create(user=user, **profile_data)
        return user

    def update(self, user, validated_data):
        # action = self.context.get("request").path.split('/')[-2]
        if "profile" in validated_data.keys():
            profile_data = validated_data.pop("profile")
            profile = user.profile
        else:
            profile_data = {}
        for key, value in validated_data.items():
            if key == "password":
                # automatically handles password hashing and ensures that the
                # password is stored securely.
                user.set_password(value)
            else:
                # same as user.key = value
                setattr(user, key, value)
            user.save()
        for key, value in profile_data.items():
            if key == "role":
                """# only update role if it's an update_user_role action (safety check)
                if action != "update_user_role" and action != "register_by_invitation":
                raise serializers.ValidationError({"detail":
                "Updating role is not allowed"}, code=400)
                """
                # native admins can't grant higher roles (admins)
                if user.profile.role == Profile.NATIVEADMIN and value == Profile.ADMIN:
                    raise serializers.ValidationError(
                        "No se puede otorgar un rol más alto"
                    )
            setattr(profile, key, value)
            profile.save()
        return user


class UserSerializer(BaseUserSerializer):
    profile = ProfileSerializer()
    first_name = serializers.CharField(
        allow_blank=False
    )  # User model name field allows empty strings
    last_name = serializers.CharField(
        allow_blank=False
    )  # User model name field allows empty strings

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "profile",
            "is_active",
        ]


class FullUserSerializer(BaseUserSerializer):
    profile = FullProfileSerializer()
    first_name = serializers.CharField(
        allow_blank=False
    )  # User model name field allows empty strings
    last_name = serializers.CharField(
        allow_blank=False
    )  # User model name field allows empty strings

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "password",
            "first_name",
            "last_name",
            "profile",
            "is_active",
        ]
        extra_kwargs = {"password": {"write_only": True}}


class UserEmailSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["email"]

    # we need to add custom validation to check that a user assigned with email exists
    def validate_email(self, value):
        if not User.objects.filter(email=value).exists():
            raise serializers.ValidationError("Email no registrado en plataforma")
        return value


class ScriptSerializer(serializers.ModelSerializer):
    class Meta:
        model = Script
        fields = ["code", "name"]

        extra_kwargs = {
            # Remove default uniqueness validator
            # this is handled in create method
            "code": {"validators": []},
        }


class DialectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Dialect
        fields = ["code", "name"]

        extra_kwargs = {
            # Remove default uniqueness validator
            # this is handled in create method
            "code": {"validators": []},
        }


class LanguageSerializer(serializers.ModelSerializer):
    script = ScriptSerializer()
    dialect = DialectSerializer()

    class Meta:
        model = Lang
        fields = ["id", "script", "code", "dialect", "name"]

    def create(self, validated_data):
        # Get or create script to avoid unique constraint error
        script_data = validated_data.pop("script")
        script, _ = Script.objects.get_or_create(**script_data)

        # Get or create dialect to avoid unique constraint error
        dialect_data = validated_data.pop("dialect")
        dialect, _ = Dialect.objects.get_or_create(**dialect_data)

        return Lang.objects.create(script=script, dialect=dialect, **validated_data)


class NameLanguageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lang
        fields = ["code", "name", "is_native"]

        extra_kwargs = {
            "code": {"validators": []},  # Remove default uniqueness validator
            "name": {"read_only": True},  # We only need code for lookups
        }


class InvitationSerializer(serializers.ModelSerializer):
    # we add user that sent the invite as a nested serialization
    # we need to add read_only = true so user can be passed to serializer in .save()
    # and not in original payload. Also, important to add read_only flag here and
    # not in extra_kwargs otherwise it doesnt work.
    invited_by = UserEmailSerializer(read_only=True)
    is_active = serializers.SerializerMethodField()
    # check email is unique
    email = serializers.EmailField(
        validators=[
            UniqueValidator(
                message="Email ya registrado",
                queryset=User.objects.filter(is_active=True),
            ),
            UniqueValidator(
                message="Email con invitación activa",
                queryset=InvitationToken.objects.all(),
            ),
        ]
    )

    class Meta:
        model = InvitationToken
        fields = [
            "id",
            "email",
            "role",
            "token",
            "invited_by",
            "first_name",
            "last_name",
            "organization",
            "is_active",
        ]
        extra_kwargs = {"token": {"read_only": True}}
        depth = 1

    def get_is_active(self, obj):
        # if token is expired, we set is_active to False
        return not obj.is_expired()

    def create(self, validated_data):
        # invited_by user is already validated by nested UserEmailSerializer
        invited_by = validated_data.pop("invited_by")
        invitation = InvitationToken(invited_by=invited_by, **validated_data)
        invitation.generate_token()  # Generate token
        invitation.save()
        return invitation


class PasswordResetSerializer(serializers.ModelSerializer):
    # in this case we want to pass user email in payload so we DONT specify read_only
    user = UserEmailSerializer()
    is_active = serializers.SerializerMethodField()

    class Meta:
        model = PasswordResetToken
        fields = ["user", "token", "is_active"]
        read_only_fields = ["token"]

    def get_is_active(self, obj):
        # if token is expired, we set is_active to False
        return not obj.is_expired()

    def create(self, validated_data):
        # user is already validated by nested UserEmailSerializer
        validated_user = validated_data.pop("user")
        user = User.objects.get(username=validated_user["email"])
        reset_token = PasswordResetToken(user=user)
        reset_token.generate_token()  # Generate token
        reset_token.save()
        return reset_token


class RequestSerializer(serializers.ModelSerializer):
    # check email is unique
    email = serializers.EmailField(
        validators=[
            UniqueValidator(
                message="User email already registered",
                queryset=User.objects.filter(is_active=True),
            ),
            UniqueValidator(
                message="User email has active request",
                queryset=RequestAccess.objects.filter(approved=None),
            ),
        ]
    )

    class Meta:
        model = RequestAccess
        fields = [
            "id",
            "email",
            "first_name",
            "last_name",
            "reason",
            "approved",
            "organization",
        ]

    def validate(self, data):
        if (
            "reason" in data.keys()
            and data["reason"] == RequestAccess.WORK
            and "organization" not in data.keys()
        ):
            raise serializers.ValidationError(
                {
                    "organization": (
                        "Organización es requerida para " "solicitudes de trabajo"
                    )
                }
            )
        return data


"""class CacheSerializer(serializers.Serializer):

    src_lang_code = serializers.SerializerMethodField()
    dst_lang_code = serializers.SerializerMethodField()
    created_at = serializers.DateTimeField(format="%Y-%m-%d %H:%M:%S")
    src_text = serializers.CharField()
    dst_text = serializers.CharField()
    model_name = serializers.CharField()
    model_version = serializers.CharField()
    correct = serializers.BooleanField()
    validated = serializers.BooleanField()

    class Meta:
        model = TranslationPair
        fields = [
            "src_text",
            "dst_text",
            "src_lang_code",
            "dst_lang_code",
            "model_name",
            "model_version",
            "correct",
            "validated",
            "created_at",
        ]

    def get_src_lang_code(self, obj):
        return obj.src_lang.code

    def get_dst_lang_code(self, obj):
        return obj.dst_lang.code"""


class SuggestionSerializer(serializers.ModelSerializer):
    src_lang = NameLanguageSerializer()
    dst_lang = NameLanguageSerializer()
    user = UserEmailSerializer(read_only=True)
    updated_suggestion = serializers.CharField(required=False)

    # dst_text = serializers.SerializerMethodField()
    class Meta:
        model = TranslationPair
        fields = [
            "id",
            "src_text",
            "dst_text",
            "suggestion",
            "src_lang",
            "dst_lang",
            "model_name",
            "model_version",
            "correct",
            "feedback",
            "validated",
            "user",
            "updated_suggestion",
        ]

    def validate_src_lang(self, src_lang):
        try:
            src_lang = Lang.objects.get(code=src_lang["code"])
            return src_lang
        except Lang.DoesNotExist:
            raise serializers.ValidationError("Lengua de origen no soportada")

    def validate_dst_lang(self, dst_lang):
        try:
            dst_lang = Lang.objects.get(code=dst_lang["code"])
            return dst_lang
        except Lang.DoesNotExist:
            raise serializers.ValidationError("Lengua de destino no soportada")

    # since profile is nested, write functions explicitely for create and update
    def create(self, validated_data):
        # lang and user are already validated by nested serializers
        validated_user = validated_data.pop("user")
        src_lang = validated_data.pop("src_lang")
        dst_lang = validated_data.pop("dst_lang")
        # if user is native admin, we automatically validate the suggestion
        if validated_user and validated_user.profile.has_role(Profile.NATIVEADMIN):
            if validated_data["feedback"] is False:
                # store the error in translation pair
                TranslationPair.objects.create(
                    user=validated_user,
                    src_lang=src_lang,
                    dst_lang=dst_lang,
                    correct=False,
                    validated=True,
                    validated_by=validated_user,
                    **validated_data
                )
            validated_data["correct"] = True
            validated_data["validated"] = True
            validated_data["validated_by"] = validated_user
            validated_data["dst_text"] = validated_data["suggestion"]
        pair = TranslationPair.objects.create(
            src_lang=src_lang, dst_lang=dst_lang, user=validated_user, **validated_data
        )
        return pair


class TranslationPairSerializer(SuggestionSerializer):
    """
    Translations are a subclass of a suggestion, they contain source and dst text
    and lang and model characteristics. When we mark a translation as a suggestion
    later on, we add a user and correct flag.
    """

    class Meta:
        model = TranslationPair
        fields = [
            "id",
            "src_text",
            "dst_text",
            "src_lang",
            "dst_lang",
            "model_name",
            "model_version",
        ]
        # dst_text is only given in the deserialization (response)
        extra_kwargs = {
            "dst_text": {"read_only": True},
            "model_name": {"read_only": True},
            "model_version": {"read_only": True},
        }

    def validate_src_text(self, src_text):
        if len(src_text.strip().split()) > settings.MAX_WORDS_TRANSLATION:
            raise serializers.ValidationError(
                "El texto no puede tener más de 150 palabras", code=400
            )
        return src_text

    def create(self, validated_data):
        return validated_data


class ModelStatusSerializer(serializers.Serializer):
    # specify list of status options
    status = serializers.ChoiceField(choices=["booting", "up", "down"])


class ParticipateSerializer(serializers.Serializer):
    first_name = serializers.CharField()
    last_name = serializers.CharField()
    email = serializers.EmailField()
    reason = serializers.CharField()
    organization = serializers.CharField(
        allow_null=True, allow_blank=True, default=None
    )
