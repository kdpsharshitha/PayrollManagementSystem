# Generated by Django 5.2.1 on 2025-06-13 08:59

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('leavedetails', '0003_alter_leavedetails_absent_days_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='leavedetails',
            name='applied_unpaid_leaves',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=5),
        ),
        migrations.AddField(
            model_name='leavedetails',
            name='sandwich_unpaid_leaves',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=5),
        ),
    ]
