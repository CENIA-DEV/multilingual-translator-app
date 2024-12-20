# Generated by Django 5.0.1 on 2024-09-06 16:22

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("main", "0027_alter_invitationtoken_email_and_more"),
    ]

    operations = [
        migrations.AlterField(
            model_name="profile",
            name="role",
            field=models.CharField(
                choices=[
                    ("AD", "Admin"),
                    ("NAD", "NativeAdmin"),
                    ("ANR", "Annotator"),
                    ("NTV", "Native"),
                    ("USR", "User"),
                ],
                default="USR",
                max_length=120,
            ),
        ),
    ]
