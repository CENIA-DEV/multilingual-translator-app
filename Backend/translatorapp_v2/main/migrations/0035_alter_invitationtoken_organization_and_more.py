# Generated by Django 5.1.1 on 2024-10-23 14:45

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("main", "0034_remove_translationpair_text_index_and_more"),
    ]

    operations = [
        migrations.AlterField(
            model_name="invitationtoken",
            name="organization",
            field=models.CharField(default=None, max_length=128, null=True),
        ),
        migrations.AlterField(
            model_name="profile",
            name="organization",
            field=models.CharField(default=None, max_length=120, null=True),
        ),
        migrations.AlterField(
            model_name="requestaccess",
            name="organization",
            field=models.CharField(default=None, max_length=128, null=True),
        ),
    ]
