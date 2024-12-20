# Generated by Django 5.1.1 on 2024-12-04 21:10

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("main", "0039_alter_translationpair_validated"),
    ]

    operations = [
        migrations.CreateModel(
            name="Dialect",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("code", models.CharField(max_length=50, unique=True)),
                ("name", models.CharField(max_length=100)),
            ],
        ),
        migrations.CreateModel(
            name="Script",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("code", models.CharField(max_length=50, unique=True)),
                ("name", models.CharField(max_length=100)),
            ],
        ),
        migrations.RemoveField(
            model_name="lang",
            name="writing",
        ),
        migrations.AlterField(
            model_name="lang",
            name="dialect",
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                to="main.dialect",
            ),
        ),
        migrations.AddField(
            model_name="lang",
            name="script",
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                to="main.script",
            ),
        ),
        migrations.AddIndex(
            model_name="lang",
            index=models.Index(fields=["code"], name="main_lang_code_fc743c_idx"),
        ),
    ]
