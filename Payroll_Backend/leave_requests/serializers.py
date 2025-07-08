# serializers.py

from rest_framework import serializers
from django.core.exceptions import ValidationError as DjangoValidationError
from .models import LeaveRequest

class LeaveRequestSerializer(serializers.ModelSerializer):
    warning_message = serializers.ReadOnlyField()  # model may set _warning_message during clean()

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
            "note",
            "half_day_period",
        ]
        read_only_fields = [
            "id",
            "employee_id",
            "employee_name",
            "total_days",
            "created_at",
            # We also make "status" read‐only here so that only our view can set it.
        ]

    def validate(self, data):
        if data["start_date"] > data["end_date"]:
            raise serializers.ValidationError("End date must be after start date.")
        return data

    def create(self, validated_data):
        """
        Override create() so that `requester` is always set to the current user.
        The model.save() will then run full_clean(), build `self._warning_message`,
        and persist that into `self.note`.
        """
        user = self.context["request"].user
        return LeaveRequest.objects.create(requester=user, **validated_data)