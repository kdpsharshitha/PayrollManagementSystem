// app/dashboard/employeeDashboard.tsx

import React from "react";
import { View, Text, Button, StyleSheet } from "react-native";
import { useRouter } from "expo-router";

const EmployeeDashboard: React.FC = () => {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Employee Dashboard</Text>

      <Button 
        title="Request Leave" 
        onPress={() => router.push("/leave-requests/leaveRequestForm")} 
      />

      <Button 
        title="Check Leave Status" 
        onPress={() => router.push("/leave-requests/employeeLeaveStatus")} 
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  heading: { fontSize: 24, marginBottom: 20 },
});

export default EmployeeDashboard;