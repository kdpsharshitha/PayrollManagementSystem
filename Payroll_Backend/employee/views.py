from rest_framework import viewsets
from .models import Employee
from .serializers import EmployeeSerializer
from django.contrib.auth import authenticate
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken

class EmployeeViewSet(viewsets.ModelViewSet):
    queryset = Employee.objects.all()
    serializer_class = EmployeeSerializer

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
    serializer = EmployeeSerializer(user)
    return Response(serializer.data)
