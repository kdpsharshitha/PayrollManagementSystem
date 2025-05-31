from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.db.models import Sum
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from .models import LeaveRequest
from .serializers import LeaveRequestSerializer
from datetime import date

# Define constants (you might already have them in settings or elsewhere)
PAID_LEAVE_ENTITLEMENT = 9  # Annual paid leave entitlement
SICK_LEAVE_ENTITLEMENT = 2  # Annual sick leave entitlement
MONTHLY_PAID_LEAVE_LIMIT = 1  # Only 1 paid leave allowed per month


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_leave_request(request):
    """
    Create a new leave request. The serializer's save() method accepts extra
    parameters (e.g., requester and status). The model validations (via full_clean())
    will enforce business rules (including leave type constraints) before saving.
    """
    serializer = LeaveRequestSerializer(data=request.data)
    if serializer.is_valid():
        # Automatically set the requester to the current user and status to pending.
        serializer.save(requester=request.user, status="pending")
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_leave_requests_for_approval(request):
    """
    HR can view leave requests submitted by employees.
    Admin can view leave requests submitted by HR.
    """
    user = request.user

    if user.role == "hr":
        # HR sees leave requests submitted by employees.
        leave_requests = LeaveRequest.objects.filter(
            requester__role="employee"
        ).select_related("requester")
    elif user.role == "admin":
        # Admin sees leave requests submitted by HR.
        leave_requests = LeaveRequest.objects.filter(
            requester__role="hr"
        ).select_related("requester")
    else:
        return Response({"error": "Unauthorized access."},
                        status=status.HTTP_403_FORBIDDEN)

    serializer = LeaveRequestSerializer(leave_requests, many=True)
    return Response(serializer.data)

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def update_leave_request_status(request, request_id):
    """
    Allows HR or Admin to approve or reject a leave request that is in "pending" status.
    Only HR can process requests for employees, and only Admin can process requests for HR.
    """
    user = request.user
    new_status = request.data.get("status")  # new_status avoids naming conflict
    if new_status not in ["approved", "rejected"]:
        return Response({"error": "Invalid status update."},
                        status=status.HTTP_400_BAD_REQUEST)
    
    try:
        leave_req = LeaveRequest.objects.get(id=request_id, status="pending")
    except LeaveRequest.DoesNotExist:
        return Response({"error": "Leave request not found or already processed."},
                        status=status.HTTP_404_NOT_FOUND)
    
    # Check if the user has permission to update this leave request:
    #   - HR can update requests submitted by employees.
    #   - Admin can update requests submitted by HR.
    if (user.role == "hr" and leave_req.requester.role == "employee") or \
       (user.role == "admin" and leave_req.requester.role == "hr"):
        leave_req.status = new_status
        leave_req.save()
        return Response({"message": f"Leave request {new_status}."},
                        status=status.HTTP_200_OK)
    
    return Response({"error": "Unauthorized action."},
                    status=status.HTTP_403_FORBIDDEN)

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_requests(request):
    """
    Allows users to view their submitted leave requests.
    Employees see their own leave requests.
    HR sees their own leave requests.
    Admin sees all HR leave requests.
    """
    user = request.user

    if user.role == "admin":
        # Admin sees leave requests of HR users.
        leave_requests = LeaveRequest.objects.filter(
            requester__role="hr"
        ).order_by("-created_at")
    else:
        # HR and Employees see their own leave requests.
        leave_requests = LeaveRequest.objects.filter(
            requester=user
        ).order_by("-created_at")
    
    serializer = LeaveRequestSerializer(leave_requests, many=True)
    return Response(serializer.data)



@api_view(["GET"])
@permission_classes([IsAuthenticated])
def leave_balance(request):
    """
    Returns:
    - Remaining paid and sick leaves for the logged-in user for the current year,
      with paid leave entitlements pro-rated based on their join date.
    - The sick leave entitlement is not pro-rated.
    - Indicates whether the user has already taken a paid leave for the current month.
    - The end date of the last approved paid leave (to support continuous-leave validation on the frontend).
    """
    user = request.user
    today = date.today()
    current_year = today.year
    current_month = today.month

    # Determine the entitlement for paid leaves based on date_joined (pro-rate if joined in current year)
    join_date = user.date_joined  # Ensure this field is correctly set on your user model.
    if join_date.year == current_year:
        # Calculate remaining months including the join month (e.g., if joined in May, months_remaining = 13 - 5 = 8).
        months_remaining = 13 - join_date.month
        prorated_paid = int((PAID_LEAVE_ENTITLEMENT * months_remaining) / 12)
    else:
        prorated_paid = PAID_LEAVE_ENTITLEMENT

    # For sick leave, there is no pro-rating—always use the full entitlement.
    prorated_sick = SICK_LEAVE_ENTITLEMENT

    # Annual Paid Leave Calculation (each approved request counts as 1 effective day)
    paid_leaves = user.leave_requests.filter(
        leave_type="paid",
        status="approved",
        start_date__year=current_year
    )
    used_paid = paid_leaves.count()
    paid_leave_this_month = paid_leaves.filter(start_date__month=current_month).exists()

    # Annual Sick Leave Calculation: Sum total_days used.
    sick_leaves = user.leave_requests.filter(
        leave_type="sick",
        status="approved",
        start_date__year=current_year
    )
    used_sick = sick_leaves.aggregate(total=Sum("total_days"))["total"] or 0

    available_paid = max(prorated_paid - used_paid, 0)
    available_sick = max(prorated_sick - used_sick, 0)

    # Get the end date of the last approved paid leave (if any)
    last_paid_leave = paid_leaves.order_by('-end_date').first()
    last_paid_leave_end_date = (
        last_paid_leave.end_date.strftime("%Y-%m-%d") if last_paid_leave else None
    )

    data = {
        "availablePaid": available_paid,          # Pro-rated available paid leaves
        "availableSick": available_sick,            # Full available sick leaves (no pro-rating)
        "paidLeaveThisMonth": paid_leave_this_month,
        "lastPaidLeaveEndDate": last_paid_leave_end_date,
    }

    return Response(data, status=status.HTTP_200_OK)

