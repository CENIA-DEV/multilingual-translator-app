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
import json
import re
from datetime import timedelta

from customization.models import (
    CustomizationAsset,
    CustomizationRevision,
    TranslatorCustomization,
)
from django.core.management.base import BaseCommand
from django.utils import timezone

ASSET_REF = re.compile(
    r"asset:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})"
)


def referenced_asset_ids():
    documents = []
    customization = TranslatorCustomization.load()
    documents += [customization.draft, customization.published]
    documents += CustomizationRevision.objects.values_list("data", flat=True)
    found = set()
    for document in documents:
        if document:
            found.update(ASSET_REF.findall(json.dumps(document)))
    return found


class Command(BaseCommand):
    help = (
        "Delete uploaded customization files that no draft, published version "
        "or revision references (only files older than --min-age-hours)."
    )

    def add_arguments(self, parser):
        parser.add_argument("--min-age-hours", type=int, default=24)
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **options):
        cutoff = timezone.now() - timedelta(hours=options["min_age_hours"])
        keep = referenced_asset_ids()
        orphans = (
            CustomizationAsset.objects.filter(created_at__lt=cutoff)
            .exclude(id__in=keep)
            .defer("data")
        )
        count = orphans.count()
        if not options["dry_run"]:
            orphans.delete()
        verb = "Would delete" if options["dry_run"] else "Deleted"
        self.stdout.write(f"{verb} {count} unreferenced file(s).")
