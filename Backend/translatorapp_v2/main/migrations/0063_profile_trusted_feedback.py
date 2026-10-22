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
"""Trusted users: suggestions that answer from the translation cache without
waiting for validation.

Every user that exists when this runs (production, staging) starts untrusted:
the column's default fills them with False, and `untrust_existing` says so
explicitly. Only an administrator turns it on afterwards, user by user.
"""
from django.db import migrations, models


def untrust_existing(apps, schema_editor):
    apps.get_model("main", "Profile").objects.update(trusted_feedback=False)


class Migration(migrations.Migration):
    dependencies = [
        ("main", "0062_word_variant_labels"),
    ]

    operations = [
        migrations.AddField(
            model_name="profile",
            name="trusted_feedback",
            field=models.BooleanField(
                default=False,
                help_text=(
                    "Suggestions from this user enter the translation cache "
                    "without waiting for validation"
                ),
            ),
        ),
        migrations.RunPython(untrust_existing, migrations.RunPython.noop),
    ]
