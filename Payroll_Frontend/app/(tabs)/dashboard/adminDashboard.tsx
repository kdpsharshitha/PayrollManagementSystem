// app/dashboard/adminDashboard.tsx

import React from "react";
import { View, Text, Button, StyleSheet } from "react-native";
import { useRouter } from "expo-router";

const AdminDashboard: React.FC = () => {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Admin Dashboard</Text>

      <Button
        title="Create a New User"
        onPress={() => router.push("/admin/createUserScreen")}
      />

      <Button
        title="View HR Leave Requests"
        onPress={() => router.push("/admin/adminHrLeaveRequests")}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 20 },
  heading: { fontSize: 24, marginBottom: 20, textAlign: "center" },
});

export default AdminDashboard;