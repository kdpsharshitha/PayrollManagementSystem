from rest_framework import viewsets
from .models import LeaveDetails
from .serializers import LeaveDetailsSerializer

class LeaveDetailsViewSet(viewsets.ModelViewSet):
    queryset = LeaveDetails.objects.all()
    serializer_class = LeaveDetailsSerializer

    def get_queryset(self):
        """
        Optionally restricts the returned leave details to a given employee and month,
        by filtering against `employee_id` and `month` query parameters in the URL.
        """
        queryset = super().get_queryset() # Start with the base queryset

        employee_id = self.request.query_params.get('employee_id')
        month_str = self.request.query_params.get('month') # Expected format: YYYY-MM

        if employee_id and month_str:
            try:
                # Convert the 'YYYY-MM' string to a date object (e.g., first day of the month)
                # This assumes your LeaveDetails.month field stores the first day of the month
                month_date = datetime.strptime(month_str, '%Y-%m').date()

                # Filter by the employee's ID and the exact month
                # employee__id is used because 'employee' is a ForeignKey to the Employee model
                queryset = queryset.filter(employee__id=employee_id, month=month_date)
            except ValueError:
                # Handle cases where the month format is incorrect (e.g., '2023/13')
                # Return an empty queryset so no data is returned for invalid input
                return LeaveDetails.objects.none()
            except Exception as e:
                # Catch any other unexpected errors during filtering
                print(f"Error filtering LeaveDetails: {e}")
                return LeaveDetails.objects.none() # Return empty queryset on error
        
        return queryset
