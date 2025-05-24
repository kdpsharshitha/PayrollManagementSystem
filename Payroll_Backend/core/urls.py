from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import EmployeeViewSet, AttendanceViewSet, LeaveDetailsViewSet, PayrollViewSet

router = DefaultRouter()
router.register(r'employees', EmployeeViewSet)
router.register(r'attendance', AttendanceViewSet)
router.register(r'leavedetails', LeaveDetailsViewSet)
router.register(r'payroll', PayrollViewSet)
#router.register(r'leaverequests', LeaveRequestViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
