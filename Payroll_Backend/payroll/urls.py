from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PayrollViewSet
from .views import GeneratePayrollAPIView
from .views import GeneratePayslipPDFView
from .views import MyPayslipsAPIView
from .views import DownloadPayslipPDFView

router = DefaultRouter()

router.register(r'payroll', PayrollViewSet)


urlpatterns = [
    path('', include(router.urls)),
    path('generate/', GeneratePayrollAPIView.as_view(), name='generate-payroll'),
    path('generate_payslip/', GeneratePayslipPDFView.as_view(), name='generate-pdf'),
    path('download_payslip/', DownloadPayslipPDFView.as_view(), name='download-pdf'),
    path('my_payslips/', MyPayslipsAPIView.as_view(), name='mypayslips'),
]
