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
import { getAccessToken } from "../auth";
import { ListRenderItem } from "react-native"; // Ensure the path is correct

interface LeaveRequestListProps {
  userRole?: "admin" | "hr" | "employee";  // Define expected roles if needed
}

export interface LeaveRequest {
  id: number;
  start_date: string;
  end_date: string;
  reason: string;
  status: string;
}

const LeaveRequestList: React.FC<LeaveRequestListProps> = ({ userRole }) => {
  // Explicitly typing activeTab as either "pending" or "processed"
  const [activeTab, setActiveTab] = useState<"pending" | "processed">("pending");
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (activeTab === "pending") {
      fetchPendingRequests();
    } else if (activeTab === "processed") {
      fetchProcessedRequests();
    }
  }, [activeTab]);

  const fetchPendingRequests = async (): Promise<void> => {
    setLoading(true);
    try {
      const token = await getAccessToken();
      const response = await axios.get<LeaveRequest[]>(
        "http://192.168.17.49:8000/leave-requests/list/",
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      console.log("API Response:", response.data);
      const pendingData = response.data.filter(
        (req: LeaveRequest) => req.status === "pending"
      );
      setLeaveRequests(pendingData);
    } catch (error: any) {
      console.error("Error fetching pending leave requests:", error.response?.data || error.message);
      Alert.alert("Error", "Failed to fetch pending leave requests.");
    } finally {
      setLoading(false);
    }
  };

  const fetchProcessedRequests = async (): Promise<void> => {
    setLoading(true);
    try {
      const token = await getAccessToken();
      const response = await axios.get<LeaveRequest[]>(
        "http://192.168.17.49:8000/leave-requests/list/",
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      console.log("API Response:", response.data);
      const processedData = response.data.filter(
        (req: LeaveRequest) => req.status === "approved" || req.status === "rejected"
      );
      setLeaveRequests(processedData);
    } catch (error: any) {
      console.error("Error fetching processed leave requests:", error.response?.data || error.message);
      Alert.alert("Error", "Failed to fetch processed leave requests.");
    } finally {
      setLoading(false);
    }
  };

  // Update the leave request's status with explicit parameter types
  const handleUpdateStatus = async (
    id: number,
    newStatus: "approved" | "rejected"
  ): Promise<void> => {
    try {
      const token = await getAccessToken();
      await axios.post(
        `http://192.168.17.49:8000/leave-requests/approve/${id}/`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      Alert.alert("Success", `Leave request ${newStatus}!`);
      setLeaveRequests(leaveRequests.filter((req) => req.id !== id));
    } catch (error: any) {
      console.error(
        `Error updating leave request (${newStatus}):`,
        error.response?.data || error.message
      );
      Alert.alert("Error", `Failed to ${newStatus} leave request.`);
    }
  };

  // Render each leave request
  const renderRequest: ListRenderItem<LeaveRequest> = ({ item }) => (
    <View style={styles.itemContainer}>
      <Text style={styles.itemText}>
        <Text style={styles.label}>Request ID:</Text> {item.id}
      </Text>
      <Text style={styles.itemText}>
        <Text style={styles.label}>Start:</Text> {item.start_date} |{" "}
        <Text style={styles.label}>End:</Text> {item.end_date}
      </Text>
      <Text style={styles.itemText}>
        <Text style={styles.label}>Reason:</Text> {item.reason}
      </Text>
      <Text style={styles.itemText}>
        <Text style={styles.label}>Status:</Text> {item.status.toUpperCase()}
      </Text>

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
      <Text style={styles.header}>Leave Requests</Text>

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
        <ActivityIndicator size="large" color="#0000ff" style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={leaveRequests}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderRequest}
          contentContainerStyle={{ paddingBottom: 20 }}
          ListEmptyComponent={
            <Text style={styles.noRequests}>
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
  buttonContainer: { flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  approveButton: { backgroundColor: "#4CAF50", padding: 10, borderRadius: 5, flex: 1, marginRight: 5 },
  rejectButton: { backgroundColor: "#F44336", padding: 10, borderRadius: 5, flex: 1, marginLeft: 5 },
  buttonText: { color: "#fff", fontWeight: "bold", textAlign: "center" },
  noRequests: { fontSize: 18, textAlign: "center", marginTop: 20, color: "gray" },
});

export default LeaveRequestList;