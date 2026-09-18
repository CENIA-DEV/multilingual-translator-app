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
"""The data table pages through suggestions; the pages have to line up.

The table used to guess the page size from the length of the page it got back,
so a short last page inflated the page count. These tests pin the contract it
now relies on. Ported from `SuggestionPaginationTests` in voces-platform-backend.
"""
import pytest
from fixtures import *
from main.models import TranslationPair

URL = "/api/suggestions/"


@pytest.fixture
def pairs(create_languages):
    """25 unvalidated pairs, cycling through the three feedback polarities."""
    _, spanish, rapanui, _ = create_languages
    return [
        TranslationPair.objects.create(
            src_lang=spanish,
            dst_lang=rapanui,
            src_text=f"fuente {i:02d}",
            dst_text=f"destino {i:02d}",
            suggestion=f"sugerencia {i:02d}",
            feedback=True,
            correct=[True, False, None][i % 3],
            validated=False,
        )
        for i in range(25)
    ]


def get_page(api_client, **params):
    response = api_client.get(URL, {"validated": "false", "lang": "rap_Latn", **params})
    assert response.status_code == 200, response.content
    return response.json()


@pytest.mark.django_db
def test_paging_covers_every_row_exactly_once(api_client, admin_auth, pairs):
    seen, sizes = [], []
    for page in (1, 2, 3):
        body = get_page(api_client, page=page, page_size=10)
        assert body["count"] == 25
        assert body["page_size"] == 10
        assert body["page"] == page
        sizes.append(len(body["results"]))
        seen.extend(row["id"] for row in body["results"])

    assert sizes == [10, 10, 5]
    assert len(seen) == len(set(seen)), "a row appeared on two pages"
    assert set(seen) == {p.id for p in pairs}, "a row was on no page"


@pytest.mark.django_db
def test_the_page_size_the_client_asks_for_is_the_one_it_gets(
    api_client, admin_auth, pairs
):
    """The client computes the page count from this; a mismatch invents pages."""
    body = get_page(api_client, page_size=7)
    assert body["page_size"] == 7
    assert len(body["results"]) == 7


@pytest.mark.django_db
def test_without_page_size_the_default_is_reported(api_client, admin_auth, pairs):
    """This endpoint has always paged every caller; that has not changed."""
    body = get_page(api_client)
    assert body["count"] == 25
    assert body["page"] == 1
    assert body["page_size"] == len(body["results"]) == 15


@pytest.mark.django_db
def test_a_page_past_the_end_answers_with_the_last_page(api_client, admin_auth, pairs):
    """Rows get accepted and deleted out from under a rendered page number."""
    body = get_page(api_client, page=99, page_size=10)
    assert body["page"] == 3
    assert len(body["results"]) == 5


@pytest.mark.django_db
def test_feedback_polarity_filters_the_query_not_the_page(
    api_client, admin_auth, pairs
):
    positive = get_page(api_client, correct="true", page_size=50)["results"]
    negative = get_page(api_client, correct="false", page_size=50)["results"]
    neither = get_page(api_client, correct="null", page_size=50)["results"]

    assert len(positive) == 9
    assert len(negative) == 8
    assert len(neither) == 8
    assert all(row["correct"] is True for row in positive)
    assert all(row["correct"] is False for row in negative)
    assert all(row["correct"] is None for row in neither)


@pytest.mark.django_db
def test_a_filtered_page_is_full_and_counts_the_filtered_total(
    api_client, admin_auth, pairs
):
    """The count has to be the filtered count, or the footer offers empty pages."""
    body = get_page(api_client, correct="true", page=1, page_size=5)
    assert body["count"] == 9
    assert len(body["results"]) == 5
    assert all(row["correct"] is True for row in body["results"])


@pytest.mark.django_db
def test_validated_and_language_are_applied_before_paging(
    api_client, admin_auth, pairs, create_languages
):
    english, spanish, _, _ = create_languages
    TranslationPair.objects.create(
        src_lang=spanish,
        dst_lang=english,
        src_text="otra lengua",
        dst_text="another language",
        feedback=True,
        correct=True,
        validated=False,
    )
    pairs[0].validated = True
    pairs[0].save()

    body = get_page(api_client, page=1, page_size=50)
    assert body["count"] == 24
    assert {row["dst_lang"]["code"] for row in body["results"]} == {"rap_Latn"}
    assert all(row["validated"] is False for row in body["results"])
