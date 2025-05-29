from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin

class EmployeeManager(BaseUserManager):

    def create_user(self, id, email, password=None, **extra_fields):
        """
        Create and save a regular user with the given ID, email, and password.
        """
        if not email:
            raise ValueError("The Email must be set")
        if not id:
            raise ValueError("The Employee ID must be set")
        email = self.normalize_email(email)
        user = self.model(id=id, email=email, **extra_fields)
        user.set_password(password)  # hashes the given password
        user.save(using=self._db)
        return user

    def create_superuser(self, id, email, password, **extra_fields):
        """
        Create and save a superuser with the given ID, email, and password.
        """
        extra_fields.setdefault("role", "admin")
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)

        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")

        return self.create_user(id, email, password, **extra_fields)

class Employee(AbstractBaseUser, PermissionsMixin):
    # Define your choices
    GENDER_CHOICES = [("M", "Male"), ("F", "Female"), ("O", "Other")]
    EMPLOYMENT_TYPE_CHOICES = [("full_time", "Full Time"), ("part_time", "Part Time")]
    ROLE_CHOICES = [("admin", "Admin"), ("hr", "HR"), ("employee", "Employee")]
    PAY_STRUCTURE_CHOICES = [('fixed', 'Fixed Pay'), ('variable', 'Variable Pay')]
    ACCOUNT_TYPE_CHOICES = [('SBI', 'SBI'), ('NonSBI', 'Non-SBI')]

    # Custom primary key field (as a character field)
    id = models.CharField(primary_key=True, max_length=6)
    name = models.CharField(max_length=50, null=True, blank=True)
    email = models.EmailField(unique=True, null=False, blank=False)
    # Note: The password field is provided by AbstractBaseUser.
    gender = models.CharField(max_length=1, choices=GENDER_CHOICES, default='M')
    account_type = models.CharField(max_length=10, choices=ACCOUNT_TYPE_CHOICES, default='SBI')
    pan_no = models.CharField(max_length=20, null=True, blank=True)
    phone_no = models.CharField(max_length=15, null=True, blank=True)
    emergency_phone_no = models.CharField(max_length=15, null=True, blank=True)
    address = models.TextField(null=True, blank=True)
    employment_type = models.CharField(max_length=20, choices=EMPLOYMENT_TYPE_CHOICES, default='full_time')
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='employee')
    designation = models.CharField(max_length=50, null=True, blank=True)
    date_joined = models.DateField(auto_now_add=True)
    fee_per_month = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    pay_structure = models.CharField(max_length=10, choices=PAY_STRUCTURE_CHOICES, default='fixed')

    # Fields required for authentication and admin
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)

    # Associate the custom manager with the Employee model
    objects = EmployeeManager()

    # Use email as the username field for authentication
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['id']  # Require the employee ID when creating a user

    def __str__(self):
        return f"{self.id} - {self.name or self.email}"