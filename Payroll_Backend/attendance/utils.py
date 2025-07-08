# attendance/utils.py
from datetime import timedelta, date
from .models import Attendance
from leave_requests.models import LeaveRequest
from employee.models import Employee  # import your Employee model

def is_public_holiday(d: date) -> bool:
    public_holidays = {
        (1, 1), (1, 26), (5, 1),
        (8, 15), (10, 2), (12, 25),
    }
    return (d.month, d.day) in public_holidays

def mark_holidays_and_weekends(start: date, end: date):
    """
    For every employee and every day in [start..end]:
      • If it's Saturday/Sunday or a public holiday, ensure
        Attendance.status == 'Holiday', clearing any times.
      • Otherwise leave the record alone.
    """
    employees = Employee.objects.all()
    total_days = (end - start).days + 1

    for i in range(total_days):
        current = start + timedelta(days=i)
        is_weekend = current.weekday() >= 5
        if not (is_weekend or is_public_holiday(current)):
            continue

        for emp in employees:
            # get existing or new
            att, _ = Attendance.objects.get_or_create(
                employee=emp,
                date=current
            )

            att.status = 'Holiday'
            att.entry_time = att.exit_time = att.work_time = None
            att.save()


def apply_approved_leave(leave_request: LeaveRequest):
    """
    Applies an approved LeaveRequest across Attendance records,
    while preserving weekends & public holidays as 'Holiday'.
    """
    start = leave_request.start_date
    end   = leave_request.end_date
    lt    = leave_request.leave_type.lower()

    # Total inclusive days
    total_days = (end - start).days + 1

    # Counter for non-holiday leave slots
    leave_counter = 0

    for i in range(total_days):
        current = start + timedelta(days=i)

        # Determine if it's weekend or holiday
        is_weekend = current.weekday() >= 5  # 5=Sat, 6=Sun
        is_holiday = is_public_holiday(current)

        # Upsert the attendance row
        att, _ = Attendance.objects.get_or_create(
            employee=leave_request.requester,  # adjust FK if needed
            date=current
        )

        # If the day is already marked Holiday, leave it be
        if att.status == 'Holiday':
            continue

        # 1) Handle weekends & public holidays
        if is_weekend or is_holiday:
            att.status = 'Holiday'
            # clear any clock times
            att.entry_time = att.exit_time = att.work_time = None
            att.save()
            continue

        # 2) Non‐holiday: apply your leave rules using leave_counter
        if lt == 'paid':
            att.status = 'Paid Leave' if leave_counter == 0 else 'UnPaid Leave'

        elif lt == 'sick':
            # first 2 days sick, rest unpaid
            att.status = 'Sick Leave' if leave_counter < 2 else 'UnPaid Leave'

        elif lt == 'unpaid':
            att.status = 'UnPaid Leave'

        elif lt == 'half paid leave':
            att.status = 'Half Paid Leave' if leave_counter == 0 else 'UnPaid Leave'

        elif lt == 'half unpaid leave':
            att.status = 'Half UnPaid Leave' if leave_counter == 0 else 'UnPaid Leave'

        else:
            # fallback
            att.status = 'Absent'

        # increment only for non-holiday days
        leave_counter += 1

        # clear any clock times
        att.entry_time = att.exit_time = att.work_time = None

        att.save()
