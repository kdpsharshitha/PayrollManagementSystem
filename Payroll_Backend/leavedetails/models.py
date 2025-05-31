from django.db import models
import calendar
from datetime import datetime, timedelta
from employee.models import Employee
from attendance.models import Attendance

class LeaveDetails(models.Model):

    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='leave_details')
    month = models.DateField(help_text="Month and year")
    working_days = models.IntegerField()
    paid_leaves = models.IntegerField()
    sick_leaves = models.IntegerField()
    unpaid_leaves = models.IntegerField()
    total_leaves_taken = models.IntegerField()
    absent_days = models.IntegerField()
    days_worked = models.IntegerField()
    total_paid_leaves_left = models.IntegerField(default=9)   # Typically max 9 per year
    total_sick_leaves_left = models.IntegerField(default=2)   # Typically max 2 per year

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

        present_days = records.filter(status='Present').count()
        half_days = records.filter(status='Half Absent').count()
        absents = records.filter(status='Absent').count()
        leaves = records.filter(status='Leave').count()
        half_leaves = records.filter(status='Half Leave').count()
        sick_leaves = records.filter(status='Sick Leave').count()
        holidays = records.filter(status='Holiday').count()

        sandwich_unpaid_leaves = 0
        # Detect sandwich holidays
        sorted_dates = sorted(records.values_list('date', 'status'))

        for i in range(1, len(sorted_dates) - 1):
            prev_date, prev_status = sorted_dates[i - 1]
            curr_date, curr_status = sorted_dates[i]
            next_date, next_status = sorted_dates[i + 1]

            if curr_status == 'Holiday':
                # Check if this holiday is between two leave or absent days
                if ((prev_status in ['Leave', 'Absent']) and
                    (next_status in ['Leave', 'Absent']) and
                    (prev_date == curr_date - timedelta(days=1)) and
                    (next_date == curr_date + timedelta(days=1))):
                        sandwich_unpaid_leaves += 1

        total_leaves = leaves + 0.5 * half_leaves + sandwich_unpaid_leaves

        self.working_days = num_days - holidays + sandwich_unpaid_leaves

        if (total_leaves) <= 1:
            self.paid_leaves = total_leaves
            self.unpaid_leaves = 0
        else:
            self.paid_leaves = 1
            self.unpaid_leaves = total_leaves - 1
        
        self.sick_leaves = sick_leaves
        self.total_leaves_taken = self.paid_leaves + self.sick_leaves + self.unpaid_leaves
        self.absent_days = absents + 0.5 * half_days
        self.days_worked = present_days + 0.5 * half_days

        # Get previous month's leave balance
        prev_record = LeaveDetails.objects.filter(
            employee=self.employee,
            month__lt=self.month
        ).order_by('-month').first()

        if prev_record:
            self.total_paid_leaves_left = max(0, prev_record.total_paid_leaves_left - self.paid_leaves)
            self.total_sick_leaves_left = max(0, prev_record.total_sick_leaves_left - self.sick_leaves)
        else:
            # First month of the year or first record
            self.total_paid_leaves_left = max(0, 9 - self.paid_leaves)
            self.total_sick_leaves_left = max(0, 2 - self.sick_leaves)

        super().save(*args, **kwargs)

    def __str__(self):
        return f"Leave Details: {self.employee.id} - {self.month.strftime('%B %Y')}"
