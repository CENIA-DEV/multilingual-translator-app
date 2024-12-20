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

from datetime import datetime, timedelta

from django.core.management.base import BaseCommand
from main.models import Profile, User


def create_user(username, password, first_name, last_name, role, is_active=True):
    user = User.objects.create_user(
        username=username,
        email=username,
        first_name=first_name,
        last_name=last_name,
        password=password,
        is_active=is_active,
    )
    Profile.objects.create(
        user=user,
        role=role,
        date_of_birth=datetime.now() - timedelta(days=365 * 20),
        organization="Cenia",
    )
    return user


class Command(BaseCommand):
    help = "Creates a user "

    def add_arguments(self, parser):
        parser.add_argument("username", type=str)
        parser.add_argument("password", type=str)
        parser.add_argument("first_name", type=str)
        parser.add_argument("last_name", type=str)

    def handle(self, *args, **options):

        username = options["username"]
        password = options["password"]
        first_name = options["first_name"]
        last_name = options["last_name"]
        create_user(username, password, first_name, last_name, Profile.ADMIN)
