from django.db import models
from leavedetails.models import LeaveDetails
from employee.models import Employee
from decimal import Decimal

class Payroll(models.Model):

    PERFORMANCE_CHOICES = [
        ('1', 'Exceeds Expectations(E)'),
        ('2', 'Meets Expectations(M)'),
        ('3', 'Partially Meets Expectations(PM)'),
        ('4', 'Below Expectations(BE)'),
        ('NA', 'Not Applicable(NA)')
    ]
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='payrolls')
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
            self.base_pay = self.fee_per_month * Decimal('0.75')
            self.variable_pay = self.fee_per_month * Decimal('0.25') 
        
        leave_details_record = LeaveDetails.objects.filter(employee=self.employee, month=self.month).first()
        working_days = leave_details_record.working_days
        payable_days = (leave_details_record.days_worked) + (leave_details_record.paid_leaves) + (leave_details_record.sick_leaves)
        absent_days = leave_details_record.absent_days
        base_pay_per_day = self.base_pay / working_days
        penalty_per_absnet = base_pay_per_day * Decimal('0.5')
        total_absent_penalty = absent_days * penalty_per_absnet
        self.base_pay_earned = (base_pay_per_day * payable_days) - total_absent_penalty
        multipliers = {'1': 1.10, '2': 0.75, '3': 0.50, '4': 0, 'NA': 0}
        multiplier = multipliers.get(self.perform_category, 0)
        self.perform_comp_payable = self.variable_pay * Decimal(multiplier)
        self.fee_earned = self.base_pay_earned + self.perform_comp_payable
        self.tds = self.fee_earned * Decimal('0.1')
        self.net_fee_earned = round(self.fee_earned - self.tds + self.reimbursement)

    def __str__(self):
        return f"Payroll for {self.employee.id} ({self.employee.name}) - {self.month.strftime('%B %Y')}"


