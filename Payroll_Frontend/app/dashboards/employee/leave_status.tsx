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
import { getAccessToken } from "../../auth"; // Adjust path as necessary

interface LeaveRequest {
  id: number;
  start_date: string;   // "YYYY-MM-DD"
  end_date: string;     // "YYYY-MM-DD"
  leave_type: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;   // ISO string
  half_day_period?: "morning" | "afternoon";
}

// Helper: check if a Date is a public holiday
const isPublicHoliday = (d: Date): boolean => {
  const publicHolidays = [
    { month: 1, day: 1 },
    { month: 1, day: 26 },
    { month: 5, day: 1 },
    { month: 8, day: 15 },
    { month: 10, day: 2 },
    { month: 12, day: 25 },
  ];
  return publicHolidays.some(h => h.month === d.getMonth() + 1 && h.day === d.getDate());
};

// Inclusive day count between two "YYYY-MM-DD" strings
const inclusiveDays = (start: string, end: string): number => {
  const s = new Date(start);
  const e = new Date(end);
  const diffMs = e.getTime() - s.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
};

// Compute the appropriate note for a given request
const computeNoteForRequest = (
  req: LeaveRequest,
  allRequests: LeaveRequest[]
): string => {
  const { start_date, end_date, leave_type } = req;
  const daysCount = inclusiveDays(start_date, end_date);

  // 1) Single-day weekend/holiday
  if (start_date === end_date) {
    const d = new Date(start_date);
    if (d.getDay() === 0 || d.getDay() === 6 || isPublicHoliday(d)) {
      return "Your selected day is a non-working day and will be treated as Unpaid.";
    }
  }

  // 2) Multi-day “range sandwich”
  if (start_date !== end_date) {
    let sandwichDays = 0;
    let cursor = new Date(start_date);
    cursor.setDate(cursor.getDate() + 1);
    const endD = new Date(end_date);

    while (cursor < endD) {
      if (cursor.getDay() === 0 || cursor.getDay() === 6 || isPublicHoliday(cursor)) {
        sandwichDays++;
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    if (sandwichDays > 0) {
      const nonWorkingCount = sandwichDays;
      const workingDays = daysCount - nonWorkingCount;

      if (leave_type === "Half Paid Leave") {
        if (daysCount === 1) {
          return "1 half‑paid leave will be applied.";
        } else {
          const remaining = daysCount - 1;
          return `1 half‑paid leave will be applied; remaining ${remaining} day${remaining > 1 ? "s" : ""} will be treated as Unpaid.`;
        }
      } else if (leave_type === "Half UnPaid Leave") {
        if (daysCount === 1) {
          return "1 half‑unpaid leave will be applied.";
        } else {
          const remaining = daysCount - 1;
          return `1 half‑unpaid leave will be applied; remaining ${remaining} day${remaining > 1 ? "s" : ""} will be treated as Unpaid.`;
        }
      } else if (leave_type === "paid") {
        if (daysCount === 1) {
          return "Due to Sandwich Policy, 1 day of Paid leave will be applied.";
        } else {
          return `Due to Sandwich Policy, ${nonWorkingCount} non-working day${nonWorkingCount > 1 ? "s" : ""} in your range will be treated as Unpaid; only 1 day of Paid leave will be applied, remaining ${workingDays - 1} working day${workingDays - 1 > 1 ? "s" : ""} will be treated as Unpaid.`;
        }
      } else if (leave_type === "sick") {
        if (daysCount === 1) {
          return "Due to Sandwich Policy, 1 day of Sick leave will be applied.";
        } else if (daysCount === 2) {
          return "Due to Sandwich Policy, 2 days of Sick leave will be applied.";
        } else {
          return `Due to Sandwich Policy, ${nonWorkingCount} non-working day${nonWorkingCount > 1 ? "s" : ""} in your range will be treated as Unpaid; only 2 days of Sick leave will be applied, remaining ${workingDays - 2} working day${workingDays - 2 > 1 ? "s" : ""} will be treated as Unpaid.`;
        }
      } else if (leave_type === "unpaid") {
        return daysCount === 1
          ? "1 day will be treated as Unpaid."
          : `Due to Sandwich Policy, ${nonWorkingCount} non-working day${nonWorkingCount > 1 ? "s" : ""} in your range will be treated as Unpaid; all ${daysCount} requested day${daysCount > 1 ? "s" : ""} will be treated as Unpaid.`;
      }
    }
  }

  // 3) Separate sandwich for consecutive single-day requests
  if (start_date === end_date) {
    const prevLeaves = allRequests
      .filter(r => new Date(r.end_date) < new Date(start_date))
      .sort((a, b) =>
        new Date(b.end_date).getTime() - new Date(a.end_date).getTime()
      );

    if (prevLeaves.length > 0) {
      const prevEnd = new Date(prevLeaves[0].end_date);
      const thisStart = new Date(start_date);
      const gapDays = Math.floor(
        (thisStart.getTime() - prevEnd.getTime()) / (1000 * 60 * 60 * 24)
      ) - 1;

      if (gapDays > 0) {
        let nonWorkingCount = 0;
        let cursor = new Date(prevEnd);
        cursor.setDate(cursor.getDate() + 1);

        for (let i = 0; i < gapDays; i++) {
          if (
            cursor.getDay() === 0 ||
            cursor.getDay() === 6 ||
            isPublicHoliday(cursor)
          ) {
            nonWorkingCount++;
          }
          cursor.setDate(cursor.getDate() + 1);
        }

        if (nonWorkingCount === gapDays) {
          if (leave_type === "paid") {
            return `Due to Sandwich Policy, ${nonWorkingCount} non-working day${nonWorkingCount > 1 ? "s" : ""} between your previous leave and this request will be treated as Unpaid; only 1 day of Paid leave will be applied.`;
          } else if (leave_type === "sick") {
            return `Due to Sandwich Policy, ${nonWorkingCount} non-working day${nonWorkingCount > 1 ? "s" : ""} between your previous leave and this request will be treated as Unpaid; only 1 day of Sick leave will be applied.`;
          } else if (leave_type === "unpaid") {
            return `Due to Sandwich Policy, ${nonWorkingCount} non-working day${nonWorkingCount > 1 ? "s" : ""} between your previous leave and this request will be treated as Unpaid; 1 requested day will be treated as Unpaid.`;
          }
        }
      }
    }
  }

  // 4) Default notes if no sandwich applies
  if (leave_type === "Half Paid Leave") {
    if (daysCount === 1) {
      return "1 half‑paid leave will be applied.";
    } else {
      const remaining = daysCount - 1;
      return `1 half‑paid leave will be applied; remaining ${remaining} day${remaining > 1 ? "s" : ""} will be treated as Unpaid.`;
    }
  } else if (leave_type === "Half UnPaid Leave") {
    if (daysCount === 1) {
      return "1 half‑unpaid leave will be applied.";
    } else {
      const remaining = daysCount - 1;
      return `1 half‑unpaid leave will be applied; remaining ${remaining} day${remaining > 1 ? "s" : ""} will be treated as Unpaid.`;
    }
  } else if (leave_type === "paid") {
    const allowedDays = 1;
    const remainingDays = daysCount - allowedDays;

    return daysCount === 1
      ? "1 day of Paid leave will be applied."
      : `Only ${allowedDays} day of Paid leave is available this month; remaining ${remainingDays} day${remainingDays > 1 ? "s" : ""} will be treated as Unpaid.`;
  } else if (leave_type === "sick") {
    const allowedDays = 2;
    const remainingDays = daysCount - allowedDays;

    return daysCount === 1
      ? "1 day of Sick leave will be applied."
      : daysCount === 2
      ? "2 days of Sick leave will be applied."
      : `2 days of Sick leave will be applied; remaining ${remainingDays} day${remainingDays > 1 ? "s" : ""} will be treated as Unpaid.`;
  } else {
    return daysCount === 1
      ? "1 day will be treated as Unpaid."
      : `All ${daysCount} days will be treated as Unpaid.`;
  }
};

// ... rest of EmployeeLeaveStatus component unchanged


const EmployeeLeaveStatus: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"pending" | "processed">("pending");
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (activeTab === "pending") {
      fetchPendingRequests();
    } else {
      fetchProcessedRequests();
    }
  }, [activeTab]);

  const fetchRequests = async (filterFn: (req: LeaveRequest) => boolean) => {
    setLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        Alert.alert("Session expired", "Please log in again.");
        return [];
      }
      const response = await axios.get(
        "http://192.168.220.49:8000/api/leave-requests/myrequest/",
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data: LeaveRequest[] = response.data;
      data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return data.filter(filterFn);
    } catch (error: any) {
      console.error("Error fetching leave requests:", error.response ? error.response.data : error.message);
      Alert.alert("Error", "Unable to fetch leave requests.");
      return [];
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingRequests = async () => {
    const list = await fetchRequests(req => req.status === "pending");
    setLeaveRequests(list);
  };

  const fetchProcessedRequests = async () => {
    const list = await fetchRequests(req => req.status !== "pending");
    setLeaveRequests(list);
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case "approved":
        return "#4CAF50";
      case "rejected":
        return "#F44336";
      default:
        return "#4682B4";
    }
  };

  const renderLeaveRequest = ({ item }: { item: LeaveRequest }) => {
    const noteText = computeNoteForRequest(item, leaveRequests);
    let typeLabel = item.leave_type;
  if (
    (item.leave_type === "Half Paid Leave" ||
     item.leave_type === "Half UnPaid Leave") &&
    item.half_day_period
  ) {
    // capitalize first letter
    const cap = item.half_day_period[0].toUpperCase() + item.half_day_period.slice(1);
    typeLabel += ` [${cap}]`;
  }

    return (
      <View style={styles.itemContainer}>
        <Text style={styles.itemText}>
          <Text style={styles.label}>Request ID:</Text> {item.id}
        </Text>
        <Text style={styles.itemText}>
          <Text style={styles.label}>Dates:</Text> {item.start_date} – {item.end_date}
        </Text>
        <Text style={styles.itemText}>
          <Text style={styles.label}>Type:</Text> {typeLabel.toUpperCase()}
        </Text>
        <Text style={[styles.itemText, { color: getStatusColor(item.status) }]}>
          <Text style={styles.label}>Status:</Text> {item.status.toUpperCase()}
        </Text>
        {noteText ? (
          <Text style={styles.itemNote}>
            <Text style={styles.label}>Note:</Text> {noteText}
          </Text>
        ) : null}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>My Leave Requests</Text>
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === "pending" && styles.activeTabButton]}
          onPress={() => setActiveTab("pending")}
        >
          <Text style={[styles.tabText, activeTab === "pending" && styles.activeTabText]}>
            Pending
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === "processed" && styles.activeTabButton]}
          onPress={() => setActiveTab("processed")}
        >
          <Text style={[styles.tabText, activeTab === "processed" && styles.activeTabText]}>
            Processed
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
              No {activeTab} leave requests found.
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
  itemNote: {
    fontSize: 14,
    marginTop: 4,
    color: "#555",
    fontStyle: "italic",
  },
  label: { fontWeight: "bold" },
  emptyListText: {
    fontSize: 16,
    textAlign: "center",
    color: "gray",
    marginTop: 20,
  },
});

export default EmployeeLeaveStatus;
