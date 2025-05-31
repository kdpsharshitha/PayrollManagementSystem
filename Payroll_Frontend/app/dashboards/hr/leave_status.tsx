// app/leave-requests/hrLeaveStatus.tsx

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import axios from "axios";
import { getAccessToken } from "../../auth"; // Adjust the relative path if needed

// Updated interface for a leave request
interface LeaveRequest {
  id: number;
  employee_id: string;
  employee_name: string;
  start_date: string;
  end_date: string;
  total_days: number;
  leave_type: string;
  description: string;  // Replaced 'reason' field
  created_at: string;   // Date of request
  status: string;
}

const HrLeaveStatus: React.FC = () => {
  // Track the selected tab (either "pending" or "processed")
  const [activeTab, setActiveTab] = useState<"pending" | "processed">("pending");
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // Fetch leave requests whenever the active tab changes
  useEffect(() => {
    if (activeTab === "pending") {
      fetchPendingRequests();
    } else if (activeTab === "processed") {
      fetchProcessedRequests();
    }
  }, [activeTab]);

  // Fetch pending leave requests
  const fetchPendingRequests = async () => {
    setLoading(true);
    try {
      const token = await getAccessToken();
      const response = await axios.get("http://192.168.1.6:8000/api/leave-requests/list/", {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log("API Response:", response.data);
      const pendingData: LeaveRequest[] = response.data.filter(
        (req: LeaveRequest) => req.status === "pending"
      );
      setLeaveRequests(pendingData);
    } catch (error: any) {
      console.error("Error fetching pending leave requests:", error.response?.data || error.message);
      Alert.alert("Error", "Unable to fetch pending leave requests.");
    } finally {
      setLoading(false);
    }
  };

  // Fetch processed requests (approved or rejected)
  const fetchProcessedRequests = async () => {
    setLoading(true);
    try {
      const token = await getAccessToken();
      const response = await axios.get("http://192.168.1.6:8000/api/leave-requests/list/", {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log("API Response:", response.data);
      const processedData: LeaveRequest[] = response.data.filter(
        (req: LeaveRequest) => req.status === "approved" || req.status === "rejected"
      );
      setLeaveRequests(processedData);
    } catch (error: any) {
      console.error("Error fetching processed leave requests:", error.response?.data || error.message);
      Alert.alert("Error", "Unable to fetch processed leave requests.");
    } finally {
      setLoading(false);
    }
  };

  // Render a single leave request item
  const renderLeaveRequest = ({ item }: { item: LeaveRequest }) => (
    <View style={styles.itemContainer}>
      <Text style={styles.itemText}>
        <Text style={styles.label}>Request ID:</Text> {item.id}
      </Text>
      <Text style={styles.itemText}>
        <Text style={styles.label}>Employee ID:</Text> {item.employee_id}
      </Text>
      <Text style={styles.itemText}>
        <Text style={styles.label}>Employee Name:</Text> {item.employee_name}
      </Text>
      <Text style={styles.itemText}>
        <Text style={styles.label}>Dates:</Text> {item.start_date} - {item.end_date}
      </Text>
      <Text style={styles.itemText}>
        <Text style={styles.label}>Total Days:</Text> {item.total_days}
      </Text>
      <Text style={styles.itemText}>
        <Text style={styles.label}>Leave Type:</Text> {item.leave_type}
      </Text>
      <Text style={styles.itemText}>
        <Text style={styles.label}>Description:</Text> {item.description}
      </Text>
      <Text style={styles.itemText}>
        <Text style={styles.label}>Date of Request:</Text> {item.created_at}
      </Text>
      <Text style={styles.itemText}>
        <Text style={styles.label}>Status:</Text> {item.status.toUpperCase()}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.header}>HR Leave Requests</Text>

      {/* Tab Buttons */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === "pending" && styles.activeTabButton]}
          onPress={() => setActiveTab("pending")}
        >
          <Text style={[styles.tabText, activeTab === "pending" && styles.activeTabText]}>
            Pending Requests
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === "processed" && styles.activeTabButton]}
          onPress={() => setActiveTab("processed")}
        >
          <Text style={[styles.tabText, activeTab === "processed" && styles.activeTabText]}>
            Processed Requests
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#0000ff" style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={leaveRequests}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderLeaveRequest}
          contentContainerStyle={{ paddingBottom: 20 }}
          ListEmptyComponent={
            <Text style={styles.emptyListText}>
              No {activeTab === "pending" ? "pending" : "processed"} leave requests found.
            </Text>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  header: { fontSize: 24, fontWeight: "bold", marginBottom: 20 },
  tabContainer: { flexDirection: "row", marginBottom: 20 },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: "#e0e0e0",
    borderRadius: 5,
    alignItems: "center",
    marginHorizontal: 5,
  },
  activeTabButton: { backgroundColor: "#2196F3" },
  tabText: { fontSize: 16, color: "#000" },
  activeTabText: { color: "#fff", fontWeight: "bold" },
  itemContainer: {
    padding: 15,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 5,
    marginBottom: 10,
    backgroundColor: "#f9f9f9",
  },
  itemText: { fontSize: 16, marginBottom: 5 },
  label: { fontWeight: "bold" },
  emptyListText: {
    fontSize: 16,
    textAlign: "center",
    color: "gray",
    marginTop: 20,
  },
});

export default HrLeaveStatus;