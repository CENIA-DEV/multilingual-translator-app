# Generated by Django 5.0.1 on 2024-07-02 18:17

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("main", "0019_translationpair_text_index"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="translationpair",
            name="model_name",
            field=models.CharField(default="first-rap-arn", max_length=100),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="translationpair",
            name="model_version",
            field=models.CharField(default=1, max_length=100),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="translationpair",
            name="user",
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
