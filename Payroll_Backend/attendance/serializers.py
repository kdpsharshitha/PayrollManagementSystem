from rest_framework import serializers
from .models import Attendance,Employee

class AttendanceSerializer(serializers.ModelSerializer):
    employee = serializers.StringRelatedField(read_only=True)
    employee_id = serializers.PrimaryKeyRelatedField(
        queryset=Employee.objects.all(), source='employee', write_only=True
    )

    class Meta:
        model = Attendance
        fields = ['id', 'employee', 'employee_id', 'date', 'entry_time', 'exit_time', 'work_time', 'status']
        read_only_fields = ['work_time']