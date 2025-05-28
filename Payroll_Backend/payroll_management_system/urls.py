
from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('employee/', include('employee.urls')),
    path('attendance/', include('attendance.urls')),
    path('leavedetails/', include('leavedetails.urls')),
    path('payroll/', include('payroll.urls')),
    path('leave-requests/', include('leave_requests.urls'))
]
