import React, { useState, useEffect } from "react";
import { View, Text, TextInput, Alert, StyleSheet, TouchableOpacity } from "react-native";
import { Picker } from "@react-native-picker/picker";
import axios from "axios";
import { getAccessToken } from "../../auth"; // Adjust path if needed

const LeaveRequestForm: React.FC = () => {
  // Form state variables
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  // Default leave type is "unpaid"
  const [leaveType, setLeaveType] = useState<string>("unpaid");
  const [description, setDescription] = useState<string>("");

  // Leave balance states (fetched from backend)
  const [availablePaid, setAvailablePaid] = useState<number>(0);
  const [availableSick, setAvailableSick] = useState<number>(0);
  // Flag if a paid leave has been taken in the current month (per backend)
  const [paidLeaveThisMonth, setPaidLeaveThisMonth] = useState<boolean>(false);
  // End date of the last paid leave (returned by API)
  const [lastPaidLeaveEndDate, setLastPaidLeaveEndDate] = useState<string | null>(null);

  // Number of requested days
  const [requestedDays, setRequestedDays] = useState<number>(0);

  useEffect(() => {
    const fetchBalances = async () => {
      try {
        const token = await getAccessToken();
        if (!token) {
          Alert.alert("Session expired", "Please log in again.");
          return;
        }
        const response = await axios.get(
          "http://192.168.1.6:8000/api/leave-requests/balance/",
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (response.data) {
          setAvailablePaid(response.data.availablePaid);
          setAvailableSick(response.data.availableSick);
          setPaidLeaveThisMonth(response.data.paidLeaveThisMonth || false);
          setLastPaidLeaveEndDate(response.data.lastPaidLeaveEndDate || null);
        }
      } catch (error: any) {
        console.error("Error fetching leave balances:", error.response?.data || error.message);
        Alert.alert("Error", "Failed to fetch leave balances.");
      }
    };
    fetchBalances();
  }, []);

  useEffect(() => {
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const diffDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1;
      setRequestedDays(diffDays);
    } else {
      setRequestedDays(0);
    }
  }, [startDate, endDate]);

  // Check if new request starts exactly one day after last paid leave.
  const isContinuousFromPaid = (): boolean => {
    if (!lastPaidLeaveEndDate || !startDate) return false;
    const lastPaid = new Date(lastPaidLeaveEndDate);
    const newStart = new Date(startDate);
    lastPaid.setDate(lastPaid.getDate() + 1);
    return (
      lastPaid.getFullYear() === newStart.getFullYear() &&
      lastPaid.getMonth() === newStart.getMonth() &&
      lastPaid.getDate() === newStart.getDate()
    );
  };

  // If "sick" is selected and the new leave is continuous from paid leave.
  const continuousInvalidCombination = leaveType === "sick" && isContinuousFromPaid();
  const inlineWarning = continuousInvalidCombination
    ? "Paid leave cannot be clubbed with sick leave."
    : "";

  // New additions for splitting note
  const newRequestMonth = startDate ? new Date(startDate).getMonth() + 1 : null;
  const lastPaidMonth = lastPaidLeaveEndDate ? new Date(lastPaidLeaveEndDate).getMonth() + 1 : null;
  const disablePaidOption = (() => {
    if (!startDate) return true;
    if (lastPaidMonth && newRequestMonth === lastPaidMonth) {
      return paidLeaveThisMonth || availablePaid <= 0;
    }
    return availablePaid <= 0;
  })();

  const paidSplittingNote =
    leaveType === "paid" && requestedDays > 1
      ? `Note: For continuous leave requests, 1 day is paid and the remaining ${requestedDays - 1} day(s) are unpaid.`
      : "";

  const sickSplittingNote =
    leaveType === "sick" && availableSick > 0 && requestedDays > availableSick
      ? `Note: Only ${availableSick} day(s) are applied as sick leave; the rest are unpaid.`
      : "";

  const handleSubmit = async () => {
    if (!startDate || !endDate) {
      Alert.alert("Error", "Please enter both start and end dates.");
      return;
    }
    if (continuousInvalidCombination) {
      Alert.alert("Error", inlineWarning);
      return;
    }
    try {
      const token = await getAccessToken();
      if (!token) {
        Alert.alert("Session expired", "Please log in again.");
        return;
      }
      await axios.post(
        "http://192.168.1.6:8000/api/leave-requests/create/",
        {
          start_date: startDate,
          end_date: endDate,
          leave_type: leaveType,
          description,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      Alert.alert("Success", "Leave request submitted!");
      setStartDate("");
      setEndDate("");
      setLeaveType("unpaid");
      setDescription("");
    } catch (error: any) {
      console.error("Error response:", error.response?.data || error.message);
      Alert.alert("Error", "Failed to submit leave request.");
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.summaryContainer}>
        <Text style={styles.summaryTitle}>Leave Balance Summary</Text>
        <Text style={styles.summaryText}>
          Paid Leave This Month: {paidLeaveThisMonth ? "Used" : "Not Used"}
        </Text>
        <Text style={styles.summaryText}>Remaining Paid Leaves: {availablePaid}</Text>
        <Text style={styles.summaryText}>Remaining Sick Leaves: {availableSick}</Text>
      </View>

      <Text style={styles.heading}>Leave Request Form</Text>

      <TextInput
        style={styles.input}
        placeholder="Start Date (YYYY-MM-DD)"
        value={startDate}
        onChangeText={setStartDate}
      />
      <TextInput
        style={styles.input}
        placeholder="End Date (YYYY-MM-DD)"
        value={endDate}
        onChangeText={setEndDate}
      />

      <Text style={styles.label}>Leave Type</Text>
      <View style={styles.pickerContainer}>
        <Picker selectedValue={leaveType} onValueChange={setLeaveType}>
          <Picker.Item
            label={`Paid Leave `}
            value="paid"
            enabled={!disablePaidOption}
          />
          <Picker.Item
            label={`Sick Leave `}
            value="sick"
            enabled={availableSick > 0 && !continuousInvalidCombination}
          />
          <Picker.Item label="Unpaid Leave" value="unpaid" />
        </Picker>
      </View>

      {inlineWarning !== "" && <Text style={styles.warning}>{inlineWarning}</Text>}
      {paidSplittingNote !== "" && <Text style={styles.note}>{paidSplittingNote}</Text>}
      {sickSplittingNote !== "" && <Text style={styles.note}>{sickSplittingNote}</Text>}

      <TextInput
        style={[styles.input, { height: 80 }]}
        placeholder="Description"
        value={description}
        onChangeText={setDescription}
        multiline
      />

      <TouchableOpacity style={styles.button} onPress={handleSubmit}>
        <Text style={styles.buttonText}>Submit Request</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: "#F7F7F7",
    flex: 1,
  },
  summaryContainer: {
    backgroundColor: "#E8F0FE",
    padding: 12,
    borderRadius: 6,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#B3C7F9",
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 6,
    color: "#1A3A78",
  },
  summaryText: {
    fontSize: 16,
    color: "#333",
    marginVertical: 2,
  },
  heading: {
    fontSize: 22,
    marginBottom: 15,
    fontWeight: "bold",
    color: "#22186F",
    textAlign: "center",
  },
  label: {
    marginBottom: 6,
    fontSize: 16,
    fontWeight: "bold",
    color: "#444",
  },
  input: {
    height: 40,
    borderColor: "#999",
    borderWidth: 1,
    marginBottom: 14,
    paddingHorizontal: 10,
    borderRadius: 4,
    backgroundColor: "#FFF",
  },
  pickerContainer: {
    borderColor: "#999",
    borderWidth: 1,
    borderRadius: 4,
    marginBottom: 14,
    overflow: "hidden",
    backgroundColor: "#FFF",
  },
  warning: {
    color: "red",
    fontSize: 14,
    marginBottom: 14,
    fontWeight: "bold",
  },
  note: {
    color: "#555",
    fontSize: 14,
    marginBottom: 14,
    fontStyle: "italic",
  },
  button: {
    backgroundColor: "#2563EB",
    paddingVertical: 12,
    borderRadius: 4,
    alignItems: "center",
    marginTop: 10,
  },
  buttonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "bold",
  },
});

export default LeaveRequestForm;