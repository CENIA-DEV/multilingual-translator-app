# Generated by Django 5.0.1 on 2024-06-27 18:42

import django.contrib.postgres.indexes
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("main", "0014_remove_translationpair_textindex_and_more"),
    ]

    operations = [
        migrations.RemoveIndex(
            model_name="translationpair",
            name="text_upper_index",
        ),
        migrations.AddIndex(
            model_name="translationpair",
            index=django.contrib.postgres.indexes.GinIndex(
                fields=["src_text", "dst_text"], name="textIndex"
            ),
        ),
    ]
