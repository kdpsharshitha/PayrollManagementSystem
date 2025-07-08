from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db.models import Sum
from datetime import date, timedelta

class LeaveRequest(models.Model):
    # Status options for leave requests.
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]
    
    # Leave type options.
    LEAVE_TYPE_CHOICES = [
        ('Half Paid Leave', 'Half Paid Leave'),
        ('UnPaid Leave', 'UnPaid Leave'),
        ('Half UnPaid Leave', 'Half UnPaid Leave'),
        ('paid', 'Paid Leave'),
        ('sick', 'Sick Leave'),
        ('unpaid', 'Unpaid Leave'),
    ]

    HALF_DAY_CHOICES = [
    ("morning", "Morning"),
    ("afternoon", "Afternoon"),
    ] 
    
    # The user that submits the leave request.
    requester = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="leave_requests",
    )
    # These fields cache details from the requester.
    employee_id   = models.CharField(max_length=6, blank=True)
    employee_name = models.CharField(max_length=255, blank=True)

    # New: field to store any warning/note generated during validation
    note = models.TextField(blank=True, null=True)
    half_day_period = models.CharField(
        max_length=9,
        choices=HALF_DAY_CHOICES,
        blank=True,
        null=True,
        help_text="If half‑day leave, did they take morning or afternoon?"
    )
    
    start_date = models.DateField()
    end_date   = models.DateField()
    
    # Total number of leave days requested.
    total_days = models.IntegerField(blank=True, null=True)
    
    leave_type  = models.CharField(max_length=20, choices=LEAVE_TYPE_CHOICES, default='paid')
    description = models.TextField(blank=True, null=True)
    
    status     = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # Annual leave entitlements.
    FULL_PAID_LEAVE_ENTITLEMENT = 9
    FULL_SICK_LEAVE_ENTITLEMENT = 2

    def clean(self):
        errors = {}
        # Reset any previous warning message
        if hasattr(self, "_warning_message"):
            del self._warning_message
        
        # ----- Validate Date Range -----
        if self.start_date > self.end_date:
            errors["start_date"] = "Start date cannot be after end date."
        
        # Calculate requested days (use provided total_days if present, otherwise compute).
        requested_days = self.total_days or ((self.end_date - self.start_date).days + 1)
        
        # ----- Pro‐rate Entitlement -----
        join_date = self.requester.date_joined
        current_year = self.start_date.year
        if join_date.year == current_year:
            months_remaining = 13 - join_date.month  # e.g., if joined in July, months_remaining = 6
            prorated_paid = int((self.FULL_PAID_LEAVE_ENTITLEMENT * months_remaining) / 12)
            prorated_sick = int((self.FULL_SICK_LEAVE_ENTITLEMENT * months_remaining) / 12)
        else:
            prorated_paid = self.FULL_PAID_LEAVE_ENTITLEMENT
            prorated_sick = self.FULL_SICK_LEAVE_ENTITLEMENT
        
        # ----- Paid Leave Rules -----
        if self.leave_type == "paid":
            month = self.start_date.month
            year = self.start_date.year
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
            total_paid = qs_annual.count()  # Each approved paid request counts as 1 day.
            effective_paid = 1 if requested_days >= 1 else 0
            if total_paid + effective_paid > prorated_paid:
                errors["leave_type"] = (
                    f"This request exceeds your prorated annual paid leave entitlement "
                    f"({prorated_paid} day(s))."
                )
        
        # ----- Sick Leave Rules -----
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
                # If none left, automatically convert to unpaid
                self.leave_type = "unpaid"
            elif requested_days > remaining_allowed:
                extra_days = requested_days - remaining_allowed
                warning = (
                    f"Only {remaining_allowed} day(s) will be applied as sick leave; "
                    f"{extra_days} day(s) will be treated as unpaid."
                )
                self._warning_message = getattr(self, "_warning_message", "") + warning
        
        # ----- Prevent Clubbing of Paid and Sick Leave -----
        adjacent_leaves = LeaveRequest.objects.filter(requester=self.requester).exclude(status="rejected")
        if self.pk:
            adjacent_leaves = adjacent_leaves.exclude(pk=self.pk)
        for leave in adjacent_leaves:
            # Check if this request immediately follows or is followed by a paid/sick leaf
            if leave.end_date and self.start_date and (leave.end_date + timedelta(days=1) == self.start_date):
                if (leave.leave_type == "paid" and self.leave_type == "sick") or \
                   (leave.leave_type == "sick" and self.leave_type == "paid"):
                    errors["leave_type"] = "Paid leave cannot be clubbed with sick leave."
                    break
        
        # ----- Sandwich Leave Policy Constraint (Multi-day Requests) -----
        def is_public_holiday(d: date) -> bool:
            public_holidays = {(1, 1), (1, 26), (5, 1), (8, 15), (10, 2), (12, 25)}
            return (d.month, d.day) in public_holidays
        
        sandwich_unpaid_days = 0
        current_date = self.start_date + timedelta(days=1)
        while current_date < self.end_date:
            if current_date.weekday() >= 5 or is_public_holiday(current_date):
                sandwich_unpaid_days += 1
            current_date += timedelta(days=1)
        
        if sandwich_unpaid_days > 0:
            note = (
                f"{sandwich_unpaid_days} day(s) between your start and end date fall on weekends "
                "or public holidays and will be treated as Unpaid under the Sandwich Policy."
            )
            self._warning_message = getattr(self, "_warning_message", "") + note
        
        # ----- Separate Sandwich Constraint for Consecutive Single-day Requests -----
        if self.start_date == self.end_date:  # current request is single-day
            prev_leave = LeaveRequest.objects.filter(
                requester=self.requester,
                end_date__lt=self.start_date
            ).order_by('-end_date').first()
            if prev_leave and prev_leave.start_date == prev_leave.end_date:
                gap_days = (self.start_date - prev_leave.end_date).days - 1
                if gap_days > 0:
                    all_non_working = True
                    test_date = prev_leave.end_date + timedelta(days=1)
                    for _ in range(gap_days):
                        if test_date.weekday() < 5 and not is_public_holiday(test_date):
                            all_non_working = False
                            break
                        test_date += timedelta(days=1)
                    if all_non_working:
                        warning = (
                            f"Due to Sandwich Policy, the {gap_days} non-working day(s) between your previous leave "
                            "and this request will be treated as Unpaid."
                        )
                        self._warning_message = getattr(self, "_warning_message", "") + warning
        
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        # 1) Auto-populate employee fields and total_days as before
        self.employee_id = str(self.requester.pk).zfill(6)

        user_name = getattr(self.requester, "name", "").strip()
        self.employee_name = user_name or getattr(self.requester, "username", "").strip()

        if not self.total_days:
            self.total_days = (self.end_date - self.start_date).days + 1

        # Preserve any client-sent note
        incoming_note = self.note

        # 2) Run validations (without overriding note)
        self.full_clean()

        # 3) Restore the client note regardless of any warnings
        self.note = incoming_note

        super().save(*args, **kwargs)
