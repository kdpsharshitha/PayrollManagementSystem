from django.urls import path
from . import views
from .views import AllLeaveRequestsView

urlpatterns = [
    path('create/', views.create_leave_request, name='create_leave_request'),
    path('list/', views.list_leave_requests_for_approval, name='list_leave_requests'),
    path('myrequest/', views.my_requests, name='my_leave_requests'),
    path('approve/<int:request_id>/', views.update_leave_request_status, name='approve_leave_request'),
    path('balance/', views.leave_balance, name='leave_balance'),
    path("all-leave-requests/", AllLeaveRequestsView.as_view(), name="all-leave-requests"),
]