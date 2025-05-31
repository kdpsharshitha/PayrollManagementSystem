// app/admin/adminHrLeaveRequests.tsx

import React, { useState, useEffect } from "react";
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
import { getAccessToken } from "../../auth/index"; // Adjust this path if needed

// Updated interface to include all necessary leave request fields
interface LeaveRequest {
  id: number;
  employee_id: string;
  employee_name: string;
  start_date: string;
  end_date: string;
  total_days: number;
  leave_type: string;
  description: string; // Renamed from "reason"
  created_at: string;  // Date of request
  status: string;
}

const AdminHrLeaveRequests: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"pending" | "processed">("pending");
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (activeTab === "pending") {
      fetchPendingRequests();
    } else {
      fetchProcessedRequests();
    }
  }, [activeTab]);

  const fetchPendingRequests = async () => {
    setLoading(true);
    try {
      const token = await getAccessToken();
      const response = await axios.get("http://192.168.1.6:8000/api/leave-requests/list/", {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log("API Response:", response.data);
      const pendingData = response.data.filter(
        (req: LeaveRequest) => req.status === "pending"
      );
      setLeaveRequests(pendingData);
    } catch (error: any) {
      console.error(
        "Error fetching pending leave requests:",
        error.response?.data || error.message
      );
      Alert.alert("Error", "Failed to fetch pending HR leave requests.");
    } finally {
      setLoading(false);
    }
  };

  const fetchProcessedRequests = async () => {
    setLoading(true);
    try {
      const token = await getAccessToken();
      const response = await axios.get("http://192.168.1.6:8000/api/leave-requests/list/", {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log("API Response:", response.data);
      const processedData = response.data.filter(
        (req: LeaveRequest) => req.status === "approved" || req.status === "rejected"
      );
      setLeaveRequests(processedData);
    } catch (error: any) {
      console.error(
        "Error fetching processed leave requests:",
        error.response?.data || error.message
      );
      Alert.alert("Error", "Failed to fetch processed HR leave requests.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (id: number, status: "approved" | "rejected") => {
    try {
      const token = await getAccessToken();
      await axios.post(
        `http://192.168.1.6:8000/api/leave-requests/approve/${id}/`,
        { status },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      Alert.alert("Success", `Leave request ${status}!`);
      setLeaveRequests((prevRequests) => prevRequests.filter((req) => req.id !== id));
    } catch (error: any) {
      console.error(`Error updating leave request (${status}):`, error.response?.data || error.message);
      Alert.alert("Error", `Failed to ${status} leave request.`);
    }
  };

  // Helper function to compute the breakdown message.
  const getBreakdownMessage = (item: LeaveRequest): string => {
    if (item.leave_type === "paid") {
      if (item.total_days > 1) {
        const unpaidDays = item.total_days - 1;
        return `Effective: 1 day Paid, ${unpaidDays} day(s) Unpaid`;
      }
      return "Effective: 1 day Paid";
    }
    if (item.leave_type === "sick") {
      if (item.total_days > 2) {
        const extra = item.total_days - 2;
        return `Effective: 2 day(s) Sick, ${extra} day(s) Unpaid`;
      }
      return `Effective: ${item.total_days} day(s) Sick`;
    }
    return "";
  };

  const renderRequest = ({ item }: { item: LeaveRequest }) => (
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
        <Text style={styles.label}>Start Date:</Text> {item.start_date}
      </Text>
      <Text style={styles.itemText}>
        <Text style={styles.label}>End Date:</Text> {item.end_date}
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
      {(item.leave_type === "paid" || item.leave_type === "sick") && (
        <Text style={styles.breakdownText}>{getBreakdownMessage(item)}</Text>
      )}
      {activeTab === "pending" && (
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.approveButton}
            onPress={() => handleUpdateStatus(item.id, "approved")}
          >
            <Text style={styles.buttonText}>Approve</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.rejectButton}
            onPress={() => handleUpdateStatus(item.id, "rejected")}
          >
            <Text style={styles.buttonText}>Reject</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.header}>HR Leave Requests </Text>
      {/* Toggle Buttons */}
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
        <ActivityIndicator size="large" color="#2563EB" style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={leaveRequests}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderRequest}
          contentContainerStyle={{ paddingBottom: 20 }}
          ListEmptyComponent={
            <Text style={styles.noRequests}>
              No {activeTab === "pending" ? "pending" : "processed"} HR leave requests found.
            </Text>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#F7F7F7",
  },
  header: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
    color: "#2563EB",
  },
  tabContainer: {
    flexDirection: "row",
    marginBottom: 20,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: "#e0e0e0",
    borderRadius: 8,
    alignItems: "center",
    marginHorizontal: 5,
  },
  activeTabButton: {
    backgroundColor: "#2563EB",
  },
  tabText: {
    fontSize: 16,
    color: "#000",
  },
  activeTabText: {
    color: "#FFF",
    fontWeight: "bold",
  },
  itemContainer: {
    backgroundColor: "#FFF",
    borderRadius: 8,
    padding: 16,
    marginBottom: 15,
    borderWidth: 0.5,
    borderColor: "#ddd",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  itemText: {
    fontSize: 16,
    marginBottom: 6,
    color: "#333",
  },
  label: {
    fontWeight: "bold",
  },
  breakdownText: {
    fontSize: 15,
    color: "#2563EB",
    marginBottom: 8,
    fontStyle: "italic",
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  approveButton: {
    backgroundColor: "#4CAF50",
    padding: 10,
    borderRadius: 8,
    flex: 1,
    marginRight: 5,
    alignItems: "center",
  },
  rejectButton: {
    backgroundColor: "#F44336",
    padding: 10,
    borderRadius: 8,
    flex: 1,
    marginLeft: 5,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
  noRequests: {
    fontSize: 18,
    textAlign: "center",
    marginTop: 20,
    color: "gray",
  },
});

export default AdminHrLeaveRequests;