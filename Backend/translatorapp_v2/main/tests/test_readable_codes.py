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
"""Migration 0058 rewrites stored customization documents to the readable
Mapuzugun codes (arn_r0_nag -> arn_raguileo_nagche)."""
import importlib

migration = importlib.import_module("main.migrations.0058_readable_variant_codes")


def test_a_customization_document_is_rewritten():
    doc = {
        "translator": {
            "defaultTarget": "arn_a0_nag",
            "placeholders": {"arn_r0_p": "Wirintukuge", "spa_Latn": "Escribe"},
        },
        "languages": {
            "nativeCodes": ["arn_Latn", "arn_a0_nag", "arn_a0_n", "arn_ave"],
            "hidden": ["arn_ru_h"],
            "variantSelector": {
                "enabled": True,
                "prefix": "arn",
                "sourceCode": "arn_Latn",
                "options": [{"code": "a0", "label": "Azümchefe"}, {"code": "ca", "label": "Cacicado"}],
                "dialects": [{"code": "h", "label": "Williche", "writings": ["ca", "ru"]}],
            },
        },
    }
    out = migration.remap_document(doc)
    assert out["translator"]["defaultTarget"] == "arn_azumchefe_nagche"
    assert out["translator"]["placeholders"] == {"arn_raguileo_pewenche": "Wirintukuge", "spa_Latn": "Escribe"}
    # removed variants (Nguluche, Estándar) drop out of the lists
    assert out["languages"]["nativeCodes"] == ["arn_Latn", "arn_azumchefe_nagche"]
    assert out["languages"]["hidden"] == ["arn_rumian_williche"]
    selector = out["languages"]["variantSelector"]
    assert [o["code"] for o in selector["options"]] == ["azumchefe", "cacicado-huilliche"]
    assert selector["dialects"] == [
        {"code": "williche", "label": "Williche", "writings": ["cacicado-huilliche", "rumian"]}
    ]
    assert selector["sourceCode"] == "arn_Latn"


def test_catalog_and_seed_entries_get_the_new_alphabet_and_territory():
    catalog = [
        {"name": "Nagche Raguileo", "code": "arn_r0_nag", "writing": "r0", "dialect": "nag"},
        {"name": "Huilliche Unificado", "code": "arn_u0_h", "writing": "u0", "dialect": "h"},
        {"name": "Spanish", "code": "spa_Latn", "writing": "Latn", "dialect": None},
    ]
    assert migration.remap_document(catalog) == [
        {"name": "Nagche Raguileo", "code": "arn_raguileo_nagche", "writing": "raguileo", "dialect": "nagche"},
        {"name": "Spanish", "code": "spa_Latn", "writing": "Latn", "dialect": None},
    ]
    seed = {"code": "arn_ca_h", "script": "ca", "dialect": "h", "dialect_name": "Huilliche"}
    assert migration.remap_document(seed) == {
        "code": "arn_cacicado-huilliche_williche",
        "script": "cacicado-huilliche",
        "dialect": "williche",
        "dialect_name": "Williche",
    }
