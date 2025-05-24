from rest_framework import serializers
from .models import Employee, Attendance, LeaveDetails, Payroll

class EmployeeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Employee
        fields = '__all__'


class AttendanceSerializer(serializers.ModelSerializer):
    employee = serializers.StringRelatedField(read_only=True)
    employee_id = serializers.PrimaryKeyRelatedField(
        queryset=Employee.objects.all(), source='employee', write_only=True
    )

    class Meta:
        model = Attendance
        fields = ['id', 'employee', 'employee_id', 'date', 'entry_time', 'exit_time', 'work_time', 'status']
        read_only_fields = ['work_time']


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


class PayrollSerializer(serializers.ModelSerializer):
    employee = serializers.StringRelatedField(read_only=True)
    employee_id = serializers.PrimaryKeyRelatedField(
        queryset=Employee.objects.all(), source='employee', write_only=True
    )

    class Meta:
        model = Payroll
        fields = [
            'id', 'employee', 'employee_id', 'fee_per_month', 'pay_structure', 'month', 'base_pay',
            'variable_pay', 'base_pay_earned', 'perform_category', 'perform_comp_payable',
            'fee_earned', 'tds', 'reimbursement', 'net_fee_earned', 'generated_on'
        ]
        read_only_fields = [
            'fee_per_month', 'pay_structure', 'base_pay', 'variable_pay', 'base_pay_earned',
            'perform_comp_payable', 'fee_earned', 'tds', 'net_fee_earned', 'generated_on'
        ]
