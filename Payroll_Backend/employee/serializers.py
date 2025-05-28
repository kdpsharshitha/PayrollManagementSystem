from rest_framework import serializers
from .models import Employee
from django.contrib.auth.hashers import make_password  # ✅ Import the function

class EmployeeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Employee
        fields = [
            'email',  # ✅ Now the primary identifier
            'username',
            'gender',
            'account_type',
            'pan_no',
            'phone_no',
            'emergency_phone_no',
            'address',
            'employment_type',
            'role',
            'designation',
            'date_joined',
            'fee_per_month',
            'pay_structure',
            'password'  # ✅ Included for user creation, but hidden in responses
        ]
        extra_kwargs = {
            'password': {'write_only': True}  # ✅ Ensures password is not exposed in API responses
        }

    def create(self, validated_data):
        validated_data['password'] = make_password(validated_data['password'])  # ✅ Hash the password before saving
        return super().create(validated_data)