# Generated by Django 5.1.1 on 2024-10-09 18:59

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("main", "0029_invitationtoken_first_name_invitationtoken_last_name_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="profile",
            name="organization",
            field=models.CharField(default="Cenia", max_length=120),
            preserve_default=False,
        ),
    ]
