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
"""The translations and feedback saved before the territory selector.

The translator then offered one territory, Nguluche (arn_a0_n, arn_r0_n,
arn_u0_n), as a placeholder: the user only chose the alphabet. Those records
become the alphabet alone, territory unknown (arn_azumchefe, arn_raguileo,
arn_amu), so "Explorar datos" shows them as such and an administrator can set
their territory. Nothing is deleted: if the new code exists already, every
reference moves to it before the old row goes.
"""
from django.db import migrations

UNKNOWN_TERRITORY = {
    "arn_a0_n": "arn_azumchefe",
    "arn_r0_n": "arn_raguileo",
    "arn_u0_n": "arn_amu",
}
# (model, field) pairs that point at a language
USES = (
    ("TranslationPair", "src_lang"),
    ("TranslationPair", "dst_lang"),
    ("TranslationRequest", "src_lang"),
    ("TranslationRequest", "dst_lang"),
    ("GeneralSuggestion", "src_lang"),
    ("GeneralSuggestion", "dst_lang"),
    ("TextToSpeechAudio", "language"),
    ("SpeechToTextAudio", "language"),
    ("CacheTTS", "language"),
)


def forward(apps, schema_editor):
    Lang = apps.get_model("main", "Lang")
    Dialect = apps.get_model("main", "Dialect")
    for old_code, new_code in UNKNOWN_TERRITORY.items():
        old = Lang.objects.filter(code=old_code).first()
        if old is None:
            continue
        existing = Lang.objects.filter(code=new_code).first()
        if existing is None:
            old.code = new_code
            old.dialect = None
            if old.script_id:
                old.name = old.script.name  # "Azümchefe": the alphabet alone
            old.save(update_fields=["code", "dialect", "name"])
            continue
        for model, field in USES:
            apps.get_model("main", model).objects.filter(**{field: old}).update(**{field: existing})
        old.delete()
    # the placeholder territory, if nothing else uses it
    Dialect.objects.filter(code="n", lang__isnull=True).delete()


def backward(apps, schema_editor):
    Lang = apps.get_model("main", "Lang")
    Dialect = apps.get_model("main", "Dialect")
    nguluche, _ = Dialect.objects.get_or_create(code="n", defaults={"name": "Nguluche"})
    for old_code, new_code in UNKNOWN_TERRITORY.items():
        Lang.objects.filter(code=new_code).update(code=old_code, dialect=nguluche)


class Migration(migrations.Migration):
    dependencies = [("main", "0059_translation_commune")]

    operations = [migrations.RunPython(forward, backward)]
