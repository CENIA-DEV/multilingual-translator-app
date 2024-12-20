# Generated by Django 5.1.1 on 2024-10-23 14:27

import datetime
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("main", "0033_alter_translationpair_model_name_and_more"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.RemoveIndex(
            model_name="translationpair",
            name="text_index",
        ),
        migrations.RemoveField(
            model_name="profile",
            name="gender",
        ),
        migrations.RemoveField(
            model_name="profile",
            name="phone",
        ),
        migrations.AddField(
            model_name="profile",
            name="date_of_birth",
            field=models.DateField(default=datetime.date(1997, 10, 19)),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="profile",
            name="proficiency",
            field=models.CharField(
                choices=[
                    ("Non-Speaker", "Non-Speaker"),
                    ("Fluent", "Fluent"),
                    ("Beginner", "Beginner"),
                ],
                default="Non-Speaker",
                max_length=120,
            ),
        ),
        migrations.AddField(
            model_name="translationpair",
            name="feedback",
            field=models.BooleanField(null=True),
        ),
        migrations.AddField(
            model_name="translationpair",
            name="suggestion",
            field=models.CharField(max_length=10000, null=True),
        ),
        migrations.AddField(
            model_name="translationpair",
            name="updated_at",
            field=models.DateTimeField(auto_now=True),
        ),
        migrations.AddField(
            model_name="translationpair",
            name="validated",
            field=models.BooleanField(null=True),
        ),
        migrations.AlterField(
            model_name="invitationtoken",
            name="organization",
            field=models.CharField(max_length=128, null=True),
        ),
        migrations.AlterField(
            model_name="profile",
            name="organization",
            field=models.CharField(default=None, max_length=120),
        ),
        migrations.AlterField(
            model_name="profile",
            name="role",
            field=models.CharField(
                choices=[
                    ("Admin", "Administrator"),
                    ("NativeAdmin", "Native-Administrator"),
                    ("Annotator", "Annotator"),
                    ("Native", "Native"),
                    ("User", "User"),
                ],
                default="User",
                max_length=120,
            ),
        ),
        migrations.AlterField(
            model_name="requestaccess",
            name="organization",
            field=models.CharField(max_length=128, null=True),
        ),
        migrations.AlterField(
            model_name="requestaccess",
            name="reason",
            field=models.CharField(
                choices=[
                    ("Curiosity", "Curiosity"),
                    ("Learning", "Learning"),
                    ("Work", "Work"),
                    ("Collaboration", "Collaboration"),
                ],
                default="Curiosity",
                max_length=120,
            ),
        ),
        migrations.AlterField(
            model_name="translationpair",
            name="correct",
            field=models.BooleanField(null=True),
        ),
        migrations.AddIndex(
            model_name="translationpair",
            index=models.Index(
                fields=["validated"], name="main_transl_validat_75cf19_idx"
            ),
        ),
        migrations.AddIndex(
            model_name="translationpair",
            index=models.Index(
                fields=["feedback"], name="main_transl_feedbac_cd4adf_idx"
            ),
        ),
        migrations.AddIndex(
            model_name="translationpair",
            index=models.Index(
                fields=["correct"], name="main_transl_correct_3c6097_idx"
            ),
        ),
        migrations.AddIndex(
            model_name="translationpair",
            index=models.Index(
                fields=["src_lang", "dst_lang"], name="main_transl_src_lan_ed695c_idx"
            ),
        ),
    ]
