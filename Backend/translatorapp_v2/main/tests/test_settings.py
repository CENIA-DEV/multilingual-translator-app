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
"""Tests for the proxy/CSRF settings the app needs behind Cloud Run."""

from urllib.parse import urlparse

from django.conf import settings
from django.test import RequestFactory
from translatorapp.settings import _origin


def test_origin_strips_path_and_keeps_port():
    assert _origin("https://example.org/app/") == "https://example.org"
    assert _origin("http://localhost:3000") == "http://localhost:3000"
    assert _origin("not a url") is None


def test_csrf_trusted_origins_come_from_the_app_urls():
    for url in (settings.APP_SETTINGS.frontend_url, settings.APP_SETTINGS.backend_url):
        parsed = urlparse(url)
        assert f"{parsed.scheme}://{parsed.netloc}" in settings.CSRF_TRUSTED_ORIGINS
    # Every entry must carry a scheme, or Django refuses to start.
    assert all("://" in origin for origin in settings.CSRF_TRUSTED_ORIGINS)


def test_forwarded_proto_marks_the_request_secure():
    factory = RequestFactory()
    assert factory.get("/", HTTP_X_FORWARDED_PROTO="https").is_secure()
    assert not factory.get("/").is_secure()
