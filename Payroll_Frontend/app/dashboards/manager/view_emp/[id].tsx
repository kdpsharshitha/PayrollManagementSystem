import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet, ScrollView, Alert, TouchableOpacity, Platform } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
//import * as SecureStore from "expo-secure-store";
import { getAccessToken } from "../../../auth/index";
import { BASE_URL } from "../../../../config";

type Employee = {
  id: string;
  name: string;
  email: string;
  gender: string;
  account_type: string;
  account_name: string;
  ifsc_code: string;
  pan_no: string;
  phone_no: string;
  emergency_phone_no: string;
  address: string;
  employment_type: string;
  role: string;
  designation: string;
  date_joined: string;
  supervisor: string;
  supervisor_email: string;
  fee_per_month: string;
  pay_structure: string;
};

export default function ViewEmployee() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchEmployeeDetails(id);
    }
  }, [id]);

  const showAlert = (title: string, message: string) => {
        if (Platform.OS === "web") {
          window.alert(`${title}: ${message}`);
        } else {
          Alert.alert(title, message);
        }
  };

  const fetchEmployeeDetails = async (empId: string) => {
    try {
      const token = await getAccessToken();
      if (!token) {
        showAlert("Authentication Error", "You are not logged in.");
        return;
      }

      const res = await fetch(`${BASE_URL}/api/employee/employees/${empId}/`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error("Failed to fetch employee");
      }

      const data = await res.json();
      setEmployee(data);
    } catch (error) {
      console.error("Failed to fetch employee details:", error);
    } finally {
      setLoading(false);
    }
  };

  const fieldsToDisplay = [
    { key: "id", label: "Employee ID" },
    { key: "name", label: "Name" },
    { key: "email", label: "Email" },
    { key: "gender", label: "Gender" },
    { key: "account_type", label: "Bank Name" },
    { key: "account_name", label: "Account Holder Name" },
    { key: "ifsc_code", label: "IFSC Code" },
    { key: "pan_no", label: "PAN Number" },
    { key: "phone_no", label: "Phone Number" },
    { key: "emergency_phone_no", label: "Emergency Phone" },
    { key: "address", label: "Address" },
    { key: "employment_type", label: "Employment Type" },
    { key: "role", label: "Role" },
    { key: "designation", label: "Designation" },
    { key: "date_joined", label: "Date Joined" },
    { key: "supervisor", label: "Assigned Supervisor" },
    { key: "supervisor_email", label: "Supervisor Email" },
    { key: "fee_per_month", label: "Fee Per Month" },
    { key: "pay_structure", label: "Pay Structure" },
  ];

  if (loading) {
    return <ActivityIndicator style={{ marginTop: 40 }} size="large" color="#22186F" />;
  }

  if (!employee) {
    return <Text style={{ textAlign: "center", marginTop: 40, fontSize: 16, color: "#555" }}>Employee not found</Text>;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 30 }}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Ionicons name="arrow-back" size={20} color="#22186F" />
      </TouchableOpacity>

      <Text style={styles.heading}>Employee Details</Text>

      <View style={styles.detailCard}>
        {fieldsToDisplay.map(({ key, label }) => (
          <View key={key} style={styles.fieldRow}>
            <Text style={styles.detailLabel}>{label}:</Text>
            <Text style={styles.detailValue}>{employee[key as keyof Employee] || "N/A"}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingHorizontal: 10,
    paddingTop: 20,
  },
  backButton: {
    marginBottom: 12,
    width: 30,
    height: 30,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 20,
    backgroundColor: "#e1e4ee",
    alignSelf: "flex-start",
  },
  heading: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#22186F",
    marginBottom: 20,
    textAlign: "center",
  },
  detailCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    alignSelf: "center",       // center search box
    width: "100%",
    maxWidth: 800,
  },
  fieldRow: {
    flexDirection: "row",
    marginBottom: 12,
    flexWrap: "wrap",
    alignItems: "flex-start",
  },
  detailLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#666",
    minWidth: Platform.OS === "web" ? 160 : 0,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: "500",
    color: "#222",
    marginLeft:10,
    flex: 1,
    lineHeight: 22,
  },
});
