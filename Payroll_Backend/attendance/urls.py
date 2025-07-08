from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import employee_attendance, manage_attendance, AttendanceViewSet, LeaveRequestViewSet,mark_entry, mark_exit,mark_entry1, mark_exit1, update_leave_status,leave_summary_view,today_attendance_view ,attendance_status, attendance_by_date

router = DefaultRouter()
router.register(r'attendance', AttendanceViewSet, basename='attendance')
router.register(r'leave-requests', LeaveRequestViewSet, basename='leave-request')

urlpatterns = [
    path('', include(router.urls)),
    path('manage/', manage_attendance, name='manage-attendance'),
    path('employee/', employee_attendance , name='employee-attendance'),
    path('mark-entry/', mark_entry, name='mark-entry'),
    path('mark-exit/',  mark_exit,  name='mark-exit'),
    path('mark-entry1/', mark_entry1, name='mark-entry'),
    path('mark-exit1/',  mark_exit1,  name='mark-exit'),
    path('update-status/', update_leave_status, name='update-leave-status'),
    path('leave-summary/', leave_summary_view, name='leave-summary'),
    path('today/',today_attendance_view, name='attendance-today'),
    path('attendance-status/',attendance_status, name='attendance-status' ),
    path('by-date/', attendance_by_date, name='attendance-by-date'),

]
