from rest_framework import serializers
from .models import LeaveRequest

class LeaveRequestSerializer(serializers.ModelSerializer):
    warning_message = serializers.ReadOnlyField()  # Removed source attribute
    
    class Meta:
        model = LeaveRequest
        fields = [
            "id", 
            "employee_id",    
            "employee_name",  
            "start_date",     
            "end_date",       
            "total_days",     
            "leave_type",     
            "description",    
            "warning_message",
            "created_at",     
            "status",
        ]
        read_only_fields = [
            "id", 
            "employee_id",
            "employee_name",
            "total_days",
            "created_at",
            "warning_message"
        ]
    
    def validate(self, data):
        if data["start_date"] > data["end_date"]:
            raise serializers.ValidationError("End date must be after start date.")
        return data

    def create(self, validated_data):
        instance = LeaveRequest(**validated_data)
        try:
            instance.full_clean()
        except serializers.ValidationError as e:
            raise serializers.ValidationError(e.detail)
        instance.save()
        return instance