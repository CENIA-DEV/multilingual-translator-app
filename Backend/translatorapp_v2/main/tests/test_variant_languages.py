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
"""Migration 0060 creates the Mapuzungun variants the translator offers where
they are missing (a database that only had the Nguluche rows), so the backend
accepts them and sends their territory and alphabet to the model."""
import importlib

import pytest
from django.apps import apps as django_apps
from main.models import Dialect, Lang, Script
from main.utils import generate_payload

migration = importlib.import_module("main.migrations.0060_add_arn_variant_languages")


def inputs_of(payload):
    return {i["name"]: i["data"][0][0] for i in payload["inputs"]}


@pytest.fixture
def nguluche_only():
    """A Mapuzungun database as staging had it: only the Nguluche rows."""
    alphabet = Script.objects.create(code="azumchefe", name="Azümchefe")
    nguluche = Dialect.objects.create(code="n", name="Nguluche")
    Lang.objects.create(
        code="arn_a0_n", name="Nguluche", script=alphabet, dialect=nguluche, is_native=True
    )


@pytest.mark.django_db
def test_creates_the_variants(nguluche_only):
    migration.forward(django_apps, None)
    for code, _, writing, territory in migration.VARIANTS:
        lang = Lang.objects.select_related("script", "dialect").get(code=code)
        assert lang.is_native
        assert lang.script.code == writing and lang.dialect.code == territory
    assert len(migration.VARIANTS) == 14
    assert Lang.objects.get(code="arn_Latn").is_native
    assert Script.objects.get(code="azumchefe").name == "Azümchefe"  # reused


@pytest.mark.django_db
def test_creates_only_what_is_missing(nguluche_only):
    migration.forward(django_apps, None)
    Lang.objects.filter(code="arn_raguileo_nagche").delete()
    custom = Lang.objects.get(code="arn_amu_pewenche")
    custom.name = "Pewenche (custom)"
    custom.save()

    migration.forward(django_apps, None)
    migration.forward(django_apps, None)  # running it again changes nothing

    assert Lang.objects.filter(code="arn_raguileo_nagche").count() == 1
    assert Lang.objects.get(code="arn_amu_pewenche").name == "Pewenche (custom)"
    assert Script.objects.filter(code="raguileo").count() == 1
    assert Dialect.objects.filter(code="nagche").count() == 1


@pytest.mark.django_db
def test_leaves_a_database_without_mapuzungun_alone():
    Lang.objects.create(code="rap_Latn", name="Rapa Nui", is_native=True)
    migration.forward(django_apps, None)
    assert not Lang.objects.filter(code__startswith="arn_").exists()
    assert not Script.objects.filter(code="raguileo").exists()


@pytest.mark.django_db
def test_payload_to_a_created_variant(nguluche_only):
    migration.forward(django_apps, None)
    inputs = inputs_of(generate_payload("Hola", "spa_Latn", "arn_azumchefe_nagche"))
    assert inputs["target_lang"] == "arn_Latn"
    assert inputs["target_territory"] == "nagche"
    assert inputs["target_writing"] == "azumchefe"
