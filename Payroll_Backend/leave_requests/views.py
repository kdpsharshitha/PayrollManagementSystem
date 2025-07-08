from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.db.models import Sum, Q
from rest_framework.permissions import IsAuthenticated
from rest_framework import status,generics, permissions
from .models import LeaveRequest
from .serializers import LeaveRequestSerializer
from datetime import date, timedelta
from attendance.utils import apply_approved_leave
from rest_framework.viewsets import ModelViewSet
from rest_framework.decorators import action
from django.shortcuts import get_object_or_404



# Define constants (you might already have them in settings or elsewhere)
PAID_LEAVE_ENTITLEMENT = 9   # Annual paid leave entitlement
SICK_LEAVE_ENTITLEMENT = 2   # Annual sick leave entitlement
MONTHLY_PAID_LEAVE_LIMIT = 1 # Only 1 approved paid leave per calendar month
HALF_PAID_LEAVE_ENTITLEMENT_PER_MONTH = 2

class AllLeaveRequestsView(generics.ListAPIView):
    """
    Admin‑only: list all leave requests in the system.
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = LeaveRequestSerializer
    queryset = LeaveRequest.objects.all().select_related("requester")

    def get(self, request, *args, **kwargs):
        if request.user.role != "admin":
            return Response({"detail": "Not authorized."},
                            status=status.HTTP_403_FORBIDDEN)
        return super().get(request, *args, **kwargs)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_leave_request(request):
    """
    Create a new leave request. Before saving a 'paid' leave:
      1) Verify that the user has not already taken an approved paid leave in the same month-year
         as the requested start_date. If they have, return a 400 error.
      2) Prevent duplicate requests for the exact same (start_date, end_date) pair.
    """
    serializer = LeaveRequestSerializer(
        data=request.data,
        context={"request": request}  # Pass request into serializer context
    )
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    user = request.user
    data = serializer.validated_data
    requested_start: date = data["start_date"]
    requested_end: date = data["end_date"]
    leave_type: str = data["leave_type"]

    # --- 0) Prevent duplicates: same user, same start/end pair ---
    if LeaveRequest.objects.filter(
        requester=user,
        start_date=requested_start,
        end_date=requested_end
    ).exists():
        return Response(
            {"error": "You have already submitted a leave request for these exact dates."},
            status=status.HTTP_400_BAD_REQUEST
        )

    # --- 1) Enforce: Only 1 approved paid leave per month (even if leave spans into this month) ---
    if leave_type == "paid":
        same_month_paid_count = LeaveRequest.objects.filter(
            requester=user,
            status="approved",
            leave_type="paid"
        ).filter(
            Q(start_date__year=requested_start.year, start_date__month=requested_start.month) |
            Q(end_date__year=requested_start.year, end_date__month=requested_start.month)
        ).count()

        if same_month_paid_count >= MONTHLY_PAID_LEAVE_LIMIT:
            return Response(
                {"leave_type": [
                    "You have already taken your one paid leave for "
                    f"{requested_start.strftime('%B %Y')}."
                ]},
                status=status.HTTP_400_BAD_REQUEST,
            )

    # Serializer.create() will set requester, status, employee_id, etc.
    serializer.save()
    return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_leave_requests_for_approval(request):
    """
    HR can view leave requests submitted by employees **who report to them**.
    Admin can view leave requests submitted by HR.
    """
    user = request.user

    if user.role == "manager":
        # Only employees whose supervisor_email matches this HR's email
        leave_requests = LeaveRequest.objects.filter(
            requester__role="employee",
            requester__supervisor_email=user.email
        ).select_related("requester")
    elif user.role == "admin":
        # Admin sees leave requests submitted by HR.
        leave_requests = LeaveRequest.objects.filter(
            requester__role="manager"
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
    When approved, automatically updates Attendance records over the date range.
    """
    user = request.user
    new_status = request.data.get("status")  # expect "approved" or "rejected"
    if new_status not in ["approved", "rejected"]:
        return Response(
            {"error": "Invalid status update."},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Fetch only pending requests
    leave_req = get_object_or_404(
        LeaveRequest.objects.filter(status="pending"),
        id=request_id
    )

    # Authorization: HR handles employees; Admin handles HR
    can_process = (
        (user.role == "manager" and leave_req.requester.role == "employee") or
        (user.role == "admin" and leave_req.requester.role == "manager")
    )
    if not can_process:
        return Response(
            {"error": "Unauthorized action."},
            status=status.HTTP_403_FORBIDDEN
        )

    # 1) Update status on the leave request
    leave_req.status = new_status
    leave_req.save()

    # 2) If approved, apply to Attendance
    if new_status == "approved":
        # This function will loop each date in the range
        # and upsert Attendance with Paid/Sick/Half/UnPaid logic.
        apply_approved_leave(leave_req)

    # 3) Return the updated leave_request data
    serializer = LeaveRequestSerializer(leave_req)
    return Response(serializer.data, status=status.HTTP_200_OK)



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
            requester__role="manager"
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
    Returns (by default, for the current month):
      - availablePaid, availableSick, availableHalfPaid
      - paidLeaveThisMonth: bool
      - halfPaidCountThisMonth: int
      - lastPaidLeaveEndDate: str or None
      - lastLeaveEndDate: str or None
      - separateSandwichUnpaidDays: int

    If ?month=MM&year=YYYY are passed *and* both parsed as ints,
    use those; otherwise default to today’s month/year.
    """
    user = request.user

    q_month = request.query_params.get("month", None)
    q_year = request.query_params.get("year", None)

    # Determine which (month, year) to use
    use_current_date = True
    if (q_month and q_year):
        try:
            m = int(q_month)
            y = int(q_year)
            if 1 <= m <= 12 and 1900 <= y <= 2100:
                current_month, current_year = m, y
                use_current_date = False
            else:
                raise ValueError
        except ValueError:
            use_current_date = True
    if use_current_date:
        today = date.today()
        current_year, current_month = today.year, today.month

    # --- Calculate entitlements ---
    # 1) Pro-rated paid leave based on join date
    join_date = user.date_joined
    if join_date.year == current_year:
        months_remaining = 13 - join_date.month
        prorated_paid = int((PAID_LEAVE_ENTITLEMENT * months_remaining) / 12)
    else:
        prorated_paid = PAID_LEAVE_ENTITLEMENT
    # 2) Sick leave (no pro-rating)
    prorated_sick = SICK_LEAVE_ENTITLEMENT

    # --- Count leaves ---
    # Paid leaves
    paid_leaves = user.leave_requests.filter(
        leave_type="paid",  # stored as 'paid'
        status="approved",
        start_date__year=current_year
    )
    used_paid_year = paid_leaves.count()

    # Sick leaves
    sick_leaves = user.leave_requests.filter(
        leave_type="sick",
        status="approved",
        start_date__year=current_year
    )
    used_sick_year = sick_leaves.aggregate(total=Sum("total_days"))["total"] or 0

    # Half-Paid leaves (use exact model value 'Half Paid Leave')
    half_paid_leaves = user.leave_requests.filter(
        leave_type="Half Paid Leave",
        status="approved",
        start_date__year=current_year
    )
    half_paid_count_month = half_paid_leaves.filter(
        start_date__month=current_month
    ).count()
    half_paid_count_year = half_paid_leaves.count()
    available_half_paid = max(HALF_PAID_LEAVE_ENTITLEMENT_PER_MONTH - half_paid_count_month, 0)

    # --- Adjust for past years ---
    if current_year < date.today().year and not use_current_date:
        available_paid = 0
        available_sick = 0
        paid_this_month = False
    else:
        raw_paid = prorated_paid - used_paid_year - (half_paid_count_year * 0.5)
        available_paid = max(raw_paid, 0)
        available_sick = max(prorated_sick - used_sick_year, 0)
        paid_this_month = paid_leaves.filter(
            start_date__month=current_month
        ).exists()

    # Last approved paid leave end date
    last_paid = paid_leaves.order_by('-end_date').first()
    last_paid_end = last_paid.end_date.strftime("%Y-%m-%d") if last_paid else None
    # Last approved leave of any type
    last_any = user.leave_requests.filter(
        status="approved"
    ).order_by('-end_date').first()
    last_any_end = last_any.end_date.strftime("%Y-%m-%d") if last_any else None

    # --- Sandwich policy calc ---
    def is_public_holiday(d: date) -> bool:
        return (d.month, d.day) in {(1,1),(1,26),(5,1),(8,15),(10,2),(12,25)}

    consecutive = list(
        user.leave_requests.filter(status__in=["pending","approved"]).order_by("start_date")
    )
    separate_unpaid = 0
    for i in range(len(consecutive)-1):
        cur, nxt = consecutive[i], consecutive[i+1]
        if cur.start_date == cur.end_date and nxt.start_date == nxt.end_date:
            diff = (nxt.start_date - cur.end_date).days
            if diff > 1:
                gap = diff - 1
                if all(
                    ((cur.end_date + timedelta(days=n)).weekday() >= 5 or
                     is_public_holiday(cur.end_date + timedelta(days=n)))
                    for n in range(1, diff)
                ):
                    separate_unpaid += gap

    data = {
        "availablePaid": available_paid,
        "availableSick": available_sick,
        "availableHalfPaid": available_half_paid,
        "paidLeaveThisMonth": paid_this_month,
        "halfPaidCountThisMonth": half_paid_count_month,
        "lastPaidLeaveEndDate": last_paid_end,
        "lastLeaveEndDate": last_any_end,
        "separateSandwichUnpaidDays": separate_unpaid,
    }
    return Response(data, status=200)
