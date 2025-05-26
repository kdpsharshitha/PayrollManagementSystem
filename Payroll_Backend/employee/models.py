from django.db import models

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
