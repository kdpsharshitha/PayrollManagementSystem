import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import axios from "axios";
import { getAccessToken } from "../../auth";
import SegmentedControl from '@react-native-segmented-control/segmented-control';
import { ListRenderItem } from "react-native";

export interface LeaveRequest {
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

interface LeaveRequestListProps {
  userRole?: "admin" | "manager" | "employee";
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

const LeaveRequestList: React.FC<LeaveRequestListProps> = ({ userRole }) => {
  const [activeTab, setActiveTab] = useState<"pending" | "processed">("pending");
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    activeTab === "pending" ? fetchPendingRequests() : fetchProcessedRequests();
  }, [activeTab]);

  const fetchPendingRequests = async (): Promise<void> => {
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
        "http://192.168.220.49:8000/api/leave-requests/list/",
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const processedData = response.data
        .filter(req => req.status === "approved" || req.status === "rejected")
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setLeaveRequests(processedData);
    } catch (error: any) {
      console.error(error.response?.data || error.message);
      Alert.alert("Error", "Failed to fetch processed leave requests.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (
    id: number,
    newStatus: "approved" | "rejected"
  ): Promise<void> => {
    try {
      const token = await getAccessToken();
      await axios.post(
        `http://192.168.220.49:8000/api/leave-requests/approve/${id}/`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      Alert.alert("Success", `Leave request ${newStatus}!`);
      setLeaveRequests(prev => prev.filter(req => req.id !== id));
    } catch (error: any) {
      console.error(error.response?.data || error.message);
      Alert.alert("Error", `Failed to ${newStatus} leave request.`);
    }
  };

  const getBreakdownMessage = (item: LeaveRequest): string => {
    if (item.leave_type === "paid") {
      return item.total_days > 1
        ? `1 day Paid, ${item.total_days - 1} days Unpaid`
        : "1 day Paid";
    }
    if (item.leave_type === "Half Paid Leave") {
      if (item.total_days === 1) return "1 half-paid leave";
      const unpaid = item.total_days - 1;
      return `1 half-paid leave, ${unpaid} day${unpaid > 1 ? "s" : ""} Unpaid`;
    }
    if (item.leave_type === "sick") {
      return item.total_days > 2
        ? `2 days Sick, ${item.total_days - 2} days Unpaid`
        : `${item.total_days} days Sick`;
    }
    return "";
  };

  const renderRequest: ListRenderItem<LeaveRequest> = ({ item }) => (
    <View style={styles.itemContainer}>
      <Text style={styles.itemText}><Text style={styles.label}>ID:</Text> {item.id}</Text>
      <Text style={styles.itemText}><Text style={styles.label}>Name:</Text> {item.employee_name || "N/A"}</Text>
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
      {getBreakdownMessage(item) !== "" && (
        <Text style={styles.breakdownText}>{getBreakdownMessage(item)}</Text>
      )}
      <View style={styles.statusContainer}>
        <Text style={styles.label}>Status:</Text>
        <Text style={[
          styles.statusText,
          item.status === "approved"
            ? styles.statusApproved
            : item.status === "rejected"
            ? styles.statusRejected
            : {}
        ]}>
          {` ${item.status.toUpperCase()}`}
        </Text>
      </View>
      {item.status === "pending" && (
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[
              styles.actionBtn,
              Platform.OS === 'web' && styles.webActionBtn,
              { backgroundColor: COLORS.approved }
            ]}
            onPress={() => handleUpdateStatus(item.id, "approved")}
          >
            <Text style={styles.buttonText}>Approve</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.actionBtn,
              Platform.OS === 'web' && styles.webActionBtn,
              { backgroundColor: COLORS.rejected }
            ]}
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
      <View style={styles.segmentContainer}>
        <SegmentedControl
          values={["Pending", "Processed"]}
          selectedIndex={activeTab === "pending" ? 0 : 1}
          onChange={(event) => {
            const idx = event.nativeEvent.selectedSegmentIndex;
            setActiveTab(idx === 0 ? "pending" : "processed");
          }}
          appearance="dark"
        />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={leaveRequests}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderRequest}
          contentContainerStyle={{ paddingBottom: 20 }}
          ListEmptyComponent={<Text style={styles.noRequests}>No {activeTab === "pending" ? "pending" : "processed"} requests found.</Text>}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, paddingTop: 20 },
  header: { fontSize: 26, fontWeight: "bold", textAlign: "center", color: COLORS.primary, marginBottom: 12 },
  segmentContainer: { marginHorizontal: 20, marginBottom: 16 },
  itemContainer: { backgroundColor: COLORS.card, marginHorizontal: 16, marginVertical: 8, padding: 16, borderRadius: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 2 },
  itemText: { fontSize: 16, color: COLORS.text, marginBottom: 4 },
  label: { fontWeight: "600" },
  breakdownText: { fontSize: 14, color: COLORS.breakdown, fontStyle: "italic", marginBottom: 6 },
  statusContainer: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  statusText: { fontSize: 16, fontWeight: "600" },
  statusApproved: { color: COLORS.approved },
  statusRejected: { color: COLORS.rejected },
  buttonContainer: { flexDirection: "row", marginTop: 8 ,
    justifyContent: Platform.OS === "web" ? "flex-start" : "space-between",
   },
  actionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    // on web give just a right-margin, on native your old horizontal
    ...(Platform.OS === "web"
      ? { marginRight: 8 }
      : { marginHorizontal: 4 }
    ),
  },
  webActionBtn: { flex: 0, minWidth: 100 }, // compact size on web
  buttonText: { color: "#fff", fontWeight: "600" },
  noRequests: { textAlign: "center", marginTop: 20, color: COLORS.gray, fontSize: 16 },
});

export default LeaveRequestList;
