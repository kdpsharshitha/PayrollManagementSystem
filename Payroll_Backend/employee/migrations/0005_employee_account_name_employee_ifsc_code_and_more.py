# Generated by Django 5.2.1 on 2025-07-05 06:42

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('employee', '0004_alter_employee_date_joined'),
    ]

    operations = [
        migrations.AddField(
            model_name='employee',
            name='account_name',
            field=models.CharField(blank=True, max_length=50, null=True),
        ),
        migrations.AddField(
            model_name='employee',
            name='ifsc_code',
            field=models.CharField(blank=True, max_length=15, null=True),
        ),
        migrations.AddField(
            model_name='employee',
            name='supervisor',
            field=models.CharField(blank=True, max_length=50, null=True),
        ),
        migrations.AddField(
            model_name='employee',
            name='supervisor_email',
            field=models.EmailField(blank=True, max_length=254, null=True),
        ),
    ]
