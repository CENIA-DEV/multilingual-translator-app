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
"""What the model server is told about each language: a language with
territories or alphabets goes as its base language's code plus those as
inputs of their own; every other language keeps its full code and nothing
else."""
import pytest
from main.models import Dialect, Lang, Script
from main.utils import generate_payload, model_language


@pytest.fixture
def languages():
    latin = Script.objects.create(code="Latn", name="Latin")
    raguileo = Script.objects.create(code="raguileo", name="Raguileo")
    cacicado = Script.objects.create(code="cacicado-huilliche", name="Cacicado")
    nagche = Dialect.objects.create(code="nagche", name="Nagche")
    williche = Dialect.objects.create(code="williche", name="Williche")
    Lang.objects.create(code="spa_Latn", script=latin, name="Español")
    Lang.objects.create(code="rap_Latn", name="Rapa Nui", is_native=True)
    Lang.objects.create(code="arn_Latn", script=latin, name="Mapuzugun", is_native=True)
    Lang.objects.create(code="arn_raguileo_nagche", script=raguileo, dialect=nagche, name="Nagche Raguileo", is_native=True)
    Lang.objects.create(
        code="arn_cacicado-huilliche_williche", script=cacicado, dialect=williche, name="Williche Cacicado", is_native=True
    )


def inputs_of(payload):
    return {i["name"]: i["data"][0][0] for i in payload["inputs"]}


@pytest.mark.django_db
@pytest.mark.parametrize(
    "code, expected",
    [
        ("spa_Latn", ("spa_Latn", {})),  # no variants: unchanged
        ("rap_Latn", ("rap_Latn", {})),  # no script at all: unchanged
        ("arn_raguileo_nagche", ("arn_Latn", {"territory": "nagche", "writing": "raguileo"})),
        (
            "arn_cacicado-huilliche_williche",
            ("arn_Latn", {"territory": "williche", "writing": "cacicado-huilliche"}),
        ),
        ("arn_Latn", ("arn_Latn", {})),  # the language itself: neither
        ("arn_amu_pewenche", ("arn_Latn", {})),  # not in the catalog: the base code still
    ],
)
def test_model_language(languages, code, expected):
    assert model_language(code) == expected


@pytest.mark.django_db
def test_payload_to_a_variant_names_its_territory_and_alphabet(languages):
    payload = generate_payload("Hola", "spa_Latn", "arn_raguileo_nagche")
    assert inputs_of(payload) == {
        "input_text": "Hola",
        "source_lang": "spa_Latn",
        "target_lang": "arn_Latn",
        "target_territory": "nagche",
        "target_writing": "raguileo",
    }


@pytest.mark.django_db
def test_payload_from_a_variant_names_the_source_side(languages):
    inputs = inputs_of(generate_payload("Mari mari", "arn_raguileo_nagche", "spa_Latn"))
    assert inputs["source_lang"] == "arn_Latn" and inputs["target_lang"] == "spa_Latn"
    assert inputs["source_territory"] == "nagche" and inputs["source_writing"] == "raguileo"
    assert "target_territory" not in inputs and "target_writing" not in inputs


@pytest.mark.django_db
def test_payload_without_variants_is_unchanged(languages):
    payload = generate_payload("Hola", "spa_Latn", "rap_Latn")
    assert [i["name"] for i in payload["inputs"]] == ["input_text", "source_lang", "target_lang"]
    assert inputs_of(payload)["target_lang"] == "rap_Latn"
