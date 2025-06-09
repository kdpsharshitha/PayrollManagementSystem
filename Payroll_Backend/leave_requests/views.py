from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.db.models import Sum, Q
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from .models import LeaveRequest
from .serializers import LeaveRequestSerializer
from datetime import date, timedelta

# Define constants (you might already have them in settings or elsewhere)
PAID_LEAVE_ENTITLEMENT = 9   # Annual paid leave entitlement
SICK_LEAVE_ENTITLEMENT = 2   # Annual sick leave entitlement
MONTHLY_PAID_LEAVE_LIMIT = 1 # Only 1 approved paid leave per calendar month

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
    Returns (by default, for the current month):
      - availablePaid, availableSick
      - paidLeaveThisMonth: bool
      - lastPaidLeaveEndDate: str or None
      - lastLeaveEndDate: str or None
      - separateSandwichUnpaidDays: int

    If ?month=MM&year=YYYY are passed *and* both can be parsed as integers,
    use those; otherwise default to today’s month/year.

    **If the requested year is before the current calendar year,
    both availablePaid and availableSick are forced to 0.**
    """
    user = request.user

    q_month = request.query_params.get("month", None)
    q_year  = request.query_params.get("year", None)

    # === Determine which (month, year) to use ===
    use_current_date = True
    override_month = None
    override_year  = None

    # If neither param is provided, just use today
    if (q_month is None or q_month == "") and (q_year is None or q_year == ""):
        use_current_date = True

    # If only one is provided, that's ambiguous: return 400
    elif (q_month is None or q_month == "") ^ (q_year is None or q_year == ""):
        return Response(
            {"error": "Both 'month' and 'year' must be provided together, or neither."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # If both are non‐empty, try to parse
    else:
        try:
            override_month = int(q_month)
            override_year  = int(q_year)
            # If month not in 1..12 or year is out of a sane range, reject too
            if not (1 <= override_month <= 12 and 1900 <= override_year <= 2100):
                raise ValueError
            use_current_date = False
        except ValueError:
            # Instead of returning a 400 immediately, just ignore these invalid params
            # and fall back to "today".
            use_current_date = True

    if use_current_date:
        today = date.today()
        current_year = today.year
        current_month = today.month
    else:
        current_year = override_year
        current_month = override_month

    # --- 1) Calculate pro‐rated paid leave entitlement based on join date ---
    join_date = user.date_joined
    if join_date.year == current_year:
        months_remaining = 13 - join_date.month
        prorated_paid = int((PAID_LEAVE_ENTITLEMENT * months_remaining) / 12)
    else:
        prorated_paid = PAID_LEAVE_ENTITLEMENT

    # --- 2) Sick leave (no pro‐rating) ---
    prorated_sick = SICK_LEAVE_ENTITLEMENT

    # --- 3) Count approved paid leaves in the given year ---
    paid_leaves = user.leave_requests.filter(
        leave_type="paid",
        status="approved",
        start_date__year=current_year
    )
    used_paid = paid_leaves.count()

    # --- 4) Count approved sick leaves in the given year (sum total_days) ---
    sick_leaves = user.leave_requests.filter(
        leave_type="sick",
        status="approved",
        start_date__year=current_year
    )
    used_sick = sick_leaves.aggregate(total=Sum("total_days"))["total"] or 0

    # === If the requested year is before the current calendar year, force both to 0 ===
    if not use_current_date and current_year < date.today().year:
        available_paid = 0
        available_sick = 0
        paid_leave_this_month = False
    else:
        available_paid = max(prorated_paid - used_paid, 0)
        available_sick = max(prorated_sick - used_sick, 0)
        paid_leave_this_month = paid_leaves.filter(
            start_date__month=current_month
        ).exists()

    # --- 5) Last approved paid leave's end date (if any) ---
    last_paid_leave = paid_leaves.order_by('-end_date').first()
    last_paid_leave_end_date = (
        last_paid_leave.end_date.strftime("%Y-%m-%d") if last_paid_leave else None
    )

    # --- 5b) Last approved leave of ANY type (for “separate sandwich” calc) ---
    last_any_approved = user.leave_requests.filter(
        status="approved"
    ).order_by('-end_date').first()
    last_leave_end_date = (
        last_any_approved.end_date.strftime("%Y-%m-%d") if last_any_approved else None
    )

    # --- Helper: check public holiday ---
    def is_public_holiday(d: date) -> bool:
        public_holidays = {(1, 1), (1, 26), (5, 1), (8, 15), (10, 2), (12, 25)}
        return (d.month, d.day) in public_holidays

    # --- 6) Evaluate “separate sandwich” unpaid days: ---
    consecutive_leaves = list(
        user.leave_requests.filter(status__in=["pending", "approved"]).order_by("start_date")
    )
    separate_sandwich_unpaid_days = 0

    for i in range(len(consecutive_leaves) - 1):
        current_leave = consecutive_leaves[i]
        next_leave = consecutive_leaves[i + 1]

        # Only single‐day leaves
        if (
            current_leave.start_date == current_leave.end_date and
            next_leave.start_date == next_leave.end_date
        ):
            day_diff = (next_leave.start_date - current_leave.end_date).days
            if day_diff > 1:
                gap_days = day_diff - 1  # exclude both endpoints
                working_day_found = False
                for n in range(1, day_diff):
                    gap_date = current_leave.end_date + timedelta(days=n)
                    if gap_date.weekday() < 5 and not is_public_holiday(gap_date):
                        working_day_found = True
                        break
                if not working_day_found:
                    separate_sandwich_unpaid_days += gap_days

    data = {
        "availablePaid": available_paid,
        "availableSick": available_sick,
        "paidLeaveThisMonth": paid_leave_this_month,
        "lastPaidLeaveEndDate": last_paid_leave_end_date,
        "lastLeaveEndDate": last_leave_end_date,
        "separateSandwichUnpaidDays": separate_sandwich_unpaid_days,
    }
    return Response(data, status=200)
