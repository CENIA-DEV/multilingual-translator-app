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

from django.core.management.base import BaseCommand
from main.models import Lang, RequestAccess, TranslationPair


class Command(BaseCommand):
    help = "Deletes all data from table"

    def add_arguments(self, parser):
        parser.add_argument(
            "collection", type=str, choices=["langs", "pairs", "requests"]
        )

    def handle(self, *args, **options):
        collection = options["collection"]
        if collection == "langs":
            entries = Lang.objects.all()
        elif collection == "pairs":
            entries = TranslationPair.objects.all()
        elif collection == "requests":
            entries = RequestAccess.objects.all()
        else:
            return "Not a valid collection!"
        entries.delete()
