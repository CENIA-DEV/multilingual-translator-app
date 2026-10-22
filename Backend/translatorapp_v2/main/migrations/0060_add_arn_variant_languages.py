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
"""The Mapuzugun variants the translator offers, created where they are missing.

0058 renames the old variant codes (arn_r0_nag -> arn_raguileo_nagche), so it
only gives the new codes to databases that already had the old variants. A
database that only had the Nguluche rows (arn_a0_n, ...) ends with no variant
at all, and every translation to or from one fails with "Lengua de destino no
soportada". This creates each missing variant, with its alphabet and territory
(codes as in 0058 and the language catalog), and arn_Latn. Rows that exist are
left as they are, and a database without Mapuzugun (the Rapa Nui translator's)
is not touched.
"""
from django.db import migrations

WRITINGS = {
    "azumchefe": "Azümchefe",
    "raguileo": "Raguileo",
    "amu": "Unificado",
    "rumian": "Rumian",
    "cacicado-huilliche": "Cacicado",
}
TERRITORIES = {
    "nagche": "Nagche",
    "pewenche": "Pewenche",
    "lafkenche": "Lafkenche",
    "wenteche": "Wenteche",
    "williche": "Williche",
}
# (code, name, writing, territory), as in the frontend's language catalog
VARIANTS = [
    (f"arn_{writing}_{territory}", f"{TERRITORIES[territory]} {name}", writing, territory)
    for territory in ("nagche", "pewenche", "lafkenche", "wenteche")
    for writing, name in (
        ("azumchefe", "Azümchefe"),
        ("raguileo", "Raguileo"),
        ("amu", "Unificado"),
    )
] + [
    ("arn_cacicado-huilliche_williche", "Williche Cacicado", "cacicado-huilliche", "williche"),
    ("arn_rumian_williche", "Williche Rumian", "rumian", "williche"),
]


def forward(apps, schema_editor):
    Lang = apps.get_model("main", "Lang")
    Script = apps.get_model("main", "Script")
    Dialect = apps.get_model("main", "Dialect")

    if not Lang.objects.filter(code__startswith="arn_").exists():
        return  # not a Mapuzugun translator

    if not Lang.objects.filter(code="arn_Latn").exists():
        latin = Script.objects.get_or_create(code="Latn", defaults={"name": "Latin"})[0]
        Lang.objects.create(code="arn_Latn", name="Mapuzugun", script=latin, is_native=True)

    for code, name, writing, territory in VARIANTS:
        if Lang.objects.filter(code=code).exists():
            continue
        script = Script.objects.get_or_create(
            code=writing, defaults={"name": WRITINGS[writing]}
        )[0]
        dialect = Dialect.objects.get_or_create(
            code=territory, defaults={"name": TERRITORIES[territory]}
        )[0]
        Lang.objects.create(
            code=code, name=name, script=script, dialect=dialect, is_native=True
        )


class Migration(migrations.Migration):
    dependencies = [
        ("main", "0059_translation_commune"),
    ]

    # Backwards does nothing: removing languages could orphan saved translations.
    operations = [migrations.RunPython(forward, migrations.RunPython.noop)]
