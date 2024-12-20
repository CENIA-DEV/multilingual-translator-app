# Generated by Django 5.0.1 on 2024-06-27 18:49

import django.db.models.functions.text
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("main", "0015_remove_translationpair_text_upper_index_and_more"),
    ]

    operations = [
        migrations.RemoveIndex(
            model_name="translationpair",
            name="textIndex",
        ),
        migrations.AddIndex(
            model_name="translationpair",
            index=models.Index(
                django.db.models.functions.text.Upper("src_text"),
                django.db.models.functions.text.Upper("dst_text"),
                name="text_upper_index",
            ),
        ),
    ]
