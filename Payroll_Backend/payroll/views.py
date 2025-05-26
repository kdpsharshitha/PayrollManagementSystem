from rest_framework import viewsets
from .models import Payroll
from .serializers import PayrollSerializer

class PayrollViewSet(viewsets.ModelViewSet):
    queryset = Payroll.objects.all()
    serializer_class = PayrollSerializer
