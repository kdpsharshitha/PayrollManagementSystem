from django.db import models
import calendar
from datetime import datetime
from employee.models import Employee
from attendance.models import Attendance
from decimal import Decimal

class NoAttendanceRecordsError(Exception):
    """Custom exception raised when no attendance records are found for the month."""
    pass

class LeaveDetails(models.Model):

    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='leave_details')
    month = models.DateField(help_text="Month and year")
    working_days = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    paid_leaves = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    sick_leaves = models.DecimalField(max_digits=5, decimal_places=2, default=0)
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

        # Filter employee's attendance for this month
        records = Attendance.objects.filter(employee=self.employee, date__range=(first_day, last_day))
        # --- VALIDATION: Check if attendance records exist ---
        if not records.exists():
            raise NoAttendanceRecordsError(
                f"No attendance record found for employee {self.employee.id} - {self.employee.name} "
                f"for {self.month.strftime('%B %Y')}. Payroll cannot be generated."
            )
        # --- End Validation ---

        present_days = records.filter(status='Present').count()
        half_absents = records.filter(status='Half Absent').count()
        absents = records.filter(status='Absent').count()
        leaves = records.filter(status='Leave').count()
        half_leaves = records.filter(status='Half Leave').count()
        sick_leaves = records.filter(status='Sick Leave').count()
        holidays = records.filter(status='Holiday').count()
        total_leaves = Decimal(leaves) + Decimal('0.5') * Decimal(half_leaves)


        self.working_days = num_days - holidays

        # Get previous month's leave balance
        prev_record = LeaveDetails.objects.filter(
            employee=self.employee,
            month__lt=self.month
        ).order_by('-month').first()

        # Set initial leave balances
        if prev_record:
            paid_leave_balance = max(Decimal('0'), prev_record.total_paid_leaves_left)
        else:
            paid_leave_balance = Decimal('9')
        
        monthly_paid_leave_limit = Decimal('1.0')
        self.paid_leaves = min(total_leaves, paid_leave_balance, monthly_paid_leave_limit)
        self.unpaid_leaves = max(Decimal('0'), total_leaves - self.paid_leaves)

        self.sick_leaves = sick_leaves
        self.total_leaves_taken = self.sick_leaves + total_leaves
        self.absent_days = Decimal(absents) + Decimal('0.5') * Decimal(half_absents)
        self.days_worked = Decimal(present_days) + Decimal('0.5') * Decimal(half_absents) + Decimal('0.5') * Decimal(half_leaves)


        if prev_record:
            self.total_paid_leaves_left = max(Decimal('0'), prev_record.total_paid_leaves_left - self.paid_leaves)
            self.total_sick_leaves_left = max(Decimal('0'), prev_record.total_sick_leaves_left - self.sick_leaves)
        else:
            # First month of the year or first record
            self.total_paid_leaves_left = max(Decimal('0'), Decimal('9') - self.paid_leaves)
            self.total_sick_leaves_left = max(Decimal('0'), Decimal('2') - self.sick_leaves)

        super().save(*args, **kwargs)

    def __str__(self):
        return f"Leave Details: {self.employee.id} - {self.month.strftime('%B %Y')}"
