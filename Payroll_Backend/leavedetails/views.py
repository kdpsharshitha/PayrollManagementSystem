from rest_framework import viewsets
from .models import LeaveDetails
from .serializers import LeaveDetailsSerializer

class LeaveDetailsViewSet(viewsets.ModelViewSet):
    queryset = LeaveDetails.objects.all()
    serializer_class = LeaveDetailsSerializer