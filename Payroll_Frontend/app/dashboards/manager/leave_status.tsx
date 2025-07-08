// app/leave-requests/managerLeaveStatus.tsx

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
import { getAccessToken } from "../../auth"; // Adjust path as necessary

interface LeaveRequest {
  id: number;
  start_date: string;   // "YYYY-MM-DD"
  end_date: string;     // "YYYY-MM-DD"
  leave_type: "paid" | "sick" | "unpaid"| "Half Paid Leave"| "Half UnPaid Leave";
  created_at: string;   // ISO string
  status: "pending" | "approved" | "rejected";
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
  return publicHolidays.some(
    (h) => h.month === d.getMonth() + 1 && h.day === d.getDate()
  );
};

// Inclusive day count between two "YYYY-MM-DD" strings
const inclusiveDays = (start: string, end: string): number => {
  const s = new Date(start);
  const e = new Date(end);
  const diffMs = e.getTime() - s.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
};

// Compute the combined note for a given request, using allRequests sorted descending by created_at
const computeNoteForRequest = (
  req: LeaveRequest,
  allRequests: LeaveRequest[]
): string => {
  const noteParts: string[] = [];
  const { start_date, end_date, leave_type } = req;
  const daysCount = inclusiveDays(start_date, end_date);

  // 1) Single-day weekend/holiday
  if (start_date === end_date) {
    const d = new Date(start_date);
    if (d.getDay() === 0 || d.getDay() === 6 || isPublicHoliday(d)) {
      noteParts.push(
        "Your selected day is a non-working day and will be treated as Unpaid."
      );
      return noteParts.join(" ");
    }
  }

  // 2) Multi-day sandwich policy
  if (start_date !== end_date) {
    let sandwichDays = 0;
    let cursor = new Date(start_date);
    cursor.setDate(cursor.getDate() + 1);
    const endD = new Date(end_date);
    while (cursor < endD) {
      if (
        cursor.getDay() === 0 ||
        cursor.getDay() === 6 ||
        isPublicHoliday(cursor)
      ) {
        sandwichDays++;
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    if (sandwichDays > 0) {
      const nonWorkingCount = sandwichDays;
      if (leave_type === "Half Paid Leave") {
        if (daysCount === 1) {
          return "1 half-paid leave will be applied.";
        } else {
          const remaining = daysCount - 1;
          return `1 half-paid leave will be applied; remaining ${remaining} day${remaining > 1 ? "s" : ""} will be treated as Unpaid.`;
        }
      } else if (leave_type === "Half UnPaid Leave") {
        if (daysCount === 1) {
          return "1 half-unpaid leave will be applied.";
        } else {
          const remaining = daysCount - 1;
          return `1 half-unpaid leave will be applied; remaining ${remaining} day${remaining > 1 ? "s" : ""} will be treated as Unpaid.`;
        }
      } else if (leave_type === "paid") {
        const remaining = daysCount - 1 - nonWorkingCount;
        if (daysCount === 1) {
          noteParts.push(
            "Due to Sandwich Policy, 1 day of Paid leave will be applied."
          );
        } else {
          noteParts.push(
            `Due to Sandwich Policy, ${nonWorkingCount} non-working day${nonWorkingCount > 1 ? "s" : ""} will be treated as Unpaid; only 1 day of Paid leave will be applied; remaining ${remaining} working day${remaining > 1 ? "s" : ""} will be treated as Unpaid.`
          );
        }
      } else if (leave_type === "sick") {
        const remaining = daysCount - 2 - nonWorkingCount;
        if (daysCount === 1) {
          noteParts.push(
            `Due to Sandwich Policy, ${nonWorkingCount} non-working day${nonWorkingCount > 1 ? "s" : ""} will be treated as Unpaid; only 1 days of Sick leave will be applied; remaining ${remaining} working day${remaining > 1 ? "s" : ""} will be treated as Unpaid.`
          );
        } else if (daysCount === 2) {
          noteParts.push(
            `Due to Sandwich Policy, ${nonWorkingCount} non-working day${nonWorkingCount > 1 ? "s" : ""} will be treated as Unpaid; only 2 days of Sick leave will be applied; remaining ${remaining} working day${remaining > 1 ? "s" : ""} will be treated as Unpaid.`
          );
        } else {
          noteParts.push(
            `Due to Sandwich Policy, ${nonWorkingCount} non-working day${nonWorkingCount > 1 ? "s" : ""} will be treated as Unpaid; only 2 days of Sick leave will be applied; remaining ${remaining} working day${remaining > 1 ? "s" : ""} will be treated as Unpaid.`
          );
        }
      } else if (leave_type === "unpaid") {
        const requestedWorkingDays = daysCount - nonWorkingCount;
        if (daysCount === 1) {
          noteParts.push(
            `1 day (non-working: ${nonWorkingCount}) will be treated as Unpaid.`
          );
        } else {
          noteParts.push(
            `Due to Sandwich Policy, ${nonWorkingCount} non-working day${nonWorkingCount > 1 ? "s" : ""} and ${requestedWorkingDays} requested day${requestedWorkingDays > 1 ? "s" : ""} will all be treated as Unpaid.`
          );
        }
      }
      return noteParts.join(" ");
    }


  }

  // 3) Separate sandwich for consecutive single-day requests
  if (start_date === end_date) {
    // 3a) Find any prior leave (single or multi-day) that ended before this start
    const prevLeaves = allRequests
      .filter(r => new Date(r.end_date) < new Date(start_date))
      .sort((a, b) => 
        new Date(b.end_date).getTime() - new Date(a.end_date).getTime()
      );

    if (prevLeaves.length > 0) {
      const prevLeave = prevLeaves[0];
      const prevEnd = new Date(prevLeave.end_date);
      const thisStart = new Date(start_date);

      // days strictly between
      const gapDays = Math.floor(
        (thisStart.getTime() - prevEnd.getTime()) / (1000 * 60 * 60 * 24)
      ) - 1;

      if (gapDays > 0) {
        // count how many of those gap days are weekends/holidays
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

        // only trigger if *all* gap days are non-working
        if (nonWorkingCount === gapDays) {
          let noteMessage = "";
          if (leave_type === "paid") {
            if (daysCount === 1) {
              noteMessage = `Due to the Sandwich Policy, ${nonWorkingCount} non-working day${nonWorkingCount > 1 ? "s" : ""} between your previous leave and this request will be treated as Unpaid. Only 1 day of Paid leave will be applied.`;
            } else {
              noteMessage = `Due to the Sandwich Policy, ${nonWorkingCount} non-working day${nonWorkingCount > 1 ? "s" : ""} between your previous leave and this request will be treated as Unpaid. Only 1 day of Paid leave will be applied; the remaining ${daysCount - 1} day${daysCount - 1 > 1 ? "s" : ""} will be treated as Unpaid.`;
            }
          } else if (leave_type === "sick") {
            if (daysCount === 1) {
              noteMessage = `Due to the Sandwich Policy, ${nonWorkingCount} non-working day${nonWorkingCount > 1 ? "s" : ""} between your previous leave and this request will be treated as Unpaid. Only 1 day of Sick leave will be applied.`;
            } else if (daysCount === 2) {
              noteMessage = `Due to the Sandwich Policy, ${nonWorkingCount} non-working day${nonWorkingCount > 1 ? "s" : ""} between your previous leave and this request will be treated as Unpaid. Only 2 days of Sick leave will be applied.`;
            } else {
              noteMessage = `Due to the Sandwich Policy, ${nonWorkingCount} non-working day${nonWorkingCount > 1 ? "s" : ""} between your previous leave and this request will be treated as Unpaid. Only 2 days of Sick leave will be applied; the remaining ${daysCount - 2} day${daysCount - 2 > 1 ? "s" : ""} will be treated as Unpaid.`;
            }
          } else if (leave_type === "unpaid") {
            // unpaid
            if (daysCount === 1) {
              noteMessage = `Due to the Sandwich Policy, ${nonWorkingCount} non-working day${nonWorkingCount > 1 ? "s" : ""} between your previous leave and this request, and 1 requested day, will be treated as Unpaid.`;
            } else {
              noteMessage = `Due to the Sandwich Policy, ${nonWorkingCount} non-working day${nonWorkingCount > 1 ? "s" : ""} between your previous leave and this request will be treated as Unpaid, and all ${daysCount} requested day${daysCount > 1 ? "s" : ""} will also be treated as Unpaid.`;
            }
          }
          return noteMessage;
        }
      }
    }
  }

  // 4) Default notes if no sandwich applies
  if (leave_type === "paid") {
    const allowed = 1;
    const remaining = daysCount - allowed;
    if (daysCount === 1) {
      noteParts.push("1 day of Paid leave will be applied.");
    } else {
      noteParts.push(
        `Only ${allowed} day of Paid leave is available this month; remaining ${remaining} day${remaining > 1 ? "s" : ""} will be treated as Unpaid.`
      );
    }
  } else if (leave_type === "sick") {
    const allowed = 2;
    const remaining = daysCount - allowed;
    if (daysCount === 1) {
      noteParts.push("1 day of Sick leave will be applied.");
    } else if (daysCount === 2) {
      noteParts.push("2 days of Sick leave will be applied.");
    } else if (daysCount > 2) {
      noteParts.push(
        `2 days of Sick leave will be applied; remaining ${remaining} day${remaining > 1 ? "s" : ""} will be treated as Unpaid.`
      );
    }
  } else if (leave_type === "unpaid") {
    const remaining = daysCount;
    if (daysCount === 1) {
      noteParts.push("1 day will be treated as Unpaid.");
    } else {
      noteParts.push(
        `All ${remaining} days will be treated as Unpaid.`
      );
    }
  }else if (leave_type === "Half Paid Leave") {
    const remaining = daysCount;
    if (daysCount === 1) {
      noteParts.push("1 half‑paid leave will be applied.");
    } else {
      noteParts.push(
        `1 half‑paid leave will be applied; remaining ${remaining} day${remaining > 1 ? "s" : ""} will be treated as Unpaid.`
      );
    }
  }else if (leave_type === "Half UnPaid Leave") {
    const remaining = daysCount;
    if (daysCount === 1) {
      noteParts.push("1 half‑unpaid leave will be applied.");
    } else {
      noteParts.push(
        `1 half‑unpaid leave will be applied; remaining ${remaining} day${remaining > 1 ? "s" : ""} will be treated as Unpaid.`
      );
    }
  }

  return noteParts.join(" ");
};

// Determine status text color
const getStatusColor = (status: string): string => {
  switch (status) {
    case "approved":
      return "#4CAF50"; // Green
    case "rejected":
      return "#F44336"; // Red
    case "pending":
    default:
      return "#4682B4"; // Amber
  }
};

const ManagerLeaveStatus: React.FC = () => {
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

  // Common fetch & sort helper
  const fetchAllAndSort = async (): Promise<LeaveRequest[]> => {
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
      let data: LeaveRequest[] = response.data;
      // Sort by created_at descending (most recent first)
      data.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      return data;
    } catch (error: any) {
      console.error(
        "Error fetching leave requests:",
        error.response ? error.response.data : error.message
      );
      Alert.alert("Error", "Unable to fetch leave requests.");
      return [];
    }
  };

  // Fetch pending leave requests
  const fetchPendingRequests = async () => {
    setLoading(true);
    const all = await fetchAllAndSort();
    const pendingData = all.filter((req) => req.status === "pending");
    setLeaveRequests(pendingData);
    setLoading(false);
  };

  // Fetch processed requests (approved or rejected)
  const fetchProcessedRequests = async () => {
    setLoading(true);
    const all = await fetchAllAndSort();
    const processedData = all.filter(
      (req) => req.status === "approved" || req.status === "rejected"
    );
    setLeaveRequests(processedData);
    setLoading(false);
  };

  // Render a single leave request item
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
          <Text style={styles.label}>Leave Type:</Text> {typeLabel.toUpperCase()}
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
      <Text style={styles.header}>Manager Leave Requests</Text>

      {/* Tab Buttons */}
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

export default ManagerLeaveStatus;
