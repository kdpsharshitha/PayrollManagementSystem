from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import EmployeeViewSet
from .views import login

router = DefaultRouter()
router.register(r'employees', EmployeeViewSet)


urlpatterns = [
    path('', include(router.urls)),
    path("login/", login, name="login"),  # ✅ Login using email# ✅ Create new user
]
