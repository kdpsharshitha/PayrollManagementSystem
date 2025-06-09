import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Alert,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Pressable,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import axios from "axios";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { getAccessToken } from "../../auth"; // Adjust path if needed

// Helper: format a Date (or date‐string) as "YYYY-MM-DD", or show placeholder if null/empty
const formatDate = (d: string | Date | null): string => {
  if (!d) return "YYYY-MM-DD";
  const dateObj = d instanceof Date ? d : new Date(d);
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, "0");
  const day = String(dateObj.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

interface LeaveRequest {
  id: number;
  start_date: string;
  end_date: string;
  leave_type: string;
  status: string;
  // (other fields omitted)
}

const LeaveRequestForm: React.FC = () => {
  // ─── Form state variables ─────────────────────────────────────────────────
  const [startDate, setStartDate] = useState<string>(""); // stores "YYYY-MM-DD"
  const [endDate, setEndDate] = useState<string>("");     // stores "YYYY-MM-DD"
  const [leaveType, setLeaveType] = useState<string>("unpaid");
  const [description, setDescription] = useState<string>("");

  // ─── DatePicker visibility ──────────────────────────────────────────────────
  const [showStartPicker, setShowStartPicker] = useState<boolean>(false);
  const [showEndPicker, setShowEndPicker] = useState<boolean>(false);

  // ─── Leave balance states (fetched from backend) ─────────────────────────────
  const [availablePaid, setAvailablePaid] = useState<number>(0);
  const [availableSick, setAvailableSick] = useState<number>(0);
  const [paidLeaveThisMonth, setPaidLeaveThisMonth] = useState<boolean>(false);
  const [lastLeaveEndDate, setLastLeaveEndDate] = useState<string | null>(null);

  // ─── Computed values ─────────────────────────────────────────────────────────
  const [requestedDays, setRequestedDays] = useState<number>(0);

  // ─── Constraint states ────────────────────────────────────────────────────────
  const [weekendConstraint, setWeekendConstraint] = useState({ active: false, note: "" });
  const [rangeSandwichConstraint, setRangeSandwichConstraint] = useState({ active: false, note: "" });
  const [separateSandwichConstraint, setSeparateSandwichConstraint] = useState({ active: false, note: "" });

  // ─── UI state ─────────────────────────────────────────────────────────────────
  const [combinedNote, setCombinedNote] = useState<string>("");
  const [backendError, setBackendError] = useState<string>("");
  const [duplicateWarning, setDuplicateWarning] = useState<string>("");
  const [inlineWarning, setInlineWarning] = useState<string>("");

   // ─── Clubbing disables
  const [disablePaidByClubbing, setDisablePaidByClubbing] = useState(false);
  const [disableSickByClubbing, setDisableSickByClubbing] = useState(false);

  // ─── Existing leave requests to detect duplicates ─────────────────────────────
  const [existingRequests, setExistingRequests] = useState<LeaveRequest[]>([]);

  // ─── 0) Fetch user's existing leave requests on mount ─────────────────────────
  useEffect(() => {
    const fetchMyRequests = async () => {
      try {
        const token = await getAccessToken();
        if (!token) {
          Alert.alert("Session expired", "Please log in again.");
          return;
        }
        const response = await axios.get(
          "http://192.168.1.6:8000/api/leave-requests/myrequest/",
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (response.data) {
          setExistingRequests(response.data);
        }
      } catch (error: any) {
        console.error("Error fetching existing leave requests:", error.response?.data || error.message);
      }
    };
    fetchMyRequests();
  }, []);

  // ─── 1) Fetch balances + last leave end date ─────────────────────────────────
  useEffect(() => {
    const fetchBalances = async () => {
      try {
        const token = await getAccessToken();
        if (!token) {
          Alert.alert("Session expired", "Please log in again.");
          return;
        }

        let url = "http://192.168.1.6:8000/api/leave-requests/balance/";
        if (startDate) {
          const d = new Date(startDate);
          const m = d.getMonth() + 1;
          const y = d.getFullYear();
          url += `?month=${m}&year=${y}`;
        }

        const response = await axios.get(url, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.data) {
          setAvailablePaid(response.data.availablePaid);
          setAvailableSick(response.data.availableSick);
          setPaidLeaveThisMonth(response.data.paidLeaveThisMonth || false);
          setLastLeaveEndDate(response.data.lastLeaveEndDate || null);
        }
      } catch (error: any) {
        console.error("Error fetching leave balances:", error.response?.data || error.message);
        Alert.alert("Error", "Failed to fetch leave balances.");
      }
    };

    fetchBalances();
  }, [startDate]);

  // ─── Clear backend or duplicate error if key fields change ───────────────────
  useEffect(() => {
    if (backendError) {
      setBackendError("");
    }
    if (duplicateWarning) {
      setDuplicateWarning("");
    }
  }, [startDate]);

  // ─── 2) Calculate requestedDays ──────────────────────────────────────────────
  useEffect(() => {
    if (startDate && endDate) {
      const s = new Date(startDate);
      const e = new Date(endDate);
      const diff = Math.floor((e.getTime() - s.getTime()) / (1000 * 3600 * 24)) + 1;
      setRequestedDays(diff);
    } else {
      setRequestedDays(0);
    }
  }, [startDate, endDate]);

  // ─── 3) Inline warning: prevent paid + sick adjacency (both directions) ─────
  useEffect(() => {
    let warning = "";

    // Check "Sick after Paid"
    if (leaveType === "sick" && startDate) {
      const newStart = new Date(startDate);
      const violates = existingRequests.some((req) => {
        if (req.leave_type !== "paid") return false;
        const prevEnd = new Date(req.end_date);
        prevEnd.setDate(prevEnd.getDate() + 1);
        return (
          prevEnd.getFullYear() === newStart.getFullYear() &&
          prevEnd.getMonth() === newStart.getMonth() &&
          prevEnd.getDate() === newStart.getDate()
        );
      });
      if (violates) {
        warning = "Paid leave cannot be clubbed with sick leave.";
      }
    }

    // Check "Paid before Sick"
    if (!warning && leaveType === "paid" && endDate) {
      const newEnd = new Date(endDate);
      const violates = existingRequests.some((req) => {
        if (req.leave_type !== "sick") return false;
        const nextStart = new Date(req.start_date);
        const dayAfter = new Date(newEnd);
        dayAfter.setDate(dayAfter.getDate() + 1);
        return (
          dayAfter.getFullYear() === nextStart.getFullYear() &&
          dayAfter.getMonth() === nextStart.getMonth() &&
          dayAfter.getDate() === nextStart.getDate()
        );
      });
      if (violates) {
        warning = "Paid leave cannot be clubbed with sick leave.";
      }
    }

    setInlineWarning(warning);
  }, [startDate, endDate, leaveType, existingRequests]);

  // ─── 4) Single‐day weekend/holiday check ─────────────────────────────────────
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

  useEffect(() => {
    if (startDate && endDate && startDate === endDate) {
      const d = new Date(startDate);
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      const holiday = isPublicHoliday(d);
      if (isWeekend || holiday) {
        setWeekendConstraint({
          active: true,
          note: "Your selected day is a non-working day and will be treated as Unpaid.",
        });
      } else {
        setWeekendConstraint({ active: false, note: "" });
      }
    } else {
      setWeekendConstraint({ active: false, note: "" });
    }
  }, [startDate, endDate]);

  // ─── 5) Multi‐day “range sandwich” check ─────────────────────────────────────
  useEffect(() => {
    if (startDate && endDate && startDate !== endDate) {
      const s = new Date(startDate);
      const e = new Date(endDate);
      let sandwichDays = 0;
      let cursor = new Date(s);
      cursor.setDate(cursor.getDate() + 1);

      while (cursor < e) {
        if (cursor.getDay() === 0 || cursor.getDay() === 6 || isPublicHoliday(cursor)) {
          sandwichDays++;
        }
        cursor.setDate(cursor.getDate() + 1);
      }

      if (sandwichDays > 0) {
        setRangeSandwichConstraint({
          active: true,
          note: "In your multi-day request, non-working days (weekends/public holidays) will be treated as Unpaid.",
        });
      } else {
        setRangeSandwichConstraint({ active: false, note: "" });
      }
    } else {
      setRangeSandwichConstraint({ active: false, note: "" });
    }
  }, [startDate, endDate]);

// ─── 6) Separate-sandwich + Paid↔Sick block ─────────────────────────────────
useEffect(() => {
  
  setDisablePaidByClubbing(false);
  setDisableSickByClubbing(false);

  if (!startDate || !endDate) {
    setSeparateSandwichConstraint({ active: false, note: "" });
    return;
  }
  const newStart = new Date(startDate);

  // 1) map into typed array and keep only ones strictly before newStart
  type Prior = { end: Date; type: "paid" | "sick" | "unpaid" };
  const priors: Prior[] = existingRequests
    .map(r => ({ end: new Date(r.end_date), type: r.leave_type as any }))
    .filter(l => l.end < newStart);

  if (priors.length === 0) {
    setSeparateSandwichConstraint({ active: false, note: "" });
    setDisablePaidByClubbing(false);
    setDisableSickByClubbing(false);
    return;
  }

  // 2) pull off the most recent
  priors.sort((a, b) => b.end.getTime() - a.end.getTime());
  const { end: prevEnd, type: prevType } = priors[0];

  

  // 3) compute the exclusive‐gap in days
  const msPerDay = 1000 * 60 * 60 * 24;
  const gapDays = Math.floor((newStart.getTime() - prevEnd.getTime()) / msPerDay) - 1;
  if (gapDays <= 0) {
    setSeparateSandwichConstraint({ active: false, note: "" });
    return;
  }

  // 4) count how many of those gapDays are non-working
  let nonWorkingCount = 0;
  for (let i = 1; i <= gapDays; i++) {
    const cursor = new Date(prevEnd);
    cursor.setDate(cursor.getDate() + i);
    if (
      cursor.getDay() === 0 ||
      cursor.getDay() === 6 ||
      isPublicHoliday(cursor)
    ) {
      nonWorkingCount++;
    }
  }

  // 5) if *all* the gapDays are non-working, apply rules
  if (nonWorkingCount === gapDays) {
    // a) block paid↔sick
    if (
      (prevType === "paid" && leaveType === "sick") ||
      (prevType === "sick" && leaveType === "paid")
    ) {
      setInlineWarning("Paid leave cannot be clubbed with sick leave.");
      // if prev was sick, disable Paid; if prev was paid, disable Sick
      setDisablePaidByClubbing(prevType === "sick");
      setDisableSickByClubbing(prevType === "paid");
      setSeparateSandwichConstraint({ active: false, note: "" });
      return;
    }

    // b) otherwise emit the dynamic note
    let note = "";
    if (leaveType === "paid") {
      if (requestedDays === 1) {
        note = `Due to the Sandwich Policy, ${nonWorkingCount} non-working day${nonWorkingCount > 1 ? "s" : ""} between your previous leave and this request will be treated as Unpaid. Only 1 day of Paid leave will be applied.`;
      } else {
        note = `Due to the Sandwich Policy, ${nonWorkingCount} non-working day${nonWorkingCount > 1 ? "s" : ""} between your previous leave and this request will be treated as Unpaid. Only 1 day of Paid leave will be applied; the remaining ${requestedDays - 1} day${requestedDays - 1 > 1 ? "s" : ""} will be treated as Unpaid.`;
      }
    } else if (leaveType === "sick") {
      if (requestedDays === 1) {
        note = `Due to the Sandwich Policy, ${nonWorkingCount} non-working day${nonWorkingCount > 1 ? "s" : ""} between your previous leave and this request will be treated as Unpaid. Only 1 day of Sick leave will be applied.`;
      } else if (requestedDays === 2) {
        note = `Due to the Sandwich Policy, ${nonWorkingCount} non-working day${nonWorkingCount > 1 ? "s" : ""} between your previous leave and this request will be treated as Unpaid. Only 2 days of Sick leave will be applied.`;
      } else {
        note = `Due to the Sandwich Policy, ${nonWorkingCount} non-working day${nonWorkingCount > 1 ? "s" : ""} between your previous leave and this request will be treated as Unpaid. Only 2 days of Sick leave will be applied; the remaining ${requestedDays - 2} day${requestedDays - 2 > 1 ? "s" : ""} will be treated as Unpaid.`;
      }
    } else {
      // unpaid
      if (requestedDays === 1) {
        note = `Due to the Sandwich Policy, ${nonWorkingCount} non-working day${nonWorkingCount > 1 ? "s" : ""} between your previous leave and this request, and 1 requested day, will be treated as Unpaid.`;
      } else {
        note = `Due to the Sandwich Policy,${nonWorkingCount} non-working day${nonWorkingCount > 1 ? "s" : ""} between your previous leave and this request, and all ${requestedDays} requested day${requestedDays > 1 ? "s" : ""} will also be treated as Unpaid.`;
      }
    }
    setSeparateSandwichConstraint({ active: true, note });
  } else {
    setSeparateSandwichConstraint({ active: false, note: "" });
  }
}, [startDate, endDate, existingRequests, leaveType, requestedDays]);



  // ─── 7) Check for duplicate request BEFORE submit ─────────────────────────────
  useEffect(() => {
    if (startDate && endDate) {
      const duplicate = existingRequests.some((req) => (
        req.start_date === startDate && req.end_date === endDate
      ));
      if (duplicate) {
        setDuplicateWarning("You have already submitted a leave request for these exact dates.");
      } else {
        setDuplicateWarning("");
      }
    } else {
      setDuplicateWarning("");
    }
  }, [startDate, endDate, existingRequests]);

   // ─── 8) Build combinedNote ──────────────────────────────────────────────────
  useEffect(() => {
    // If separateSandwichConstraint is active, show that dynamic message
    if (separateSandwichConstraint.active) {
      setCombinedNote(separateSandwichConstraint.note);
      return;
    }

    // Otherwise, fallback to weekend/range logic
    const sandwichActive = weekendConstraint.active || rangeSandwichConstraint.active;
    let noteMessage = "";

    // compute how many non-working days (weekends/public holidays) in the requested range
    let nonWorkingCount = 0;
    {
      const msPerDay = 1000 * 60 * 60 * 24;
      const start = new Date(startDate);
      const end = new Date(endDate);
      for (let t = start.getTime(); t <= end.getTime(); t += msPerDay) {
        const cursor = new Date(t);
        if (
          cursor.getDay() === 0 ||
          cursor.getDay() === 6 ||
          isPublicHoliday(cursor)
        ) {
          nonWorkingCount++;
        }
      }
    }

    if (sandwichActive) {
      if (leaveType === "paid") {
        if (requestedDays === 1) {
          noteMessage = `Due to Sandwich Policy, ${nonWorkingCount} non-working day${nonWorkingCount > 1 ? "s" : ""} in this range will be treated as Unpaid. Only 1 day of Paid leave will be applied.`;
        } else {
          // subtract the 1 applied paid day and the non-working days
          const remaining = requestedDays - 1 - nonWorkingCount;
          noteMessage = `Due to Sandwich Policy, ${nonWorkingCount} non-working day${nonWorkingCount > 1 ? "s" : ""} in this range will be treated as Unpaid. Only 1 day of Paid leave will be applied; remaining ${remaining} working day${remaining > 1 ? "s" : ""} will be treated as Unpaid.`;
        }
      } else if (leaveType === "sick") {
        if (requestedDays === 1) {
          noteMessage = `Due to Sandwich Policy, ${nonWorkingCount} non-working day${nonWorkingCount > 1 ? "s" : ""} in this range will be treated as Unpaid. Only 1 day of Sick leave will be applied.`;
        } else if (requestedDays === 2) {
          noteMessage = `Due to Sandwich Policy, ${nonWorkingCount} non-working day${nonWorkingCount > 1 ? "s" : ""} in this range will be treated as Unpaid. Only 2 days of Sick leave will be applied.`;
        } else {
          // subtract the 2 applied sick days and the non-working days
          const remaining = requestedDays - 2 - nonWorkingCount;
          noteMessage = `Due to Sandwich Policy, ${nonWorkingCount} non-working day${nonWorkingCount > 1 ? "s" : ""} in this range will be treated as Unpaid. Only 2 days of Sick leave will be applied; remaining ${remaining} working day${remaining > 1 ? "s" : ""} will be treated as Unpaid.`;
        }
      } else if (leaveType === "unpaid") {
        if (requestedDays === 1) {
          noteMessage = `1 day will be treated as Unpaid.`;
        } else {
          noteMessage = `Due to Sandwich Policy, all ${requestedDays} days (including ${nonWorkingCount} non-working) will be treated as Unpaid.`;
        }
      }
    } else {
      // non-sandwich fallback logic (weekend/range)
      if (leaveType === "paid") {
        if (requestedDays === 1) {
          noteMessage = "1 day of Paid leave will be applied.";
        } else {
          const remaining = requestedDays - 1;
          noteMessage = `Only 1 day of Paid leave is available this month; remaining ${remaining} day${remaining > 1 ? "s" : ""} will be treated as Unpaid.`;
        }
      } else if (leaveType === "sick") {
        if (requestedDays === 1) {
          noteMessage = "1 day of Sick leave will be applied.";
        } else if (requestedDays === 2) {
          noteMessage = "2 days of Sick leave will be applied.";
        } else {
          const remaining = requestedDays - 2;
          noteMessage = `2 days of Sick leave will be applied; remaining ${remaining} day${remaining > 1 ? "s" : ""} will be treated as Unpaid.`;
        }
      } else if (leaveType === "unpaid") {
        if (requestedDays === 1) {
          noteMessage = "1 day will be treated as Unpaid.";
        } else {
          noteMessage = `All ${requestedDays} days will be treated as Unpaid.`;
        }
      }
    }

    setCombinedNote(noteMessage);
  }, [
    leaveType,
    requestedDays,
    startDate,
    endDate,
    weekendConstraint,
    rangeSandwichConstraint,
    separateSandwichConstraint,
  ]);


  // ─── 9) Disable “Paid Leave” if not eligible ─────────────────────────────────
  const disablePaidOption = (() => {
    if (!startDate) return true;
    if (availablePaid <= 0) return true;
    return paidLeaveThisMonth;
  })();

  // ─── 10) Form submission ──────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!startDate || !endDate) {
      Alert.alert("Error", "Please enter both start and end dates.");
      return;
    }
    if (inlineWarning) {
      Alert.alert("Error", inlineWarning);
      return;
    }
    if (duplicateWarning) {
      Alert.alert("Error", duplicateWarning);
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
          note: combinedNote, 
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      Alert.alert("Success", "Leave request submitted!");

      // Reset form:
      setStartDate("");
      setEndDate("");
      setLeaveType("unpaid");
      setDescription("");
      setBackendError("");
      setDuplicateWarning("");
      setInlineWarning("");

      // Re-fetch balances & requests:
      const refreshedBalance = await getAccessToken().then((t) =>
        axios.get("http://192.168.1.6:8000/api/leave-requests/balance/", {
          headers: { Authorization: `Bearer ${t}` },
        })
      );
      if (refreshedBalance?.data) {
        setAvailablePaid(refreshedBalance.data.availablePaid);
        setAvailableSick(refreshedBalance.data.availableSick);
        setPaidLeaveThisMonth(refreshedBalance.data.paidLeaveThisMonth || false);
        setLastLeaveEndDate(refreshedBalance.data.lastLeaveEndDate || null);
      }

      const refreshedRequests = await getAccessToken().then((t) =>
        axios.get("http://192.168.1.6:8000/api/leave-requests/myrequest/", {
          headers: { Authorization: `Bearer ${t}` },
        })
      );
      if (refreshedRequests?.data) {
        setExistingRequests(refreshedRequests.data);
      }
    } catch (error: any) {
      const errorMsg =
        error.response?.data?.leave_type?.[0] ||
        error.response?.data?.error ||
        error.message;
      setBackendError(errorMsg);
      Alert.alert("Error", errorMsg);
      console.error("Error response:", errorMsg);
    }
  };

  // ─── JSX ───────────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Leave Balance Summary */}
      <View style={styles.summaryContainer}>
        <Text style={styles.summaryTitle}>Leave Balance Summary</Text>
        <Text style={styles.summaryText}>
          Paid Leave Selected Month: {paidLeaveThisMonth ? "Used" : "Not Used"}
        </Text>
        <Text style={styles.summaryText}>Remaining Paid Leaves: {availablePaid}</Text>
        <Text style={styles.summaryText}>Remaining Sick Leaves: {availableSick}</Text>
      </View>

      <Text style={styles.heading}>Leave Request Form</Text>

      {/* ─── Start Date Picker ──────────────────────────────────────────────────── */}
      <Text style={styles.label}>Start Date</Text>
      <View style={styles.datePickerContainer}>
        <Pressable
          style={styles.datePicker}
          onPress={() => setShowStartPicker(true)}
        >
          <Text style={{ color: startDate ? "#000" : "#999" }}>
            {formatDate(startDate)}
          </Text>
        </Pressable>
        <TouchableOpacity
          onPress={() => setShowStartPicker(true)}
          style={styles.calendarIcon}
        >
          <Ionicons name="calendar-outline" size={28} color="#22186F" />
        </TouchableOpacity>
        {showStartPicker && (
          <DateTimePicker
            value={startDate ? new Date(startDate) : new Date()}
            mode="date"
            display="default"
            onChange={(event, selectedDate) => {
              setShowStartPicker(false);
              if (event.type === "set" && selectedDate) {
                const iso = selectedDate.toISOString().split("T")[0];
                setStartDate(iso);
              }
            }}
          />
        )}
      </View>

      {/* ─── End Date Picker ────────────────────────────────────────────────────── */}
      <Text style={styles.label}>End Date</Text>
      <View style={styles.datePickerContainer}>
        <Pressable
          style={styles.datePicker}
          onPress={() => setShowEndPicker(true)}
        >
          <Text style={{ color: endDate ? "#000" : "#999" }}>
            {formatDate(endDate)}
          </Text>
        </Pressable>
        <TouchableOpacity
          onPress={() => setShowEndPicker(true)}
          style={styles.calendarIcon}
        >
          <Ionicons name="calendar-outline" size={28} color="#22186F" />
        </TouchableOpacity>
        {showEndPicker && (
          <DateTimePicker
            value={endDate ? new Date(endDate) : new Date()}
            mode="date"
            display="default"
            onChange={(event, selectedDate) => {
              setShowEndPicker(false);
              if (event.type === "set" && selectedDate) {
                const iso = selectedDate.toISOString().split("T")[0];
                setEndDate(iso);
              }
            }}
          />
        )}
      </View>

      {/* ─── Leave Type Picker ──────────────────────────────────────────────────── */}
      <Text style={styles.label}>Leave Type</Text>
      <View style={styles.pickerContainer}>
        <Picker selectedValue={leaveType} onValueChange={setLeaveType}>
          <Picker.Item
            label="Paid Leave"
            value="paid"
            enabled={!disablePaidOption && !disablePaidByClubbing}
          />
          <Picker.Item
            label="Sick Leave"
            value="sick"
            enabled={availableSick > 0 && !disableSickByClubbing/* && not blocked by other constraints */}
          />
          <Picker.Item label="Unpaid Leave" value="unpaid" enabled={true} />
        </Picker>
      </View>
      {/* Show only one of inline or duplicate warning, prioritize inline */}
      {(inlineWarning !== "" || duplicateWarning !== "") ? (
        <Text style={styles.warning}>
          {inlineWarning !== "" ? inlineWarning : duplicateWarning}
        </Text>
      ) : (
        <>
          {/* Sandwich leave constraint note shown in normal color */}
          {separateSandwichConstraint.active && (
            <Text style={styles.note}>{separateSandwichConstraint.note}</Text>
          )}

          {/* Combined note (weekend, etc.) only shown if sandwich constraint is not active */}
          {!separateSandwichConstraint.active && combinedNote !== "" && (
            <Text style={styles.note}>{combinedNote}</Text>
          )}
        </>
      )}

      {/* Inline error from backend */}
      {backendError !== "" && <Text style={styles.warning}>{backendError}</Text>}


      {/* ─── Description ─────────────────────────────────────────────────────────── */}
      <TextInput
        style={[styles.input, { height: 80 }]}
        placeholder="Description"
        value={description}
        onChangeText={setDescription}
        multiline
      />

      {/* ─── Submit Button ───────────────────────────────────────────────────────── */}
            <TouchableOpacity
        style={[
          styles.button,
          (duplicateWarning !== "" ||
           inlineWarning !== "" ||
           disablePaidByClubbing ||
           disableSickByClubbing)  ? styles.buttonDisabled: null,
        ]}
        onPress={handleSubmit}
        disabled={
          duplicateWarning !== "" ||
          inlineWarning !== "" ||
          disablePaidByClubbing ||
          disableSickByClubbing
        }
      >
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
  datePickerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  datePicker: {
    flex: 1,
    height: 40,
    borderColor: "#999",
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 10,
    justifyContent: "center",
    backgroundColor: "#FFF",
  },
  calendarIcon: {
    marginLeft: 8,
    padding: 6,
    backgroundColor: "#FFF",
    borderColor: "#999",
    borderWidth: 1,
    borderRadius: 4,
  },
  pickerContainer: {
    borderColor: "#999",
    borderWidth: 1,
    borderRadius: 4,
    marginBottom: 14,
    overflow: "hidden",
    backgroundColor: "#FFF",
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
  buttonDisabled: {
    backgroundColor: "#A0AEC0", // lighter/gray to indicate disabled
  },
});

export default LeaveRequestForm;

