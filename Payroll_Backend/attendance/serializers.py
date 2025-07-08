# attendance/serializers.py

from rest_framework import serializers
from .models import Attendance
from employee.models import Employee

class AttendanceSerializer(serializers.ModelSerializer):
    employee = serializers.StringRelatedField(read_only=True)
    employee_id = serializers.PrimaryKeyRelatedField(
        queryset=Employee.objects.all(),
        source='employee',
        write_only=True
    )
    emp_id = serializers.IntegerField(source='employee.id', read_only=True)
    # read-only: the employee’s name
    emp_name = serializers.CharField(source='employee.name', read_only=True)

    class Meta:
        model = Attendance
        fields = [
            'id',
            'employee',
            'emp_id',       # read-only
            'emp_name',
            'employee_id',
            'date',
            'entry_time',
            'exit_time',
            'work_time',
            'status','entry_latitude', 'entry_longitude',
            'exit_latitude',  'exit_longitude',
        ]
        read_only_fields = ['work_time']


class LeaveSummarySerializer(serializers.Serializer):
    remaining_paid_leaves = serializers.IntegerField()
    remaining_sick_leaves = serializers.IntegerField()
    month_paid_leaves = serializers.IntegerField()
    month_half_paid_leaves = serializers.IntegerField()
    yesterday_status = serializers.CharField(allow_null=True)
