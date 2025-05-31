from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db.models import Sum
from datetime import date

class LeaveRequest(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]
    
    LEAVE_TYPE_CHOICES = [
        ('paid', 'Paid Leave'),
        ('sick', 'Sick Leave'),
        ('unpaid', 'Unpaid Leave'),
    ]
    
    requester = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="leave_requests",
    )
    employee_id = models.CharField(max_length=6, blank=True)
    employee_name = models.CharField(max_length=255, blank=True)
    
    start_date = models.DateField()
    end_date = models.DateField()
    
    total_days = models.IntegerField(blank=True, null=True)
    
    leave_type = models.CharField(max_length=10, choices=LEAVE_TYPE_CHOICES, default='paid')
    description = models.TextField(blank=True, null=True)
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # Constants representing full annual leave entitlements.
    FULL_PAID_LEAVE_ENTITLEMENT = 9
    FULL_SICK_LEAVE_ENTITLEMENT = 2

    def clean(self):
        errors = {}

        # Standard check for valid dates.
        if self.start_date > self.end_date:
            errors["start_date"] = "Start date cannot be after end date."

        requested_days = self.total_days or ((self.end_date - self.start_date).days + 1)

        ################################
        # Constraint: Pro-rate Entitlements
        ################################
        # Assume the user model contains 'date_joined' (Django's default User has this field).
        join_date = self.requester.date_joined
        current_year = self.start_date.year
        if join_date.year == current_year:
            # Calculate the number of months remaining including the join month.
            # For example, if join_date is in July, months_remaining = 13 - 7 = 6.
            months_remaining = 13 - join_date.month
            prorated_paid = int((self.FULL_PAID_LEAVE_ENTITLEMENT * months_remaining) / 12)
            prorated_sick = int((self.FULL_SICK_LEAVE_ENTITLEMENT * months_remaining) / 12)
        else:
            prorated_paid = self.FULL_PAID_LEAVE_ENTITLEMENT
            prorated_sick = self.FULL_SICK_LEAVE_ENTITLEMENT

        ################################
        # Constraint: Paid Leave Rules
        ################################
        if self.leave_type == "paid":
            month = self.start_date.month
            year = self.start_date.year
            
            # Only consider approved requests for counting.
            qs_monthly = LeaveRequest.objects.filter(
                requester=self.requester,
                leave_type="paid",
                status="approved",
                start_date__year=year,
                start_date__month=month
            )
            if self.pk:
                qs_monthly = qs_monthly.exclude(pk=self.pk)
            if qs_monthly.exists():
                errors["leave_type"] = "You have already availed your paid leave for this month."
            
            qs_annual = LeaveRequest.objects.filter(
                requester=self.requester,
                leave_type="paid",
                status="approved",
                start_date__year=year
            )
            if self.pk:
                qs_annual = qs_annual.exclude(pk=self.pk)
            total_paid = qs_annual.count()  # Each approved request counts as 1 day.
            effective_paid = 1 if requested_days >= 1 else 0
            if total_paid + effective_paid > prorated_paid:
                errors["leave_type"] = f"This request exceeds your prorated annual paid leave entitlement ({prorated_paid} day(s))."

        ################################
        # Constraint: Sick Leave Rules
        ################################
        elif self.leave_type == "sick":
            qs_annual = LeaveRequest.objects.filter(
                requester=self.requester,
                leave_type="sick",
                status="approved",
                start_date__year=self.start_date.year
            )
            total_sick_used = qs_annual.aggregate(total=Sum("total_days"))["total"] or 0
            remaining_allowed = max(0, prorated_sick - total_sick_used)
            if remaining_allowed <= 0:
                self.leave_type = "unpaid"
            elif requested_days > remaining_allowed:
                extra_days = requested_days - remaining_allowed
                self._warning_message = (
                    f"Only {remaining_allowed} day(s) will be applied as sick leave; "
                    f"{extra_days} day(s) will be treated as unpaid."
                )

        ################################
        # Constraint: Paid Leave cannot be clubbed with Sick Leave
        ################################
        # Here we check other non-rejected (approved or pending) leave requests of the same requester
        # to see if any are contiguous with the current request.
        from datetime import timedelta
        adjacent_leaves = LeaveRequest.objects.filter(
            requester=self.requester
        ).exclude(status="rejected")
        if self.pk:
            adjacent_leaves = adjacent_leaves.exclude(pk=self.pk)
        # Check if any adjacent leave has a different type (one is paid and one is sick)
        for leave in adjacent_leaves:
            # If leave.end_date is immediately before the new request's start_date...
            if leave.end_date and self.start_date and (leave.end_date + timedelta(days=1) == self.start_date):
                if (leave.leave_type == "paid" and self.leave_type == "sick") or \
                   (leave.leave_type == "sick" and self.leave_type == "paid"):
                    errors["leave_type"] = "Paid leave cannot be clubbed with sick leave."
                    break
            # Also check if new request's end_date is immediately before an existing leave's start_date.
            if self.end_date and leave.start_date and (self.end_date + timedelta(days=1) == leave.start_date):
                if (leave.leave_type == "paid" and self.leave_type == "sick") or \
                   (leave.leave_type == "sick" and self.leave_type == "paid"):
                    errors["leave_type"] = "Paid leave cannot be clubbed with sick leave."
                    break

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        if self.requester:
            if not self.employee_id:
                self.employee_id = str(self.requester.id)
            if not self.employee_name:
                self.employee_name = self.requester.name or self.requester.email
        if self.start_date and self.end_date:
            delta = self.end_date - self.start_date
            self.total_days = delta.days + 1
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"LeaveRequest({self.employee_name} - {self.leave_type}, {self.status})"

    @property
    def warning_message(self):
        return getattr(self, "_warning_message", "")