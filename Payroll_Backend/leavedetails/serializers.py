from rest_framework import serializers
from .models import Employee, LeaveDetails

class LeaveDetailsSerializer(serializers.ModelSerializer):
    employee = serializers.StringRelatedField(read_only=True)
    employee_id = serializers.PrimaryKeyRelatedField(
        queryset=Employee.objects.all(), source='employee', write_only=True
    )

    class Meta:
        model = LeaveDetails
        fields = [
            'id', 'employee', 'employee_id', 'month', 'working_days', 'paid_leaves', 'sick_leaves',
            'unpaid_leaves', 'total_leaves_taken', 'absent_days', 'days_worked',
            'total_paid_leaves_left', 'total_sick_leaves_left'
        ]
        read_only_fields = [
            'working_days', 'paid_leaves', 'sick_leaves', 'unpaid_leaves', 'total_leaves_taken',
            'absent_days', 'days_worked', 'total_paid_leaves_left', 'total_sick_leaves_left'
        ]