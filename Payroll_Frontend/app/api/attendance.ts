// app/api/attendance.ts

import axios from 'axios';
import { ManageResponse, Attendance ,LeaveRequest,AttendanceSummary,AttendanceDetail,LeaveSummary} from '../types/attendance';
import { getAccessToken } from '../auth';
import dayjs from 'dayjs'


const BASE_URL = 'http://192.168.220.49:8000/api/attendance';

/**
 * Fetch “present” vs “on_leave” for today
 * on the /api/attendance/manage/ endpoint.
 */
export async function fetchManageAttendance(): Promise<ManageResponse> {
  const token = await getAccessToken();
  try {
    const response = await axios.get<ManageResponse>(`${BASE_URL}/manage/`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log('📡 [API] fetchManageAttendance response.data →', response.data);
    return response.data;
  } catch (error) {
    console.error('🚨 [API] fetchManageAttendance error →', error);
    throw error;
  }
}

export async function markEntry(
  employeeId: string,
  date: string, // "YYYY-MM-DD"
  time: string  // "HH:MM"
): Promise<Attendance> {
  const token = await getAccessToken();
  const resp = await axios.post<Attendance>(
    `${BASE_URL}/mark-entry/`,
    { employee: employeeId, date, time },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return resp.data;
}

export async function markExit(
  employeeId: string,
  date: string,
  time: string
): Promise<Attendance> {
  const token = await getAccessToken();
  const resp = await axios.post<Attendance>(
    `${BASE_URL}/mark-exit/`,
    { employee: employeeId, date, time },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return resp.data;
}


/** new: create or update */
export async function createAttendance(record: {
  employee: string;
  date: string;
  entry_time?: string;
  exit_time?: string;
}): Promise<Attendance> {
  const token = await getAccessToken();
  const { data } = await axios.post<Attendance>(`${BASE_URL}/attendance/`, record, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}

export async function updateAttendance(
  id: number,
  updates: Partial<{ entry_time: string; exit_time: string }>
): Promise<Attendance> {
  const token = await getAccessToken();
  const { data } = await axios.patch<Attendance>(`${BASE_URL}/attendance/${id}/`, updates, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}

/** Mark a day as leave in attendance table */
export async function markLeave(
  employeeId: string,
  leave_type: 'paid'|'sick'|'unpaid',
  date?: string
): Promise<Attendance> {
  const token = await getAccessToken()
  const payload = { employee: employeeId, leave_type, ...(date && { date }) }
  const { data } = await axios.post<Attendance>(
    `${BASE_URL}/attendance/mark-leave/`,
    payload,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  return data
}


export async function fetchTodayAttendance(employeeId: string): Promise<Attendance> {
  const token = await getAccessToken();
  const { data } = await axios.get<Attendance>(
    `${BASE_URL}/attendance/today/?employee=${employeeId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return data;
}

export async function fetchTodayAttendance1(): Promise<Attendance> {
  const token = await getAccessToken();
  const { data } = await axios.get<Attendance>(
    `${BASE_URL}/today/`,       // ← no ?employee=…
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return data;
}


export async function fetchEmployeeAttendance(
  month: number,
  year: number
): Promise<AttendanceSummary> {
  const token = await getAccessToken();
  const { data } = await axios.get<AttendanceSummary>(
    // no "employee" query param any more — backend uses request.user
    `${BASE_URL}/employee/?month=${month}&year=${year}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  console.log('attendance →', data);
  return data;
}

/**
 * Converts any run of Holidays sandwiched between leaves into UnPaid Leave.
 */
export function applySandwichPolicy(details: AttendanceDetail[] = []): AttendanceDetail[] {
  // 1) build a lookup: date → status
  const lookup = new Map(details.map(d => [d.date, d.status]))

  // 2) for each record…  
  return details.map(d => {
    if (d.status !== 'Holiday') return d

    // find the first non-Holiday going left
    let leftCursor = dayjs(d.date)
    let leftStatus: string | undefined
    while (true) {
      leftCursor = leftCursor.subtract(1, 'day')
      const s = lookup.get(leftCursor.format('YYYY-MM-DD'))
      if (!s) { leftStatus = undefined; break }
      if (s !== 'Holiday') { leftStatus = s; break }
    }

    // find the first non-Holiday going right
    let rightCursor = dayjs(d.date)
    let rightStatus: string | undefined
    while (true) {
      rightCursor = rightCursor.add(1, 'day')
      const s = lookup.get(rightCursor.format('YYYY-MM-DD'))
      if (!s) { rightStatus = undefined; break }
      if (s !== 'Holiday') { rightStatus = s; break }
    }

    // if both ends are any kind of leave, convert
    const leaveEnds = ['Paid Leave','UnPaid Leave']
    if (leftStatus && rightStatus &&
        leaveEnds.includes(leftStatus) &&
        leaveEnds.includes(rightStatus)
    ) {
      return { ...d, status: 'UnPaid Leave' }
    }

    return d
  })
}


// api/attendance.ts
export async function markEntry1(
  date: string,
  time: string,
  latitude: number,
  longitude: number
): Promise<Attendance> {
  const token = await getAccessToken();
  const { data } = await axios.post<Attendance>(
    `${BASE_URL}/mark-entry1/`,
    { date, time, latitude, longitude },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return data;
}


export async function markExit1(
  date: string,
  time: string,
  latitude: number,
  longitude: number
): Promise<Attendance> {
  const token = await getAccessToken();
  const { data } = await axios.post<Attendance>(
    `${BASE_URL}/mark-exit1/`,
    { date, time, latitude, longitude },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return data;
}



export async function updateLeaveStatus(
  dateStr: string,
  status: string
): Promise<Attendance> {
  const token = await getAccessToken();
  const { data } = await axios.post<Attendance>(
    `${BASE_URL}/update-status/`,
    { date: dateStr, status },
    { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } }
  );
  return data;
}



export async function fetchLeaveSummary(
  month: number,
  year: number
): Promise<LeaveSummary> {
  const token = await getAccessToken();
  const { data } = await axios.get<LeaveSummary>(
    `${BASE_URL}/leave-summary/?month=${month}&year=${year}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  console.log('leaveSummary →', data);
  return data;
}

export async function fetchEmployeeAttendance1(): Promise<Attendance> {
  const token = await getAccessToken();
  const { data } = await axios.get<Attendance>(
    `${BASE_URL}/attendance/today/`, // no query params—uses request.user
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  console.log('todayAttendance →', data);
  return data;
}

// 1) New helper to pull “yesterday’s” single record
/*export async function fetchAttendanceByDate( theDate: Date): Promise<Attendance | null> {
  // You’ll need an endpoint like /api/attendance/today/?date=YYYY-MM-DD
  const response = await axios.get<Attendance>(
    `${BASE_URL}/attendance/today/?date=${theDate.toISOString().slice(0,10)}`,
    { headers: { Authorization: `Bearer ${await getAccessToken()}` } }
  );
  return response.data || null;
}*/

export async function fetchAttendanceByDate(dateStr: string): Promise<Attendance> {
  const token = await getAccessToken();
  const { data } = await axios.get<Attendance>(
    `${BASE_URL}/attendance-status/`,
    { params: { date: dateStr }, headers: { Authorization: `Bearer ${token}` } }
  );
  console.log('response.data:', data);

  return data;
}
