from django.db import models
from django.utils import timezone
from employee.models import Employee

class Attendance(models.Model):

    STATUS_CHOICES = [
        ('Leave', 'Leave'),
        ('Half Leave', 'Half Leave'),
        ('Sick Leave', 'Sick Leave'),
        ('Holiday', 'Holiday'),
        ('Present', 'Present'),
        ('Half Absent', 'Half Absent'),
        ('Absent', 'Absent')
    ]

    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='attendance_records')
    date = models.DateField()
    entry_time = models.TimeField(null=True, blank=True)
    exit_time = models.TimeField(null=True, blank=True)
    work_time = models.DurationField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, blank=True)

    class Meta:
        unique_together = ('employee', 'date')

    def save(self, *args, **kwargs):
        # Calculate work time
        if self.entry_time and self.exit_time:
            entry = timezone.datetime.combine(self.date, self.entry_time)
            exit = timezone.datetime.combine(self.date, self.exit_time)
            if exit > entry:
                self.work_time = exit - entry

        # Set status if not manually set
        if not self.status:
            if self.work_time:
                hours_worked = self.work_time.total_seconds() / 3600
                if hours_worked >= 8:
                    self.status = 'Present'
                elif 4 <= hours_worked < 8:
                    self.status = 'Half Absent'
                else:
                    self.status = 'Absent'
            else:
                self.status = 'Absent'

        super().save(*args, **kwargs)

    def __str__(self):
        return f"Attendance for {self.employee.id} on {self.date}"

