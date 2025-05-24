from django.contrib import admin
from .models import Employee, Attendance, LeaveDetails, Payroll

admin.site.register(Employee)
admin.site.register(Attendance)
admin.site.register(LeaveDetails)
admin.site.register(Payroll)
#admin.site.register(LeaveRequest)