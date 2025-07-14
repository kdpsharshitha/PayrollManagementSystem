from rest_framework import viewsets
from .models import Employee
from .serializers import EmployeeSerializer
from django.contrib.auth import authenticate
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
import logging

employee_logger = logging.getLogger('employee_operations')
class EmployeeViewSet(viewsets.ModelViewSet):
    queryset = Employee.objects.all()
    serializer_class = EmployeeSerializer

    def perform_create(self, serializer):
        employee = serializer.save()
        user = self.request.user
        employee_logger.info(
            f"New employee added: ID:{employee.id}, Name:{employee.name}, "
            f"Email:{employee.email}, Role:{employee.role}, Added by: {user.id if user.is_authenticated else 'Anonymous'}"
        )

    def perform_update(self, serializer):
        instance = self.get_object()  # Old instance before update
        old_data = EmployeeSerializer(instance).data 
        user = self.request.user

        updated_employee = serializer.save()
        new_data = EmployeeSerializer(updated_employee).data
        # Compare old and new fields
        changes = []
        for field in new_data:
            if old_data.get(field) != new_data.get(field):
                changes.append(
                    f"{field}: '{old_data.get(field)}' to '{new_data.get(field)}'"
                )

        if changes:
            change_log = "; ".join(changes)
            employee_logger.info(
                f"Employee updated: ID:{updated_employee.id}, Updated by:{user.id}. Changes: {change_log}"
            )
        

    def perform_destroy(self, instance):
        user = self.request.user
        employee_logger.info(
            f"Employee deleted: ID:{instance.id}, Name={instance.name}, "
            f"Email:{instance.email}, Role:{instance.role}, Deleted by:{user.id if user.is_authenticated else 'Anonymous'}"
        )
        instance.delete()

    

# Helper function to generate tokens
def get_tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    return {
        "access": str(refresh.access_token),
        "refresh": str(refresh),
        "role": user.role,
        "gmail": user.email,   # Replaced the custom user_id with email (labeled as gmail)
    }

@api_view(["POST"])
@permission_classes([AllowAny])
@authentication_classes([])  # Disable authentication for login
def login(request):
    print("Received login request:", request.data)  # Debugging incoming request

    email = request.data.get("email", "").strip() 
    password = request.data.get("password", "").strip()

    if not email or not password:
        return Response(
            {"error": "Missing email or password"},
            status=status.HTTP_400_BAD_REQUEST
        )

    user = authenticate(username=email, password=password)

    if user:
        token = get_tokens_for_user(user)
        return Response(token)

    return Response(
        {"error": "Invalid credentials"},
        status=status.HTTP_400_BAD_REQUEST
    )

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_logged_in_employee(request):
    user = request.user
    data = EmployeeSerializer(user).data
    data["is_superuser"] = user.is_superuser
    return Response(data)

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def view_profile(request):
    """
    Return the profile details for the currently authenticated user.
    """
    # `request.user` is your Employee instance (because you use it as the User model).
    serializer = EmployeeSerializer(request.user)
    return Response(serializer.data)