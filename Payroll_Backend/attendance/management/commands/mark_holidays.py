# attendance/management/commands/mark_yearly_holidays.py

from django.core.management.base import BaseCommand
from datetime import date, timedelta
from attendance.models import Attendance
from employee.models import Employee

class Command(BaseCommand):
    help = "Mark all weekends & public holidays for a year as 'Holiday' in Attendance"

    def add_arguments(self, parser):
        parser.add_argument(
            "--year",
            type=int,
            required=True,
            help="Year to process (e.g. 2025)"
        )

    def handle(self, *args, **options):
        year = options["year"]

        # 1) Build date range Jan 1 → Dec 31
        start = date(year, 1, 1)
        end   = date(year, 12, 31)
        delta = end - start

        # 2) Identify all weekend / public holiday dates
        def is_public_holiday(d: date) -> bool:
            return (d.month, d.day) in {
                (1, 1),   # New Year’s Day
                (1, 26),  # Republic Day
                (5, 1),   # Labour Day
                (8, 15),  # Independence Day
                (10, 2),  # Gandhi Jayanti
                (12, 25), # Christmas
            }

        holiday_dates = []
        for i in range(delta.days + 1):
            day = start + timedelta(days=i)
            if day.weekday() >= 5 or is_public_holiday(day):
                holiday_dates.append(day)

        if not holiday_dates:
            self.stdout.write("No weekends/holidays found.")
            return

        # 3) Fetch all employee IDs
        emp_ids = list(Employee.objects.values_list("id", flat=True))

        # 4) Bulk-create missing Attendance records
        existing = Attendance.objects.filter(
            date__in=holiday_dates,
            employee_id__in=emp_ids
        ).values_list("employee_id", "date")
        existing_set = set(existing)

        to_create = []
        for emp in emp_ids:
            for day in holiday_dates:
                if (emp, day) not in existing_set:
                    to_create.append(
                        Attendance(
                            employee_id=emp,
                            date=day,
                            status="Holiday",
                            entry_time=None,
                            exit_time=None,
                            work_time=None
                        )
                    )
        Attendance.objects.bulk_create(to_create, ignore_conflicts=True)
        self.stdout.write(f"Created {len(to_create)} holiday rows.")

