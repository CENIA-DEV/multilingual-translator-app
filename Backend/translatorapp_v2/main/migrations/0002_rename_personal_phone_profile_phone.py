# Generated by Django 5.0.1 on 2024-03-28 21:18

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("main", "0001_initial"),
    ]

    operations = [
        migrations.RenameField(
            model_name="profile",
            old_name="personal_phone",
            new_name="phone",
        ),
    ]