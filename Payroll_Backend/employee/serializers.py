from rest_framework import serializers
from .models import Employee
from django.contrib.auth.hashers import make_password  # ✅ Import the function

class EmployeeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Employee
        fields = '__all__'
        extra_kwargs = {
            'password': {'write_only': True},  # never return password in API
        }
    
    def create(self, validated_data):
        validated_data['password'] = make_password(validated_data['password'])  # ✅ Hash the password before saving
        return super().create(validated_data)
    
    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.password = make_password(password)
        instance.save()
        return instance