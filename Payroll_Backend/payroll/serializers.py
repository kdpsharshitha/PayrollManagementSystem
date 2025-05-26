from rest_framework import serializers
from .models import Payroll
from employee.models import Employee


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
