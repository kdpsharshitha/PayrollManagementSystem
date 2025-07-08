import React from 'react';
import ManagerManageAttendance from '../manager/mng_attendance';

// Admin just re-uses the same screen component,
// because on the backend `/manage/` returns Managers if role='admin'.
export default function AdminManageManagerAttendance() {
  return <ManagerManageAttendance />;
}
