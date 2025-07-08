from django.db import models
from django.utils import timezone
from employee.models import Employee

class Attendance(models.Model):

    STATUS_CHOICES = [
        ('Paid Leave', 'Paid Leave'),
        ('Half Paid Leave', 'Half Paid Leave'),
        ('UnPaid Leave', 'UnPaid Leave'),
        ('Half UnPaid Leave', 'Half UnPaid Leave'),
        ('Sick Leave', 'Sick Leave'),
        ('Holiday', 'Holiday'),
        ('Present', 'Present'),
        ('Half Absent', 'Half Absent'),
        ('Absent', 'Absent')
    ]

    LEAVE_STATUSES = {
        'Paid Leave', 'Half Paid Leave', 'UnPaid Leave', 'Half UnPaid Leave',
        'Sick Leave', 'Holiday'
    }

    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='attendance_records')
    date = models.DateField()
    entry_time = models.TimeField(null=True, blank=True)
    exit_time = models.TimeField(null=True, blank=True)
    work_time = models.DurationField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES,null=True, blank=True)
    entry_latitude  = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    entry_longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    exit_latitude   = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    exit_longitude  = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)


    class Meta:
        unique_together = ('employee', 'date')

    def save(self, *args, **kwargs):
        # Calculate work time
        if self.entry_time and self.exit_time:
            entry = timezone.datetime.combine(self.date, self.entry_time)
            exit = timezone.datetime.combine(self.date, self.exit_time)
            if exit > entry:
                self.work_time = exit - entry

        if self.work_time:
            hours_worked = self.work_time.total_seconds() / 3600
            if hours_worked >= 8:
                self.status = 'Present'
            elif 4 <= hours_worked < 8:
                self.status = 'Half Absent'
            else:
                self.status = 'Absent'
        else:
            # keep manual leave/holiday if already set
            if self.status not in self.LEAVE_STATUSES:
                self.status = 'Absent'

        super().save(*args, **kwargs)

    def __str__(self):
        return f"Attendance for {self.employee.id} on {self.date}"

