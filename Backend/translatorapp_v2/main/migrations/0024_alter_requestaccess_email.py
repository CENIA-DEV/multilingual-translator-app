# Generated by Django 5.0.1 on 2024-07-30 16:59

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("main", "0023_alter_requestaccess_approved"),
    ]

    operations = [
        migrations.AlterField(
            model_name="requestaccess",
            name="email",
            field=models.CharField(default="", max_length=128),
        ),
    ]
