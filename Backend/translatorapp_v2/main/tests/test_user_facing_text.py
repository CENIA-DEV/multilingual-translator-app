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
"""Messages and emails shown to users must reflect the configured values."""

import pytest
from django.template.loader import render_to_string
from django.test import override_settings
from fixtures import api_client, create_languages, mock_get_prediction  # noqa: F401
from main.serializers import LanguageSerializer


@pytest.mark.django_db
@override_settings(TRANSLATION_REQUIRES_AUTH=False, MAX_WORDS_TRANSLATION=10)
def test_word_limit_error_uses_the_configured_limit(
    api_client, create_languages, mock_get_prediction  # noqa: F811
):
    english, spanish, _, _ = create_languages
    data = {
        "src_text": "Hello " * 11,
        "src_lang": LanguageSerializer(english).data,
        "dst_lang": LanguageSerializer(spanish).data,
    }

    response = api_client.post("/api/translate/", data, format="json")

    assert response.status_code == 400
    message = str(response.data["src_text"][0])
    assert "10 palabras" in message
    assert "150" not in message


def test_invitation_guide_link_opens_in_a_new_tab():
    html = render_to_string(
        "invitation_template.html",
        {"guide_url": "https://example.com/guide.pdf", "name": "Ana"},
    )

    assert (
        '<a href="https://example.com/guide.pdf" target="_blank" '
        'rel="noopener noreferrer">'
    ) in html
