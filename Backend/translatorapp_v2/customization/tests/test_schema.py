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
"""The schema accepts the frontend presets and rejects anything unsafe."""
import copy
import json
from pathlib import Path

import pytest
from customization.sanitize import is_safe_media_ref, sanitize_rich_text
from customization.schema import ConfigValidationError, validate_config

PRESETS_DIR = (
    Path(__file__).resolve().parents[4]
    / "Frontend"
    / "translator"
    / "src"
    / "customization"
    / "presets"
)
PRESETS = sorted(PRESETS_DIR.glob("*.json")) if PRESETS_DIR.exists() else []


def load_preset(name="rap"):
    path = PRESETS_DIR / f"{name}.json"
    if not path.exists():
        pytest.skip("frontend presets are not available in this checkout")
    return json.loads(path.read_text(encoding="utf-8"))


def errors_for(document):
    with pytest.raises(ConfigValidationError) as caught:
        validate_config(document)
    return {error["path"]: error["message"] for error in caught.value.errors}


@pytest.mark.parametrize("path", PRESETS, ids=lambda path: path.stem)
def test_every_frontend_preset_is_a_valid_document(path):
    document = json.loads(path.read_text(encoding="utf-8"))
    cleaned = validate_config(document)
    # the presets are already clean: validation must not rewrite them
    assert cleaned == document


def test_unknown_keys_are_reported_with_their_path():
    document = load_preset()
    document["landing"]["hero"]["subtitel"] = {"es": "typo"}
    assert errors_for(document) == {"landing.hero.subtitel": "Campo desconocido"}


def test_colors_must_be_six_digit_hex_and_are_lowercased():
    document = load_preset()
    document["theme"]["primary"] = "red; } body { display:none"
    assert "theme.primary" in errors_for(document)

    document["theme"]["primary"] = "#0A8CDE"
    assert validate_config(document)["theme"]["primary"] == "#0a8cde"


def test_media_refs_reject_scripts_and_path_traversal():
    assert is_safe_media_ref("/images/rap-white.png")
    assert is_safe_media_ref("asset:0b8b8f4e-7a8a-4c1e-9d65-2b7a3f6c9e10")
    assert is_safe_media_ref("https://example.org/logo.png")
    assert is_safe_media_ref("")
    for bad in (
        "javascript:alert(1)",
        "/images/../../etc/passwd",
        "//evil.example/x.png",
        "http://insecure.example/x.png",
        'data:image/svg+xml,<svg onload="x">',
    ):
        assert not is_safe_media_ref(bad), bad

    document = load_preset()
    document["landing"]["hero"]["image"] = "javascript:alert(1)"
    assert "landing.hero.image" in errors_for(document)


def test_links_must_use_a_safe_scheme():
    document = load_preset()
    document["landing"]["owners"]["partners"][0]["url"] = "javascript:alert(1)"
    assert "landing.owners.partners.0.url" in errors_for(document)


@pytest.mark.parametrize(
    "dirty, clean",
    [
        ("<strong className='text-default'>bold</strong>", "<strong>bold</strong>"),
        ("a <script>alert(1)</script>b", "a alert(1)b"),
        ('<img src=x onerror="alert(1)">text', "text"),
        ('<a href="javascript:alert(1)">link</a>', "link"),
        (
            '<a href="https://cenia.cl" onclick="x">cenia</a>',
            '<a href="https://cenia.cl">cenia</a>',
        ),
        ("<em>open", "<em>open</em>"),
        ("close</strong> only", "close only"),
        ("line<br>break<br/>", "line<br>break<br>"),
        ("re'o & ŋā <3", "re'o &amp; ŋā &lt;3"),
    ],
)
def test_rich_text_keeps_only_formatting(dirty, clean):
    assert sanitize_rich_text(dirty) == clean


def test_rich_text_fields_are_sanitized_on_save():
    document = load_preset()
    item = document["landing"]["about"]["items"][0]
    item["text"]["es"] = 'Hola <b onclick="x">mundo</b><script>x()</script>'
    cleaned = validate_config(document)
    assert (
        cleaned["landing"]["about"]["items"][0]["text"]["es"] == "Hola <b>mundo</b>x()"
    )


def test_the_default_locale_must_be_offered():
    document = load_preset()
    document["landing"]["defaultLocale"] = "fr"
    assert "landing" in errors_for(document)


def test_sections_cannot_repeat():
    document = load_preset()
    document["landing"]["sections"].append(
        copy.deepcopy(document["landing"]["sections"][0])
    )
    assert "landing.sections" in errors_for(document) or "landing" in errors_for(
        document
    )


def test_list_limits_are_enforced():
    document = load_preset()
    document["landing"]["validation"]["pins"] = [
        {"name": f"p{i}", "lat": 0, "lon": 0} for i in range(301)
    ]
    message = errors_for(document)["landing.validation.pins"]
    assert "máximo 300" in message


def test_translator_texts_accept_plain_strings_saved_before_the_site_was_multilingual():
    document = load_preset("arn")
    document["translator"]["placeholder"] = "Escriba aquí"
    document["translator"]["notice"][
        "body"
    ] = "Texto <script>x()</script><strong>viejo</strong>"
    document["languages"]["variantSelector"]["label"] = "Grafemario"
    cleaned = validate_config(document)
    assert cleaned["translator"]["placeholder"] == "Escriba aquí"
    assert cleaned["translator"]["notice"]["body"] == "Texto x()<strong>viejo</strong>"


def test_multilingual_translator_texts_are_sanitized_per_language():
    document = load_preset("arn")
    document["translator"]["restricted"]["body"] = {
        "es": "Inicie <strong>sesión</strong>",
        "arn": '<a href="javascript:x()">konün</a>',
    }
    body = validate_config(document)["translator"]["restricted"]["body"]
    assert body == {"es": "Inicie <strong>sesión</strong>", "arn": "konün"}


def test_ui_texts_are_keyed_by_message_and_locale():
    document = load_preset("arn")
    assert validate_config(document)["ui"]["menu.home"]["arn"]

    document["ui"] = {"menu.home": {"arn": "x"}, "bad key!": {"es": "x"}}
    assert any(path.startswith("ui.bad key!") for path in errors_for(document))

    document["ui"] = {"menu.home": {"Mapuche": "x"}}
    assert errors_for(document)

    del document["ui"]
    assert validate_config(document)["ui"] == {}


def test_variant_territories_only_use_listed_alphabets():
    document = load_preset("arn")
    selector = validate_config(document)["languages"]["variantSelector"]
    williche = next(d for d in selector["dialects"] if d["label"] == "Williche")
    assert williche["writings"] == ["cacicado-huilliche", "rumian"]

    selector = document["languages"]["variantSelector"]
    selector["dialects"][0]["writings"] = ["azumchefe", "xx"]
    assert "languages.variantSelector" in errors_for(document)


def test_variant_source_code_is_a_language_code_or_empty():
    document = load_preset("arn")
    document["languages"]["variantSelector"]["sourceCode"] = ""
    validate_config(document)
    document["languages"]["variantSelector"]["sourceCode"] = "not a code"
    assert errors_for(document)


def test_territory_help_cards_are_validated():
    document = load_preset("arn")
    cards = document["languages"]["variantSelector"]["territoryHelp"]
    assert [card["code"] for card in cards] == [
        "lafkenche",
        "nagche",
        "wenteche",
        "pewenche",
        "williche",
    ]
    cards[0]["icon"] = "../../etc/passwd"
    cards[1]["colour"] = "red"
    errors = errors_for(document)
    assert "languages.variantSelector.territoryHelp.0.icon" in errors
    assert (
        errors["languages.variantSelector.territoryHelp.1.colour"]
        == "Campo desconocido"
    )


def test_documents_without_territory_help_keep_falling_back_to_the_preset():
    """Saved before it was editable: re-saving, publishing or restoring such a
    document must not store an empty list, which would hide the preset's."""
    document = load_preset("arn")
    del document["languages"]["variantSelector"]["territoryHelp"]
    cleaned = validate_config(document)
    assert "territoryHelp" not in cleaned["languages"]["variantSelector"]

    # an empty list is a choice (no help at all), and is kept
    document["languages"]["variantSelector"]["territoryHelp"] = []
    cleaned = validate_config(document)
    assert cleaned["languages"]["variantSelector"]["territoryHelp"] == []
