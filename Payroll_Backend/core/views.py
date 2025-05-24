from rest_framework import viewsets
from .models import Employee, Attendance, LeaveDetails, Payroll
from .serializers import EmployeeSerializer, AttendanceSerializer, LeaveDetailsSerializer, PayrollSerializer

class EmployeeViewSet(viewsets.ModelViewSet):
    queryset = Employee.objects.all()
    serializer_class = EmployeeSerializer

class AttendanceViewSet(viewsets.ModelViewSet):
    queryset = Attendance.objects.all()
    serializer_class = AttendanceSerializer

class LeaveDetailsViewSet(viewsets.ModelViewSet):
    queryset = LeaveDetails.objects.all()
    serializer_class = LeaveDetailsSerializer

class PayrollViewSet(viewsets.ModelViewSet):
    queryset = Payroll.objects.all()
    serializer_class = PayrollSerializer

