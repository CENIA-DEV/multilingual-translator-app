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
"""Readable codes for Mapuzungun's alphabets and territories.

arn_r0_nag (alphabet r0, territory nag) becomes arn_raguileo_nagche, and the
alphabet and territory rows take the same names, which is also what the model
server is sent. The variants the translator never offered (Nguluche, the two
"Estándar" alphabets, Williche in the Azümchefe / Raguileo / Unificado
alphabets) are removed, unless a saved translation or recording uses them.
Stored customization documents are rewritten to the new codes too.

`remap_document` is shared with the one-off update of the frontend presets,
the language catalog and the seed data, so the mapping lives in one place.
"""
from django.db import migrations

PREFIX = "arn"
WRITINGS = {
    "a0": "azumchefe",
    "r0": "raguileo",
    "u0": "amu",  # Unificado
    "ru": "rumian",
    "ca": "cacicado-huilliche",
}
TERRITORIES = {
    "nag": "nagche",
    "p": "pewenche",
    "l": "lafkenche",
    "wen": "wenteche",
    "h": "williche",
}
REMOVED = {
    "arn_a0_n", "arn_r0_n", "arn_u0_n",  # Nguluche
    "arn_ave", "arn_jw",  # Estándar 1 and 2
    "arn_a0_h", "arn_r0_h", "arn_u0_h",  # Williche only uses Cacicado and Rumian
}
REMOVED_SCRIPTS = {"ave", "jw"}
REMOVED_DIALECTS = {"n"}
RENAMED = {
    f"{PREFIX}_{w}_{t}": f"{PREFIX}_{nw}_{nt}"
    for w, nw in WRITINGS.items()
    for t, nt in TERRITORIES.items()
}
REVERSED = {new: old for old, new in RENAMED.items()}


def remap_document(node, renamed=RENAMED, writings=WRITINGS, territories=TERRITORIES, removed=REMOVED):
    """A copy of a JSON document with the language codes renamed: whole codes
    anywhere (values and keys), entries of removed codes dropped from lists,
    the variant selector's alphabet / territory codes, and the writing /
    script / dialect fields of catalog and seed entries."""
    if isinstance(node, list):
        out = []
        for item in node:
            if isinstance(item, str) and item in removed:
                continue
            if isinstance(item, dict) and item.get("code") in removed:
                continue
            out.append(remap_document(item, renamed, writings, territories, removed))
        return out
    if isinstance(node, str):
        return renamed.get(node, node)
    if not isinstance(node, dict):
        return node
    out = {renamed.get(k, k): remap_document(v, renamed, writings, territories, removed) for k, v in node.items()}
    if node.get("code") in renamed:  # a catalog / seed entry for a variant
        for field, table in (("writing", writings), ("script", writings), ("dialect", territories)):
            if isinstance(node.get(field), str):
                out[field] = table.get(node[field], node[field])
        if node.get("dialect_name") == "Huilliche":
            out["dialect_name"] = "Williche"
    if "options" in node and "dialects" in node and "prefix" in node:  # the variant selector
        out["options"] = [
            {**o, "code": writings.get(o.get("code"), o.get("code"))} for o in out["options"]
        ]
        out["dialects"] = [
            {
                **d,
                "code": territories.get(d.get("code"), d.get("code")),
                "writings": [writings.get(w, w) for w in d.get("writings") or []],
            }
            for d in out["dialects"]
        ]
    return out


def _uses(apps):
    """(model, field) pairs that point at a language."""
    return [
        (apps.get_model("main", model), field)
        for model, field in (
            ("TranslationPair", "src_lang"),
            ("TranslationPair", "dst_lang"),
            ("TranslationRequest", "src_lang"),
            ("TranslationRequest", "dst_lang"),
            ("TextToSpeechAudio", "language"),
            ("SpeechToTextAudio", "language"),
            ("CacheTTS", "language"),
        )
    ]


def _rewrite_customization(apps, **tables):
    Customization = apps.get_model("customization", "TranslatorCustomization")
    Revision = apps.get_model("customization", "CustomizationRevision")
    for doc in Customization.objects.all():
        doc.published = remap_document(doc.published, **tables) if doc.published else doc.published
        doc.draft = remap_document(doc.draft, **tables) if doc.draft else doc.draft
        doc.save(update_fields=["published", "draft"])
    for revision in Revision.objects.all():
        revision.data = remap_document(revision.data, **tables)
        revision.save(update_fields=["data"])


def forward(apps, schema_editor):
    Lang = apps.get_model("main", "Lang")
    Script = apps.get_model("main", "Script")
    Dialect = apps.get_model("main", "Dialect")
    uses = _uses(apps)

    for code in REMOVED:
        lang = Lang.objects.filter(code=code).first()
        if lang is None:
            continue
        if any(model.objects.filter(**{field: lang}).exists() for model, field in uses):
            print(f"\n  kept {code}: saved translations or recordings use it")
            continue
        lang.delete()

    for old, new in RENAMED.items():
        if not Lang.objects.filter(code=new).exists():
            Lang.objects.filter(code=old).update(code=new)
    for old, new in WRITINGS.items():
        if not Script.objects.filter(code=new).exists():
            Script.objects.filter(code=old).update(code=new)
    for old, new in TERRITORIES.items():
        if not Dialect.objects.filter(code=new).exists():
            Dialect.objects.filter(code=old).update(code=new)
    Dialect.objects.filter(code="williche", name="Huilliche").update(name="Williche")

    Script.objects.filter(code__in=REMOVED_SCRIPTS, lang__isnull=True).delete()
    Dialect.objects.filter(code__in=REMOVED_DIALECTS, lang__isnull=True).delete()

    _rewrite_customization(apps)


def backward(apps, schema_editor):
    """Renames back; removed variants are not restored."""
    Lang = apps.get_model("main", "Lang")
    Script = apps.get_model("main", "Script")
    Dialect = apps.get_model("main", "Dialect")
    for old, new in RENAMED.items():
        Lang.objects.filter(code=new).update(code=old)
    for old, new in WRITINGS.items():
        Script.objects.filter(code=new).update(code=old)
    for old, new in TERRITORIES.items():
        Dialect.objects.filter(code=new).update(code=old)
    _rewrite_customization(
        apps,
        renamed=REVERSED,
        writings={v: k for k, v in WRITINGS.items()},
        territories={v: k for k, v in TERRITORIES.items()},
        removed=set(),
    )


class Migration(migrations.Migration):
    dependencies = [
        ("main", "0057_profile_oral_proficiency"),
        ("customization", "0001_initial"),
    ]

    operations = [migrations.RunPython(forward, backward)]
