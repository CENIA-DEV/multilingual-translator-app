# Generated by Django 5.0.1 on 2024-06-25 21:48

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("main", "0009_remove_lang_language_lang_writing_and_more"),
    ]

    operations = [
        migrations.AlterField(
            model_name="lang",
            name="dialect",
            field=models.CharField(max_length=50, null=True),
        ),
    ]
