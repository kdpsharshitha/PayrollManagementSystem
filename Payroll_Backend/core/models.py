from django.db import models
from django.utils import timezone
import calendar
from datetime import datetime

class Employee(models.Model):

    GENDER_CHOICES = [("M", "Male"), ("F", "Female"), ("O", "Other")]
    EMPLOYMENT_TYPE_CHOICES = [("full_time", "Full Time"), ("part_time", "Part Time")]
    ROLE_CHOICES = [("admin", "Admin"), ("hr", "HR"), ("employee", "Employee")]
    PAY_STRUCTURE_CHOICES = [('fixed', 'Fixed Pay'),('variable', 'Variable Pay')]
    ACCOUNT_TYPE_CHOICES = [('SBI', 'SBI'),('NonSBI', 'Non-SBI')]

    id = models.CharField(primary_key=True, max_length=6)  
    name = models.CharField(max_length=50,null=True,blank=True)
    email = models.EmailField(unique=True, null=True,blank=True)
    password = models.CharField(max_length=50,default='jivass')
    gender = models.CharField(max_length=1, choices=GENDER_CHOICES,null=True,blank=True)
    account_type = models.CharField(max_length=10, choices=ACCOUNT_TYPE_CHOICES,default='SBI')
    pan_no = models.CharField(max_length=20,null=True,blank=True)
    phone_no = models.CharField(max_length=15, null=True,blank=True)
    emergency_phone_no = models.CharField(max_length=15, null=True,blank=True)
    address = models.TextField(null=True,blank=True)
    employment_type = models.CharField(max_length=20, choices=EMPLOYMENT_TYPE_CHOICES,default='full_time')
    role = models.CharField(max_length=10, choices=ROLE_CHOICES)
    designation = models.CharField(max_length=50,null=True,blank=True)
    date_joined = models.DateField()
    fee_per_month = models.DecimalField(max_digits=10, decimal_places=2,default=0)
    pay_structure = models.CharField(max_length=10, choices=PAY_STRUCTURE_CHOICES,default='fixed')
    

    def __str__(self):
      return f"{self.id} - {self.name}"


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
        total_leaves = leaves + 0.5 * half_leaves

        self.working_days = num_days - holidays

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

    
class Payroll(models.Model):

    PERFORMANCE_CHOICES = [
        ('1', 'Exceeds Expectations(E)'),
        ('2', 'Meets Expectations(M)'),
        ('3', 'Partially Meets Expectations(PM)'),
        ('4', 'Below Expectations(BE)'),
        ('NA', 'Not Applicable(NA)')
    ]
    employee = models.ForeignKey('Employee', on_delete=models.CASCADE, related_name='payrolls')
    # this will create employee_id field in the DB
    fee_per_month = models.DecimalField(max_digits=10, decimal_places=2)
    pay_structure = models.CharField(max_length=10)
    month = models.DateField(help_text="Month and year")
    base_pay = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    variable_pay = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    base_pay_earned = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    perform_category = models.CharField(max_length=2, choices=PERFORMANCE_CHOICES)
    perform_comp_payable = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    fee_earned = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    tds = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    reimbursement = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    net_fee_earned = models.IntegerField(default=0)
    generated_on = models.DateField(auto_now_add=True)

    class Meta:
        unique_together = ('employee', 'month')


    def save(self, *args, **kwargs):
        if self.employee:
            self.fee_per_month = self.employee.fee_per_month
            self.pay_structure = self.employee.pay_structure
            self.calculate_payroll()
        super().save(*args, **kwargs)

    def calculate_payroll(self):

        if self.pay_structure == "fixed":
            self.base_pay = self.fee_per_month
            self.variable_pay = 0
        else:
            self.base_pay = self.fee_per_month * 0.75
            self.variable_pay = self.fee_per_month * 0.25
        
        leave_details_record = LeaveDetails.objects.filter(employee=self.employee, month=self.month).first()
        working_days = leave_details_record.working_days
        payable_days = (leave_details_record.days_worked) + (leave_details_record.paid_leaves) + (leave_details_record.sick_leaves)
        absent_days = leave_details_record.absent_days
        base_pay_per_day = self.fee_per_month / working_days
        penalty_per_absnet = base_pay_per_day * 0.5
        total_absent_penalty = absent_days * penalty_per_absnet
        self.base_pay_earned = (base_pay_per_day * payable_days) - total_absent_penalty
        multipliers = {'1': 1.10, '2': 0.75, '3': 0.50, '4': 0, 'NA': 0}
        multiplier = multipliers.get(self.perform_category, 0)
        self.perform_comp_payable = self.variable_pay * multiplier
        self.fee_earned = self.base_pay_earned + self.perform_comp_payable
        self.tds = self.fee_earned * 0.1
        self.net_fee_earned = round(self.fee_earned - self.tds + self.reimbursement)

    def __str__(self):
        return f"Payroll for {self.employee.id} ({self.employee.name}) - {self.month.strftime('%B %Y')}"


