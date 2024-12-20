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
import json
import os

from django.core.management.base import BaseCommand
from main.models import Lang, TranslationPair


class Command(BaseCommand):
    help = "Loads data of verified matches from json "

    def add_arguments(self, parser):
        parser.add_argument("file", type=str)

    def handle(self, *args, **options):

        file = options["file"]

        data = []
        with open(os.path.join("data", file), mode="r", encoding="utf-8") as file:
            data = json.load(file)

        for item in data:
            src_lang = Lang.objects.get(code=item["src_lang"])
            dst_lang = Lang.objects.get(code=item["dst_lang"])
            pair = TranslationPair(
                src_lang=src_lang,
                dst_lang=dst_lang,
                src_text=item["src_text"],
                dst_text=item["dst_text"],
                correct=item["correct"],
                validated=True,
            )
            pair.save()
