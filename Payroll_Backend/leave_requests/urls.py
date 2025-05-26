from django.urls import path
from . import views

urlpatterns = [
    path('create/', views.create_leave_request, name='create_leave_request'),
    path('list/', views.list_leave_requests_for_approval, name='list_leave_requests'),
    path('myrequest/', views.my_requests, name='my_leave_requests'),
    path('approve/<int:request_id>/', views.update_leave_request_status, name='approve_leave_request'),
]