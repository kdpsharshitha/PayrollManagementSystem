from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import LeaveDetailsViewSet

router = DefaultRouter()

router.register(r'leavedetails', LeaveDetailsViewSet)


urlpatterns = [
    path('', include(router.urls)),
]
