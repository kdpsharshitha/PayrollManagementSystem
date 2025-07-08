export interface Employee {
  id: string;
  name: string;
  email: string;
  designation: string;
}

export interface Attendance {
  id: number;
  employee: Employee;
  date: string;
  entry_time: string | null;
  exit_time: string | null;
  status: string;
  email:string;
}

export interface LeaveRequest {
  id: number;
  employee_id: number
  employee_name?: string;
  start_date: string;
  end_date: string;
  leave_type: string;
  status: string;
  note?: string;
  designation: string;
  employee: {
    id: number;
    name: string;
    email: string;
    designation: string;
  }

  
}

export interface ManageResponse {
  present: Attendance[];
  on_leave: LeaveRequest[];
}

export interface AttendanceDetail {
  date: string;            // e.g., "2025-06-15"
  status: string;          // e.g., "present", "absent", "paid", "sick", or "unpaid"
  entry_time?: string;  // ISO‐time string or null
  exit_time?: string;
  work_time?: string;

}

export interface AttendanceSummary {
  present: number;
  absent: number;
  paidLeave: number;
  sickLeave: number;
  unpaidLeave: number;
  halfPaid:   number;
  halfUnpaid: number;
  details?: AttendanceDetail[]; // Optional day-by-day breakdown
}

export interface LeaveSummary {
  remaining_paid_leaves: number;
  remaining_sick_leaves: number;
  month_paid_leaves: number;
  month_half_paid_leaves: number;
  yesterday_status: string | null;
}