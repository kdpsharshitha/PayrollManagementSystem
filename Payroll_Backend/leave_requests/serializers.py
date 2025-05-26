from rest_framework import serializers
from .models import LeaveRequest

class LeaveRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = LeaveRequest
        fields = ["id", "start_date", "end_date", "reason", "status", "requester", "created_at", "updated_at"]  # ✅ Explicit field definition
        read_only_fields = ("status", "created_at", "updated_at", "requester")  # ✅ Ensure requester is set by the view

    def validate(self, data):
        """ ✅ Add custom validation to enforce logical date constraints """
        if data["start_date"] >= data["end_date"]:
            raise serializers.ValidationError("End date must be after start date.")
        return data