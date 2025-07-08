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
import { getAccessToken } from "../../auth/index";

interface LeaveRequest {
  id: number;
  employee_id: string;
  employee_name: string;
  start_date: string;
  end_date: string;
  total_days: number;
  leave_type: string;
  description: string;
  created_at: string;
  status: string;
  half_day_period?: "morning" | "afternoon";  
}

const COLORS = {
  primary: "#2563EB",
  background: "#F7F7F7",
  card: "#FFFFFF",
  text: "#333333",
  gray: "#999999",
  approved: "#4CAF50",
  rejected: "#F44336",
  breakdown: "#4682B4",
};

const AdminManagerLeaveRequests: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"pending" | "processed">("pending");
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    activeTab === "pending" ? fetchPendingRequests() : fetchProcessedRequests();
  }, [activeTab]);

  const fetchPendingRequests = async () => {
    setLoading(true);
    try {
      const token = await getAccessToken();
      const response = await axios.get<LeaveRequest[]>(
        "http://192.168.220.49:8000/api/leave-requests/list/",
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const pendingData = response.data
        .filter(req => req.status === "pending")
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setLeaveRequests(pendingData);
    } catch (error: any) {
      console.error(error.response?.data || error.message);
      Alert.alert("Error", "Failed to fetch pending Manager leave requests.");
    } finally {
      setLoading(false);
    }
  };

  const fetchProcessedRequests = async () => {
    setLoading(true);
    try {
      const token = await getAccessToken();
      const response = await axios.get<LeaveRequest[]>(
        "http://192.168.220.49:8000/api/leave-requests/list/",
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const processedData = response.data
        .filter(req => req.status === "approved" || req.status === "rejected")
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setLeaveRequests(processedData);
    } catch (error: any) {
      console.error(error.response?.data || error.message);
      Alert.alert("Error", "Failed to fetch processed Manager leave requests.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (id: number, status: "approved" | "rejected") => {
    try {
      const token = await getAccessToken();
      await axios.post(
        `http://192.168.220.49:8000/api/leave-requests/approve/${id}/`,
        { status },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      Alert.alert("Success", `Leave request ${status}!`);
      setLeaveRequests(prev => prev.filter(req => req.id !== id));
    } catch (error: any) {
      console.error(error.response?.data || error.message);
      Alert.alert("Error", `Failed to ${status} leave request.`);
    }
  };

  const getBreakdownMessage = (item: LeaveRequest): string => {
    if (item.leave_type === "paid") {
      if (item.total_days > 1) return `1 day Paid, ${item.total_days - 1} days Unpaid`;
      return "1 day Paid";
    }
    if (item.leave_type === "sick") {
      if (item.total_days > 2) return `2 days Sick, ${item.total_days - 2} days Unpaid`;
      return `${item.total_days} days Sick`;
    }
    return "";
  };

  const formatDateTime = (iso: string): string => {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = (`0${d.getMonth() + 1}`).slice(-2);
    const day = (`0${d.getDate()}`).slice(-2);
    let h = d.getHours();
    const min = (`0${d.getMinutes()}`).slice(-2);
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${y}/${m}/${day}, ${h}:${min} ${ampm}`;
  };

  const renderRequest = ({ item }: { item: LeaveRequest }) => (
    <View style={styles.itemContainer}>
      <Text style={styles.itemText}><Text style={styles.label}>Req ID:</Text> {item.id}</Text>
      <Text style={styles.itemText}><Text style={styles.label}>Name:</Text> {item.employee_name}</Text>
      <Text style={styles.itemText}><Text style={styles.label}>Dates:</Text> {item.start_date} → {item.end_date}</Text>
      <Text style={styles.itemText}>
  <Text style={styles.label}>Type:</Text>{" "}
  {(() => {
    let label = item.leave_type;
    if (
      (item.leave_type === "Half Paid Leave" ||
       item.leave_type === "Half UnPaid Leave") &&
      item.half_day_period
    ) {
      const cap = item.half_day_period.charAt(0).toUpperCase() +
                  item.half_day_period.slice(1);
      label += ` [${cap}]`;
    }
    return label;
  })()}
</Text>
      <Text style={styles.itemText}><Text style={styles.label}>Desc:</Text> {item.description}</Text>
      {getBreakdownMessage(item) !== "" && <Text style={styles.breakdownText}>{getBreakdownMessage(item)}</Text>}
      <View style={styles.statusContainer}>
        <Text style={styles.label}>Status:</Text>
        <Text style={[styles.statusText,
          item.status === "approved" ? styles.statusApproved :
          item.status === "rejected" ? styles.statusRejected : {}
        ]}>{` ${item.status.toUpperCase()}`}</Text>
      </View>
      {activeTab === "pending" && (
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: COLORS.approved }]} onPress={() => handleUpdateStatus(item.id, "approved")}>
            <Text style={styles.buttonText}>Approve</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: COLORS.rejected }]} onPress={() => handleUpdateStatus(item.id, "rejected")}>
            <Text style={styles.buttonText}>Reject</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Manager Leave Requests</Text>
      <View style={styles.segmentContainer}>
        <TouchableOpacity style={[styles.tabButton, activeTab === "pending" && styles.activeTabButton]} onPress={() => setActiveTab("pending")}>
          <Text style={[styles.tabText, activeTab === "pending" && styles.activeTabText]}>Pending</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabButton, activeTab === "processed" && styles.activeTabButton]} onPress={() => setActiveTab("processed")}>
          <Text style={[styles.tabText, activeTab === "processed" && styles.activeTabText]}>Processed</Text>
        </TouchableOpacity>
      </View>
      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={leaveRequests}
          keyExtractor={item => item.id.toString()}
          renderItem={renderRequest}
          contentContainerStyle={{ paddingBottom: 20 }}
          ListEmptyComponent={<Text style={styles.noRequests}>No {activeTab === "pending" ? "pending" : "processed"} Manager leave requests found.</Text>}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, paddingTop: 20 },
  header: { fontSize: 26, fontWeight: "bold", textAlign: "center", color: COLORS.primary, marginBottom: 12 },
  segmentContainer: { flexDirection: "row", marginHorizontal: 20, marginBottom: 16 },
  tabButton: { flex: 1, paddingVertical: 10, backgroundColor: COLORS.card, borderRadius: 8, alignItems: "center", marginHorizontal: 4 },
  activeTabButton: { backgroundColor: COLORS.primary },
  tabText: { fontSize: 16, color: COLORS.text },
  activeTabText: { color: COLORS.card, fontWeight: "600" },
  itemContainer: { backgroundColor: COLORS.card, marginHorizontal: 16, marginVertical: 8, padding: 16, borderRadius: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 2 },
  itemText: { fontSize: 16, color: COLORS.text, marginBottom: 4 },
  label: { fontWeight: "600" },
  breakdownText: { fontSize: 14, color: COLORS.breakdown, fontStyle: "italic", marginBottom: 6 },
  statusContainer: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  statusText: { fontSize: 16, fontWeight: "600" },
  statusApproved: { color: COLORS.approved },
  statusRejected: { color: COLORS.rejected },
  buttonContainer: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  actionBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: "center", marginHorizontal: 4 },
  buttonText: { color: "#fff", fontWeight: "600" },
  noRequests: { textAlign: "center", marginTop: 20, color: COLORS.gray, fontSize: 16 },
});

export default AdminManagerLeaveRequests;
