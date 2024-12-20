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
from main.models import Dialect, Lang, Script


class Command(BaseCommand):
    help = "Loads language data "

    def add_arguments(self, parser):
        parser.add_argument("lang", type=str)
        parser.add_argument("data_dir", type=str, default="data")

    def handle(self, *args, **options):

        lang = options["lang"]
        data_dir = options["data_dir"]
        with open(
            os.path.join(data_dir, f"langs_{lang}.json"), mode="r", encoding="utf-8"
        ) as file:
            data = json.load(file)

        for item in data:
            script_code = item.pop("script")
            script_name = item.pop("script_name")
            dialect_code = item.pop("dialect")
            dialect_name = item.pop("dialect_name")
            script = Script.objects.get_or_create(code=script_code, name=script_name)[0]
            Script.objects.filter(code=script_code)

            dialect = (
                Dialect.objects.get_or_create(code=dialect_code, name=dialect_name)[0]
                if dialect_code
                else None
            )

            if not Lang.objects.filter(code=item["code"]).exists():
                Lang.objects.get_or_create(
                    code=item["code"], name=item["name"], script=script, dialect=dialect
                )
            else:
                print(f"Language {item['code']} already exists")
                lang = Lang.objects.get(code=item["code"])
                lang.name = item["name"]
                lang.script = script
                lang.dialect = dialect
                lang.save()
