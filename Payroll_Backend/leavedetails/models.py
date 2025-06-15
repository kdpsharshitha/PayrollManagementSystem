from django.db import models
import calendar
from datetime import datetime
from employee.models import Employee
from attendance.models import Attendance
from decimal import Decimal
from datetime import timedelta
from math import ceil

class NoAttendanceRecordsError(Exception):
    """Custom exception raised when no attendance records are found for the month."""
    pass

class LeaveDetails(models.Model):

    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='leave_details')
    month = models.DateField(help_text="Month and year")
    working_days = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    paid_leaves = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    sick_leaves = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    applied_unpaid_leaves = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    sandwich_unpaid_leaves = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    unpaid_leaves = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    total_leaves_taken = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    absent_days = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    days_worked = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    total_paid_leaves_left = models.DecimalField(max_digits=5, decimal_places=2, default=9)   # Typically max 9 per year
    total_sick_leaves_left = models.DecimalField(max_digits=5, decimal_places=2, default=2)   # Typically max 2 per year


    class Meta:
        unique_together = ('employee', 'month')

    def save(self, *args, **kwargs):

        # Get month start and end dates
        year = self.month.year
        month = self.month.month
        _, num_days = calendar.monthrange(year, month)
        first_day = datetime(year, month, 1).date()
        last_day = datetime(year, month, num_days).date()

        PAID_LEAVE_ENTITLEMENT = 9
        join_date = self.employee.date_joined
        if join_date.year == year:
            months_remaining = 12 - join_date.month + 1
            prorated_paidleaves = ceil((PAID_LEAVE_ENTITLEMENT * months_remaining) / 12)
        else:
            prorated_paidleaves = PAID_LEAVE_ENTITLEMENT

        # Filter employee's attendance for this month
        records = Attendance.objects.filter(employee=self.employee, date__range=(first_day, last_day))
        # --- VALIDATION: Check if attendance records exist ---
        if not records.exists():
            raise NoAttendanceRecordsError(
                f"No attendance record found for employee {self.employee.id} - {self.employee.name} "
                f"for {self.month.strftime('%B %Y')}. Payroll cannot be generated."
            )
        # --- End Validation ---

        # Convert queryset to a dictionary for fast access
        attendance_map = {att.date: att.status for att in records}

        sandwich_holidays_unpaidleaves = 0

        holiday_block = []

        sorted_records = sorted(records, key=lambda r: r.date)

        for i, record in enumerate(sorted_records):
            if record.status == 'Holiday':
                holiday_block.append(record)
            else:
                if holiday_block:
                    first_holiday_date = holiday_block[0].date
                    last_holiday_date = holiday_block[-1].date

                    prev_date = first_holiday_date - timedelta(days=1)
                    next_date = last_holiday_date + timedelta(days=1)

                    #  Only check if both dates are inside the current month
                    if first_day <= prev_date <= last_day and first_day <= next_date <= last_day:
                        prev_status = attendance_map.get(prev_date)
                        next_status = attendance_map.get(next_date)

                        if prev_status in ['Paid Leave','UnPaid Leave'] and next_status in ['Paid Leave','UnPaid Leave']:
                            sandwich_holidays_unpaidleaves += len(holiday_block)

                    holiday_block = []

        # Check if the month ends with a holiday block (handle trailing holidays)
        if holiday_block:
            first_holiday_date = holiday_block[0].date
            last_holiday_date = holiday_block[-1].date

            prev_date = first_holiday_date - timedelta(days=1)
            next_date = last_holiday_date + timedelta(days=1)

            if first_day <= prev_date <= last_day and first_day <= next_date <= last_day:
                prev_status = attendance_map.get(prev_date)
                next_status = attendance_map.get(next_date)

                if prev_status in ['Paid Leave','UnPaid Leave'] and next_status in ['Paid Leave','UnPaid Leave']:
                    sandwich_holidays_unpaidleaves += len(holiday_block)


        sandwich_holidays_unpaidleaves = Decimal(sandwich_holidays_unpaidleaves)

        present_days = records.filter(status='Present').count()
        half_absents = records.filter(status='Half Absent').count()
        absents = records.filter(status='Absent').count()
        PaidLeaves = records.filter(status='Paid Leave').count()
        HalfPaidLeaves = records.filter(status='Half Paid Leave').count()
        UnPaidLeaves = records.filter(status='UnPaid Leave').count()
        HalfUnPaidLeaves = records.filter(status='Half UnPaid Leave').count()
        sick_leaves = records.filter(status='Sick Leave').count()
        holidays = records.filter(status='Holiday').count()
        # leaves = records.filter(status='Leave').count()
        # half_leaves = records.filter(status='Half Leave').count()
        # total_leaves = Decimal(leaves) + Decimal('0.5') * Decimal(half_leaves)

        self.working_days = num_days - holidays
        self.paid_leaves = Decimal(PaidLeaves) + Decimal('0.5') * Decimal(HalfPaidLeaves)
        self.applied_unpaid_leaves = Decimal(UnPaidLeaves) + Decimal('0.5') * Decimal(HalfUnPaidLeaves)
        self.sandwich_unpaid_leaves = sandwich_holidays_unpaidleaves
        self.unpaid_leaves = self.applied_unpaid_leaves + self.sandwich_unpaid_leaves
        self.sick_leaves = sick_leaves
        self.total_leaves_taken = self.paid_leaves + self.unpaid_leaves + self.sick_leaves
        self.absent_days = Decimal(absents) + Decimal('0.5') * Decimal(half_absents)
        self.days_worked = self.working_days - self.total_leaves_taken - self.absent_days

        # Get previous month's leave balance
        prev_record = LeaveDetails.objects.filter(
            employee=self.employee,
            month__lt=self.month
        ).order_by('-month').first()

        # Set initial leave balances
        # if prev_record:
        #     paid_leave_balance = max(Decimal('0'), prev_record.total_paid_leaves_left)
        # else:
        #     paid_leave_balance = Decimal('9')
        
        # monthly_paid_leave_limit = Decimal('1.0')
        # self.paid_leaves = min(total_leaves - unpaid_due_to_clubbing, paid_leave_balance, monthly_paid_leave_limit)
        # self.unpaid_leaves = max(Decimal('0'), total_leaves - self.paid_leaves + sandwich_holidays_unpaidleaves)
        # self.total_leaves_taken = self.sick_leaves + total_leaves + sandwich_holidays_unpaidleaves
        
        if prev_record:
            self.total_paid_leaves_left = max(Decimal('0'), prev_record.total_paid_leaves_left - self.paid_leaves)
            self.total_sick_leaves_left = max(Decimal('0'), prev_record.total_sick_leaves_left - self.sick_leaves)
        else:
            # First month of the year or first record
            self.total_paid_leaves_left = max(Decimal('0'), Decimal(prorated_paidleaves) - self.paid_leaves)
            self.total_sick_leaves_left = max(Decimal('0'), Decimal('2') - self.sick_leaves)

        super().save(*args, **kwargs)

    def __str__(self):
        return f"Leave Details: {self.employee.id} - {self.month.strftime('%B %Y')}"
