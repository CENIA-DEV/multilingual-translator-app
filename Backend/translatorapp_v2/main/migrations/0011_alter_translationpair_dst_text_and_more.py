# Generated by Django 5.0.1 on 2024-06-26 17:14

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("main", "0010_alter_lang_dialect"),
    ]

    operations = [
        migrations.AlterField(
            model_name="translationpair",
            name="dst_text",
            field=models.CharField(max_length=10000),
        ),
        migrations.AlterField(
            model_name="translationpair",
            name="src_text",
            field=models.CharField(max_length=10000),
        ),
    ]
