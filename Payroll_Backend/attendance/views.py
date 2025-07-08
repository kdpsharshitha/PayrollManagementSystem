from datetime import date, datetime, time as dtime
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet
from rest_framework import status
from django.utils import timezone
from rest_framework.decorators import action
from datetime import timedelta
from django.db.models import Count, Q ,OuterRef, Exists
from django.db.models.functions import Lower, Trim
from django.utils.dateparse import parse_datetime
from rest_framework import status as http_status
from rest_framework.views import APIView

from .models import Employee, Attendance
from leave_requests.models import LeaveRequest
from .serializers import AttendanceSerializer
from leave_requests.serializers import LeaveRequestSerializer
from employee.serializers import EmployeeSerializer
from attendance.serializers import LeaveSummarySerializer


class AttendanceViewSet(ModelViewSet):
    queryset = Attendance.objects.all()
    serializer_class = AttendanceSerializer
    @action(detail=False, methods=['get'], url_path='today')
    def today(self, request):
        employee_id = request.query_params.get('employee')
        if not employee_id:
            return Response(
                {"detail": "Employee id is required."},
                status=status.HTTP_400_BAD_REQUEST
            )
        today = date.today()
        # Assuming your Attendance model has a date field (e.g., "date")
        attendance = Attendance.objects.filter(employee_id=employee_id, date=today).first()
        if not attendance:
            return Response({"detail": "Attendance record not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = AttendanceSerializer(attendance)
        return Response(serializer.data)


    @action(detail=False, methods=['post'], url_path='mark-leave')
    def mark_leave(self, request):
        """
        POST /api/attendance/attendance/mark-leave/
        Body: {
          "employee": <employee_id>,
          "leave_type": "paid"|"sick"|"unpaid",
          "date": "YYYY-MM-DD"   # optional, defaults to today
        }
        """
        emp_id      = request.data.get('employee')
        leave_type  = request.data.get('leave_type')
        day_str     = request.data.get('date')
        leave_date  = date.fromisoformat(day_str) if day_str else date.today()

        if not emp_id or not leave_type:
            return Response(
              {"detail": "employee and leave_type are required"},
              status=status.HTTP_400_BAD_REQUEST
            )

        att, created = Attendance.objects.get_or_create(
            employee_id=emp_id,
            date=leave_date,
            defaults={'status': leave_type, 'work_time': timedelta(0)
},
        )
        if not created:
            att.status = leave_type
            att.work_time = timedelta(0)

            att.save()

        return Response(AttendanceSerializer(att).data)
    
class LeaveRequestViewSet(ModelViewSet):
    """
    /api/attendance/leave-requests/
    Standard CRUD on LeaveRequest records.
    """
    queryset = LeaveRequest.objects.all()
    serializer_class = LeaveRequestSerializer


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def manage_attendance(request):
    today = date.today()
    user = request.user

    # 1) Determine which employees the current user manages.
    if user.role == 'admin':
        # For admin dashboard, manage HR users.
        emp_qs = Employee.objects.filter(role='hr')
    elif user.role == 'hr':
        # For HR dashboard, manage employee users.
        emp_qs = Employee.objects.filter(role='employee')
    else:
        return Response({'detail': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)

    # Get a list of employee IDs from the queryset.
    emp_ids = emp_qs.values_list('id', flat=True)

    # 2) Find approved leaves covering today by matching on employee_id.
    active_leaves = LeaveRequest.objects.filter(
        employee_id__in=emp_ids,  # note: using employee_id field as it appears in your data
        status='approved',
        start_date__lte=today,
        end_date__gte=today,
    )
    on_leave = LeaveRequestSerializer(active_leaves, many=True).data

    # 3) Exclude employees who have an approved leave for today.
    on_leave_ids = active_leaves.values_list('employee_id', flat=True)
    present_qs = emp_qs.exclude(id__in=on_leave_ids)

    # 4) Serialize the list of present employees.
    present = EmployeeSerializer(present_qs, many=True).data

    return Response({
        'present': present,
        'on_leave': on_leave,
    })

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def employee_attendance(request):
    # Use the logged-in user; adjust if your user model or Employee relation is different.
    employee = request.user
    month = request.query_params.get('month')
    year = request.query_params.get('year')
    if not month or not year:
        return Response({"error": "Missing required month and year parameters"}, status=400)

    month = int(month)
    year = int(year)

    queryset = Attendance.objects.filter(
        employee_id=employee.id,  # or if your Attendance model links to user, simply "employee=employee"
        date__year=year,
        date__month=month
    )
    # If no month passed, aggregate entire year
    base_filter = dict(employee_id=employee.id, date__year=year)
    if month:
        base_filter['date__month'] = month
    queryset = Attendance.objects.filter(**base_filter)

    summary = queryset.aggregate(
        present=Count('id', filter=Q(status__iexact='present')),
        absent=Count('id', filter=Q(status__iexact='absent')),
        paidLeave=Count('id', filter=Q(status__iexact='paid')),
        sickLeave=Count('id', filter=Q(status__iexact='sick')),
        unpaidLeave=Count('id', filter=Q(status__iexact='unpaid')),
        halfPaid=Count('id', filter=Q(status__iexact='half_paid')),
        halfUnpaid=Count('id', filter=Q(status__iexact='half_unpaid')),
        
    )

    details = AttendanceSerializer(queryset, many=True).data
    summary['details'] = details
    return Response(summary)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_entry(request):
    emp = request.data.get('employee')
    ds = request.data.get('date')  # "YYYY-MM-DD"
    ts = request.data.get('time')  # "HH:MM"
    if not emp or not ds or not ts:
        return Response({'detail':'employee, date & time required'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        attendance_date = date.fromisoformat(ds)
        h, m = map(int, ts.split(':'))
        entry_time = dtime(hour=h, minute=m)
    except Exception:
        return Response({'detail':'Invalid date or time format'}, status=status.HTTP_400_BAD_REQUEST)

    att, _ = Attendance.objects.update_or_create(
        employee_id=emp,
        date=attendance_date,
        defaults={'entry_time': entry_time}
    )
    return Response(AttendanceSerializer(att).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_exit(request):
    emp = request.data.get('employee')
    ds = request.data.get('date')
    ts = request.data.get('time')
    if not emp or not ds or not ts:
        return Response({'detail':'employee, date & time required'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        attendance_date = date.fromisoformat(ds)
        h, m = map(int, ts.split(':'))
        exit_time = dtime(hour=h, minute=m)
    except Exception:
        return Response({'detail':'Invalid date or time format'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        att = Attendance.objects.get(employee_id=emp, date=attendance_date)
    except Attendance.DoesNotExist:
        return Response({'detail':'No entry record found'}, status=status.HTTP_404_NOT_FOUND)

    att.exit_time = exit_time
    att.save()
    return Response(AttendanceSerializer(att).data)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_entry1(request):
    ds = request.data.get('date')
    ts = request.data.get('time')
    lat = request.data.get('latitude')
    lng = request.data.get('longitude')

    if not all([ds, ts, lat is not None, lng is not None]):
        return Response(
          {'detail': 'date, time, latitude & longitude required'},
          status=status.HTTP_400_BAD_REQUEST
        )

    try:
        attendance_date = date.fromisoformat(ds)
        h, m = map(int, ts.split(':'))
        entry_time = dtime(hour=h, minute=m)
    except Exception:
        return Response({'detail': 'Invalid date/time format'}, status=status.HTTP_400_BAD_REQUEST)

    att, _ = Attendance.objects.update_or_create(
        employee=request.user,
        date=attendance_date,
        defaults={
            'entry_time': entry_time,
            'entry_latitude': lat,
            'entry_longitude': lng
        }
    )
    return Response(AttendanceSerializer(att).data)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_exit1(request):
    ds = request.data.get('date')
    ts = request.data.get('time')
    lat = request.data.get('latitude')
    lng = request.data.get('longitude')

    # require date, time, latitude & longitude
    if not all([ds, ts, lat is not None, lng is not None]):
        return Response(
            {'detail': 'date, time, latitude & longitude required'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # parse date & time
    try:
        attendance_date = date.fromisoformat(ds)
        h, m = map(int, ts.split(':'))
        exit_time = dtime(hour=h, minute=m)
    except Exception:
        return Response(
            {'detail': 'Invalid date or time format'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # fetch existing record
    try:
        att = Attendance.objects.get(employee=request.user, date=attendance_date)
    except Attendance.DoesNotExist:
        return Response(
            {'detail': 'No entry record found'},
            status=status.HTTP_404_NOT_FOUND
        )

    # update exit time and coords
    att.exit_time = exit_time
    att.exit_latitude = lat
    att.exit_longitude = lng
    att.save()

    return Response(AttendanceSerializer(att).data)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def update_leave_status(request):
    ds = request.data.get('date')  # expected in "YYYY-MM-DD" format
    new_status = request.data.get('status')

    if not ds or not new_status:
        return Response(
            {'detail': 'date and status required'},
            status=http_status.HTTP_400_BAD_REQUEST
        )

    try:
        attendance_date = date.fromisoformat(ds)
    except Exception:
        return Response(
            {'detail': 'Invalid date format'},
            status=http_status.HTTP_400_BAD_REQUEST
        )

    # Update or create the Attendance record for the current user and date,
    # resetting entry_time, exit_time, and work_time to None.
    attendance, created = Attendance.objects.update_or_create(
        employee=request.user,
        date=attendance_date,
        defaults={
            'status': new_status,
            'entry_time': None,
            'exit_time': None,
            'work_time': None,
        }
    )
    
    serializer = AttendanceSerializer(attendance)
    return Response(serializer.data, status=http_status.HTTP_200_OK)

YEARLY_PAID_LEAVE_ENTITLEMENT = 6
YEARLY_SICK_LEAVE_ENTITLEMENT = 3
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def leave_summary_view(request):
    month = request.query_params.get('month')
    year  = request.query_params.get('year')
    # Compute yesterday and look up its status
    today = date.today()
    yesterday = today - timedelta(days=1)
    
    if not month or not year:
        return Response(
            {"detail": "month and year query params are required."},
            status=400
        )
    try:
        month = int(month)
        year  = int(year)
    except ValueError:
        return Response(
            {"detail": "month and year must be integers."},
            status=400
        )

    emp = request.user  # <-- treat the authenticated user as Employee

    used_paid = Attendance.objects.filter(
        employee=emp, date__year=year, status='Paid Leave'
    ).count()
    used_sick = Attendance.objects.filter(
        employee=emp, date__year=year, status='Sick Leave'
    ).count()

    month_paid = Attendance.objects.filter(
        employee=emp, date__year=year, date__month=month, status='Paid Leave'
    ).count()
    month_half = Attendance.objects.filter(
        employee=emp, date__year=year, date__month=month, status='Half Paid Leave'
    ).count()

    try:
        yesterday_record = Attendance.objects.get(employee=emp, date=yesterday)
        yesterday_status = yesterday_record.status
    except Attendance.DoesNotExist:
        yesterday_status = None

    payload = {
        "remaining_paid_leaves": YEARLY_PAID_LEAVE_ENTITLEMENT - used_paid,
        "remaining_sick_leaves": YEARLY_SICK_LEAVE_ENTITLEMENT - used_sick,
        "month_paid_leaves": month_paid,
        "month_half_paid_leaves": month_half,
        "yesterday_status": yesterday_status, 
    }
    serializer = LeaveSummarySerializer(payload)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def today_attendance_view(request):
    """
    Return the Attendance record for request.user on today's date.
    If none exists yet, you can return { date: today, status: null, ... }
    or 404—whichever fits your UX.
    """
    today = date.today()
    user = request.user  # your Employee user model

    try:
        record = Attendance.objects.get(employee=user, date=today)
        serializer = AttendanceSerializer(record)
        return Response(serializer.data)
    except Attendance.DoesNotExist:
        # Option A: return an empty skeleton so frontend can still set date/time
        empty = {
            "id": None,
            "employee": user.pk,
            "date": today,
            "entry_time": None,
            "exit_time": None,
            "work_time": None,
            "status": None,
        }
        return Response(empty, status=status.HTTP_200_OK)
    
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def attendance_status(request):
    ds = request.query_params.get('date')
    if not ds:
        return Response({'detail': 'date required'}, status=400)
    try:
        d = date.fromisoformat(ds)
    except ValueError:
        return Response({'detail': 'Invalid date format'}, status=400)
    try:
        att = Attendance.objects.get(employee=request.user, date=d)
    except Attendance.DoesNotExist:
        return Response({'detail': 'No record'}, status=404)
    return Response(AttendanceSerializer(att).data)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def attendance_by_date(request):
    """
    GET /api/attendance/by-date/?date=YYYY-MM-DD
    Returns two lists:
      - marked:   attendance records (with lat/lng) for the given date
      - unmarked: employees with NO attendance record for that date
    """
    ds = request.query_params.get('date')
    if not ds:
        return Response({'detail': 'date query param required (YYYY-MM-DD)'},
                        status=status.HTTP_400_BAD_REQUEST)

    try:
        target = date.fromisoformat(ds)
    except ValueError:
        return Response({'detail': 'Invalid date format; expected YYYY-MM-DD'},
                        status=status.HTTP_400_BAD_REQUEST)

    # 1️⃣ fetch all Attendance rows for that date
    marked_qs = Attendance.objects.filter(date=target).select_related('employee')
    marked = AttendanceSerializer(marked_qs, many=True).data

    # 2️⃣ find employees *without* any Attendance on that date
    #    Using Exists() for efficiency:
    attendance_for_date = Attendance.objects.filter(employee=OuterRef('pk'),
                                                    date=target)
    unmarked_qs = Employee.objects.annotate(
        has_attendance=Exists(attendance_for_date)
    ).filter(has_attendance=False)
    unmarked = EmployeeSerializer(unmarked_qs, many=True).data
    print("→ attendance_by_date data:", marked,"Unmarked:",unmarked)

    return Response({
        'marked':   marked,
        'unmarked': unmarked
    })