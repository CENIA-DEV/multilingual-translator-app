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
import os
from urllib.parse import urlparse

from django.utils.translation import gettext_lazy as _
from dotenv import load_dotenv
from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

load_dotenv()


# A Pydantic model to get environment variables.
class DbSettings(BaseSettings):
    """Settings for SQL."""

    model_config = SettingsConfigDict(env_prefix="db_")

    host: str
    user: str
    password: SecretStr
    port: int = Field(coerce_numbers_to_str=True, default=5432)
    name: str = "bdd-01"


class EmailSettings(BaseSettings):
    """Settings for Email."""

    model_config = SettingsConfigDict(env_prefix="email_")

    user: str
    key: SecretStr


class AppSettings(BaseSettings):
    """Settings for App."""

    model_config = SettingsConfigDict(env_prefix="app_")
    frontend_url: str
    backend_url: str
    inference_model_name: str
    raw_inference_model_name: str
    inference_model_url: str
    raw_inference_model_url: str

    inference_tts_model_url: str
    inference_tts_model_name: str

    raw_inference_tts_model_url: str
    raw_inference_tts_model_name: str

    inference_asr_model_url: str
    inference_asr_model_name: str

    raw_inference_asr_model_url: str
    raw_inference_asr_model_name: str


# We need to create an instance of the Pydantic model to access the
# environment variables.
DB_SETTINGS = DbSettings()
EMAIL_SETTINGS = EmailSettings()
APP_SETTINGS = AppSettings()

print(f"HOST: {DB_SETTINGS.host} | PORT: {DB_SETTINGS.port} USER: {DB_SETTINGS.user}")
print(f"EMAIL USER: {EMAIL_SETTINGS.user}")

SECRET_KEY = os.environ.get("SECRET_KEY")

DEBUG = True if os.environ.get("PRODUCTION") == "False" else False
SESSION_COOKIE_SECURE = True if os.environ.get("PRODUCTION") == "True" else False
CSRF_COOKIE_SECURE = True if os.environ.get("PRODUCTION") == "True" else False


# CORS settings
CORS_ALLOW_ALL_ORIGINS = True if DEBUG else False
CORS_ALLOWED_ORIGINS = [
    APP_SETTINGS.frontend_url,
    APP_SETTINGS.frontend_url.strip("www."),
]

# Debug prints for CORS settings
print(f"Frontend URL: {APP_SETTINGS.frontend_url}")
print(f"Backend URL: {APP_SETTINGS.backend_url}")
# print(f"CORS Allowed Origins: {CORS_ALLOWED_ORIGINS}")

# Extract domain from backend URL for ALLOWED_HOSTS
backend_domain = urlparse(APP_SETTINGS.backend_url).netloc
print(f"Backend Domain: {backend_domain}")

ALLOWED_HOSTS = (
    [backend_domain, backend_domain.strip("www.")]
    if not DEBUG
    else ["*"]  # Use just the domain part of the URL
)

# Configure logging
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "{levelname} {asctime} {module} {process:d} {thread:d} {message}",
            "style": "{",
        },
        "simple": {
            "format": "{levelname} {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        },
        "file": {
            "class": "logging.FileHandler",
            "filename": "debug.log",
            "formatter": "verbose",
        },
    },
    "root": {
        "handlers": ["console", "file"],
        "level": "DEBUG" if DEBUG else "INFO",
    },
    "loggers": {
        "main": {  # This matches your views.py logger
            "handlers": ["console", "file"],
            "level": "DEBUG" if DEBUG else "INFO",
            "propagate": True,
        },
    },
}

# Ensure CORS middleware is at the top of the middleware stack
MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",  # Must be at the top
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.locale.LocaleMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

# Application definition

INSTALLED_APPS = [
    "main",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "rest_framework.authtoken",
    # "storages"
]

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.TokenAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.DjangoModelPermissionsOrAnonReadOnly"
    ],
    "PAGE_SIZE": 15,
}


ROOT_URLCONF = "translatorapp.urls"

CORS_ALLOW_ALL_ORIGINS = True

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "translatorapp.wsgi.application"


# Database
# https://docs.djangoproject.com/en/4.2/ref/settings/#databases

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql_psycopg2",
        "HOST": DB_SETTINGS.host,
        "USER": DB_SETTINGS.user,
        "PASSWORD": DB_SETTINGS.password.get_secret_value(),
        "NAME": DB_SETTINGS.name,
        "PORT": DB_SETTINGS.port,
        "OPTIONS": {
            "sslmode": "disable",
        },
    }
}


# Password validation
# https://docs.djangoproject.com/en/4.2/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation."
        "UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]


# Internationalization
# https://docs.djangoproject.com/en/4.2/topics/i18n/

LANGUAGE_CODE = "es-es"
LANGUAGES = [
    ("es", _("Spanish")),
    # ('en', _('English')),
]

TIME_ZONE = "UTC"

USE_I18N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/4.2/howto/static-files/

STATIC_URL = "static/"

# Default primary key field type
# https://docs.djangoproject.com/en/4.2/ref/settings/#default-auto-field

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# django email settings
EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
EMAIL_HOST = "smtp.gmail.com"
EMAIL_HOST_USER = EMAIL_SETTINGS.user
EMAIL_HOST_PASSWORD = EMAIL_SETTINGS.key.get_secret_value()
DEFAULT_FROM_EMAIL = EMAIL_SETTINGS.user
EMAIL_PORT = 587
EMAIL_USE_TLS = True
EMAIL_USE_SSL = False

INVITATION_GUIDE_URL = os.environ.get("INVITATION_GUIDE_URL")
SUPPORT_EMAIL = os.environ.get("SUPPORT_EMAIL")
VARIANT = os.environ.get("VARIANT")
MAX_WORDS_TRANSLATION = int(os.environ.get("MAX_WORDS_TRANSLATION", 150))

# Convert string environment variable to boolean
TRANSLATION_REQUIRES_AUTH = (
    os.environ.get("TRANSLATION_REQUIRES_AUTH", "false").lower() == "true"
)

# TODO: Configure to store audios in GCP

# DEFAULT_FILE_STORAGE = 'storages.backends.gcloud.GoogleCloudStorage'
# GS_BUCKET_NAME = ''
# STATICFILES_STORAGE = 'storages.backends.gcloud.GoogleCloudStorage'
