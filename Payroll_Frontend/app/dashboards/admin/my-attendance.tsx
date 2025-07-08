// app/dashboards/manager/my-attendance.tsx

import React from 'react'
import { View, Button, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import EmployeeAttendanceDetails from '../../dashboards/employee/attendance-details'

export default function ManagerMyAttendance() {
  const router = useRouter()

  return (
    <View style={styles.container}>
      {/* 
        No `employeeId` prop → backend will use request.user to fetch Manager’s own attendance.
      */}
      <EmployeeAttendanceDetails />

    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  backBtn:   { marginTop: 20 }
})