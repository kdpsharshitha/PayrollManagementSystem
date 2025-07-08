import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Alert,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ViewStyle,
  Dimensions,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import axios from "axios";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { getAccessToken } from "../../auth";
import { useRef } from 'react'; // Adjust path if needed

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
  const [availableHalfPaid, setAvailableHalfPaid] = useState<number>(0);
  const [halfPaidCountThisMonth, setHalfPaidCountThisMonth] = useState<number>(0);


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
  const [halfDayPeriod, setHalfDayPeriod] = useState<"morning" | "afternoon" | "">("");


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
          "http://192.168.220.49:8000/api/leave-requests/myrequest/",
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

        let url = "http://192.168.220.49:8000/api/leave-requests/balance/";
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
          setAvailableHalfPaid(response.data.availableHalfPaid);
          setHalfPaidCountThisMonth(response.data.halfPaidCountThisMonth || 0);
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

  // Utility function to normalize dates by stripping off the time component.
  const normalizeDate = (dateValue: string | number | Date): Date => {
    const d = new Date(dateValue);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  };

  // Check "Sick after Paid"
  if (leaveType === "sick" && startDate) {
    const newStart = normalizeDate(startDate);
    const violates = existingRequests.some((req) => {
      // Only consider approved paid leaves.
      if (req.leave_type !== "paid" || req.status !== "approved") return false;
      const prevEnd = normalizeDate(req.end_date);
      const afterPrevEnd = new Date(prevEnd);
      afterPrevEnd.setDate(prevEnd.getDate() + 1);

      // Logging for debug purposes
      console.log("New sick leave start (local normalized):", newStart.toLocaleDateString());
      console.log(
        "Existing paid leave end date:",
        req.end_date,
        "-> Calculated next day (local normalized):",
        afterPrevEnd.toLocaleDateString()
      );

      return (
        afterPrevEnd.getFullYear() === newStart.getFullYear() &&
        afterPrevEnd.getMonth() === newStart.getMonth() &&
        afterPrevEnd.getDate() === newStart.getDate()
      );
    });

    if (violates) {
      console.log("Immediate consecutive paid leave found. Triggering inline warining");
      warning = "Paid leave cannot be clubbed with sick leave.";
    }
  }

  // Check "Paid before Sick"
  if (!warning && leaveType === "paid" && endDate) {
    const newEnd = normalizeDate(endDate);
    const violates = existingRequests.some((req) => {
      // Only consider approved sick leaves.
      if (req.leave_type !== "sick" || req.status !== "approved") return false;
      const nextStart = normalizeDate(req.start_date);
      const dayAfter = new Date(newEnd);
      dayAfter.setDate(newEnd.getDate() + 1);

      // Logging for debug purposes
      console.log("New paid leave day after end date (local normalized):", dayAfter.toLocaleDateString());
      console.log(
        "Existing sick leave start date:",
        req.start_date,
        "-> Normalized (local):",
        nextStart.toLocaleDateString()
      );

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

// ─── 6) Separate‑sandwich + Paid↔Sick block ─────────────────────────────────
useEffect(() => {
  console.log(
    "useEffect triggered with startDate:",
    startDate,
    ", endDate:",
    endDate,
    ", leaveType:",
    leaveType,
    ", requestedDays:",
    requestedDays
  );

  // Reset any disable flags and warnings.
  setDisablePaidByClubbing(false);
  setDisableSickByClubbing(false);
  setSeparateSandwichConstraint({ active: false, note: "" });
  

  // If either date is missing, exit early.
  if (!startDate || !endDate) {
    console.log("Start or end date missing. Exiting effect.");
    return;
  }

  // Helper: Parse a YYYY-MM-DD string into a normalized local Date (time set to 00:00:00)
  function parseLocalDate(dateStr: string): Date {
    const [year, month, day] = dateStr.split("-").map(Number);
    const d = new Date(year, month - 1, day);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  // Normalize the new start day.
  const newStartDay = parseLocalDate(startDate);
  const msPerDay = 1000 * 60 * 60 * 24;
  console.log("Normalized newStartDay:", newStartDay.toLocaleString());

  // ----------------------
  // PAID-SICK CHECK BLOCK
  // ----------------------
  // We'll try to find the most recent opposite-type leave (only approved records are considered)
  let oppositeEnd: Date | null = null;
  let oppositeStatus: string | null = null;
  if (leaveType === "sick") {
    // For a sick leave request, find the most recent approved paid leave.
    const validPaid = existingRequests.filter(
      (r) => r.leave_type === "paid" && r.status === "approved"
    );
    const paidDates = validPaid
      .map((r) => ({ date: parseLocalDate(r.end_date), status: r.status }))
      .filter((d) => d.date < newStartDay);
    console.log(
      "Filtered paid dates:",
      paidDates.map((d) => d.date.toLocaleString())
    );
    if (paidDates.length > 0) {
      paidDates.sort((a, b) => b.date.getTime() - a.date.getTime());
      oppositeEnd = paidDates[0].date;
      oppositeStatus = paidDates[0].status;
      console.log("Opposite End (from paid leaves):", oppositeEnd.toLocaleString());
    }
  } else if (leaveType === "paid") {
    // For a paid leave request, find the most recent approved sick leave.
    const validSick = existingRequests.filter(
      (r) => r.leave_type === "sick" && r.status === "approved"
    );
    const sickDates = validSick
      .map((r) => ({ date: parseLocalDate(r.end_date), status: r.status }))
      .filter((d) => d.date < newStartDay);
    console.log(
      "Filtered sick dates:",
      sickDates.map((d) => d.date.toLocaleString())
    );
    if (sickDates.length > 0) {
      sickDates.sort((a, b) => b.date.getTime() - a.date.getTime());
      oppositeEnd = sickDates[0].date;
      oppositeStatus = sickDates[0].status;
      console.log("Opposite End (from sick leaves):", oppositeEnd.toLocaleString());
    }
  } else {
    console.log("Leave type is neither sick nor paid; no opposite check needed.");
  }

  if (oppositeEnd) {
    // If the opposite leave found is not approved (or has some other rejected status), skip the warning.
    if (oppositeStatus !== "approved") {
      console.log("Opposite leave is not approved. Skipping paid-sick warning.");
    } else {
      // Compute the gap between oppositeEnd and newStartDay (excluding the oppositeEnd day).
      const rawOppGap = (newStartDay.getTime() - oppositeEnd.getTime()) / msPerDay - 1;
      const oppGapDays = Math.floor(rawOppGap);
      console.log("OppGapDays:", oppGapDays);

      if (oppGapDays > 0) {
        let unpaidCount = 0;
        for (let i = 1; i <= oppGapDays; i++) {
          const cursor = new Date(oppositeEnd);
          cursor.setDate(cursor.getDate() + i);
          cursor.setHours(0, 0, 0, 0);
          // Check if this day is covered by an approved unpaid leave.
          const covered = existingRequests.some((r) => {
            if (r.leave_type === "unpaid" && r.status === "approved") {
              const start = parseLocalDate(r.start_date);
              const end = parseLocalDate(r.end_date);
              return start <= cursor && cursor <= end;
            }
            return false;
          });
          console.log(`Day ${i} (${cursor.toLocaleDateString()}) covered:`, covered);
          if (covered) {
            unpaidCount++;
          }
        }
        console.log("Total unpaidCount:", unpaidCount);
        if (unpaidCount === oppGapDays) {
          console.log("Triggering warning for paid-sick sandwich conflict.");
          setInlineWarning(
            "Paid leave cannot be clubbed with sick leave because all intervening days are approved unpaid."
          );
          setDisablePaidByClubbing(leaveType === "paid");
          setDisableSickByClubbing(leaveType === "sick");
        }
      } else {
        console.log("No gap between opposite leave and new start.");
      }
    }
  } else {
    console.log("No opposite leave found for type:", leaveType);
  }


// ---------------------------------------------------
// EXISTING NON‑WORKING SANDWICH LOGIC (for completeness)
// ---------------------------------------------------
// Gather all prior leaves ending strictly before newStartDay.
const priors = existingRequests
  .map(r => ({
    end: parseLocalDate(r.end_date),
    type: r.leave_type,
    status: r.status // assuming this property
  }))
  .filter(p => p.end < newStartDay);

if (priors.length === 0) {
  return;
}

// Sort with the most recent prior leave first.
priors.sort((a, b) => b.end.getTime() - a.end.getTime());
const { end: prevEnd, type: prevType, status: prevStatus } = priors[0];

// If the previous leave was not approved (e.g. it was rejected), then disable the sandwich note.
if (prevStatus !== "approved") {
  console.log("Previous leave not approved. No sandwich note will be shown.");
  setSeparateSandwichConstraint({ active: false, note: "" });
  return;
}

const rawGap = (newStartDay.getTime() - prevEnd.getTime()) / msPerDay - 1;
const gapDays = Math.floor(rawGap);
if (gapDays <= 0) {
  return;
}

let nonWorkingCount = 0;
for (let i = 1; i <= gapDays; i++) {
  const cursor = new Date(prevEnd);
  cursor.setDate(cursor.getDate() + i);
  cursor.setHours(0, 0, 0, 0);
  if (cursor.getDay() === 0 || cursor.getDay() === 6 || isPublicHoliday(cursor)) {
    nonWorkingCount++;
  }
}

// If all days in the gap are non-working days, then apply the sandwich policy.
if (nonWorkingCount === gapDays) {
  // If mixing of paid and sick leave is attempted.
  if (
    (prevType === "paid" && leaveType === "sick") ||
    (prevType === "sick" && leaveType === "paid")
  ) {
    console.log("Triggering warning for paid-sick clubbing based on non-working days.");
    setInlineWarning("Paid leave cannot be clubbed with sick leave.");
    setDisablePaidByClubbing(prevType === "sick");
    setDisableSickByClubbing(prevType === "paid");
    return;
  }

  // Otherwise, set a sandwich policy note depending on the current leave type.
  let note = "";
  if (leaveType === "paid") {
    if (requestedDays === 1) {
      note = `Due to the Sandwich Policy, ${nonWorkingCount} non-working day${nonWorkingCount > 1 ? "s" : ""} between your previous leave and this request will be treated as Unpaid. Only 1 day of Paid leave will be applied.`;
    } else {
      note = `Due to the Sandwich Policy, ${nonWorkingCount} non-working day${nonWorkingCount > 1 ? "s" : ""} between your previous leave and this request will be treated as Unpaid. Only 1 day of Paid leave will be applied; the remaining ${requestedDays - 1} day${requestedDays - 1 > 1 ? "s" : ""} will be treated as Unpaid.`;
    }
  } else if (leaveType === "sick") {
    if (requestedDays === 1) {
      note = `1 day of Sick leave will be applied.`;
    } else if (requestedDays === 2) {
      note = `2 days of Sick leave will be applied.`;
    } else {
      note = `2 days of Sick leave will be applied; the remaining ${requestedDays - 2} day${requestedDays - 2 > 1 ? "s" : ""} will be treated as Unpaid.`;
    }
  } else if (leaveType === "unpaid") {
    note =
      requestedDays === 1
        ? `Due to the Sandwich Policy, ${nonWorkingCount} non-working day${nonWorkingCount > 1 ? "s" : ""} between your previous leave and this request, and 1 requested day, will be treated as Unpaid.`
        : `Due to the Sandwich Policy, ${nonWorkingCount} non-working day${nonWorkingCount > 1 ? "s" : ""} between your previous leave and this request, and all ${requestedDays} requested days will also be treated as Unpaid.`;
  } else if (leaveType === "Half Paid Leave") {
    if (requestedDays === 1) {
      note = "1 half‑paid leave will be applied.";
    } else {
      const remaining = requestedDays - 1;
      note = `1 half‑paid leave will be applied; remaining ${remaining} day${remaining > 1 ? "s" : ""} will be treated as Unpaid.`;
    }
  } else if (leaveType === "Half UnPaid Leave") {
    if (requestedDays === 1) {
      note = "1 half‑unpaid leave will be applied.";
    } else {
      const remaining = requestedDays - 1;
      note = `1 half‑unpaid leave will be applied; remaining ${remaining} day${remaining > 1 ? "s" : ""} will be treated as Unpaid.`;
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
          noteMessage = `1 day of Sick leave will be applied.`;
        } else if (requestedDays === 2) {
          noteMessage = `2 days of Sick leave will be applied.`;
        } else {
          // subtract the 2 applied sick days and the non-working days
          const remaining = requestedDays - 2;
          noteMessage = `2 days of Sick leave will be applied; remaining ${remaining} day${remaining > 1 ? "s" : ""} will be treated as Unpaid.`;
        }
      } else if (leaveType === "unpaid") {
        if (requestedDays === 1) {
          noteMessage = `1 day will be treated as Unpaid.`;
        } else {
          noteMessage = `Due to Sandwich Policy, all ${requestedDays} days including ${nonWorkingCount} non-working will be treated as Unpaid.`;
        }
      }else if (leaveType === "Half Paid Leave") {
        if (requestedDays === 1) {
          noteMessage = "1 half‑paid leave will be applied.";
        } else {
          const remaining = requestedDays - 1 - nonWorkingCount;
          noteMessage = `1 half‑paid leave will be applied,${nonWorkingCount} non-working day${nonWorkingCount > 1 ? "s" : ""} in this range will be treated as Paid; remaining ${remaining} day${remaining > 1 ? "s" : ""} will be treated as Unpaid.`;
        }
      } else if (leaveType === "Half UnPaid Leave") {
        if (requestedDays === 1) {
          noteMessage = "1 half‑unpaid leave will be applied.";
        } else {
          const remaining = requestedDays - 1 - nonWorkingCount;
          noteMessage = `1 half‑unpaid leave will be applied,${nonWorkingCount} non-working day${nonWorkingCount > 1 ? "s" : ""} in this range will be treated as Paid; remaining ${remaining} day${remaining > 1 ? "s" : ""} will be treated as Unpaid.`;
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
      }else if (leaveType === "Half Paid Leave") {
        if (requestedDays === 1) {
          noteMessage = "1 half‑paid leave will be applied.";
        } else {
          const remaining = requestedDays - 1;
          noteMessage = `1 half‑paid leave will be applied; remaining ${remaining} day${remaining > 1 ? "s" : ""} will be treated as Unpaid.`;
        }
      } else if (leaveType === "Half UnPaid Leave") {
        if (requestedDays === 1) {
          noteMessage = "1 half‑unpaid leave will be applied.";
        } else {
          const remaining = requestedDays - 1;
          noteMessage = `1 half‑unpaid leave will be applied; remaining ${remaining} day${remaining > 1 ? "s" : ""} will be treated as Unpaid.`;
        }
      }else if (leaveType === "sick") {
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
  const disableHalfPaidOption = halfPaidCountThisMonth >= 2;
  const disablePaidOption = (() => {
    if (!startDate) return true;
    if (availablePaid <= 0) return true;
    if (paidLeaveThisMonth) return true;
    if (halfPaidCountThisMonth >= 1) return true;
    return false;
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
        "http://192.168.220.49:8000/api/leave-requests/create/",
        {
          start_date: startDate,
          end_date: endDate,
          leave_type: leaveType,
          description,
          note: combinedNote,
          half_day_period: halfDayPeriod,  
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
        axios.get("http://192.168.220.49:8000/api/leave-requests/balance/", {
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
        axios.get("http://192.168.220.49:8000/api/leave-requests/myrequest/", {
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
  const startInputRef = useRef<HTMLInputElement>(null);
  const endInputRef = useRef<HTMLInputElement>(null);

  // ─── JSX ───────────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <View style={styles.contentWrapper}>
      {/* Leave Balance Summary */}
      <View style={styles.summaryContainer}>
        <Text style={styles.summaryTitle}>Leave Balance Summary</Text>

<View style={styles.summaryItem}>
  <Text style={styles.summaryText}>This Month’s Paid Leave</Text>
  <Text style={styles.summaryValue}>{`${paidLeaveThisMonth ? 1 : 0} of 1 day`}</Text>
</View>

<View style={styles.summaryItem}>
  <Text style={styles.summaryText}>Half‑Day Paid Leave This Month</Text>
  <Text style={styles.summaryValue}>{`${halfPaidCountThisMonth} of 2 days`}</Text>
</View>

<View style={styles.summaryItem}>
  <Text style={styles.summaryText}>Paid Leave Balance</Text>
  <Text style={styles.summaryValue}>{availablePaid}</Text>
</View>

<View style={styles.summaryItem}>
  <Text style={styles.summaryText}>Sick Leave Balance</Text>
  <Text style={styles.summaryValue}>{availableSick}</Text>
</View>
</View>


      
     <View style={styles.formContainer}>
      <Text style={styles.heading}>Leave Request</Text>
{/* ─── Start Date Picker ──────────────────────────────────────────────────── */}
<Text style={styles.label}>Start Date</Text>
<View style={styles.datePickerContainer}>
  {Platform.OS === 'web' ? (
    <>
      <input
        ref={startInputRef}
        type="date"
        value={startDate}
        onChange={e => setStartDate(e.target.value)}
        style={{
          flex: 1,
          height: 40,
          padding: '0 10px',
          borderRadius: 4,
          border: '1px solid #999',
          backgroundColor: '#FFF',
          boxSizing: 'border-box',
        }}
      />
      <button
        onClick={() => startInputRef.current?.showPicker?.() /* some browsers support showPicker() */}
        style={{
          marginLeft: 8,
          padding: 6,
          backgroundColor: '#FFF',
          border: '1px solid #999',
          borderRadius: 4,
          cursor: 'pointer',
        }}
      >
        <Ionicons name="calendar-outline" size={24} color="#22186F" />
      </button>
    </>
  ) : (
    <>
      <Pressable
        style={styles.datePicker}
        onPress={() => setShowStartPicker(true)}
      >
        <Text style={{ color: startDate ? '#000' : '#999' }}>
          {formatDate(startDate)}
        </Text>
      </Pressable>
      <TouchableOpacity
        onPress={() => setShowStartPicker(true)}
        style={styles.calendarIcon}
      >
        <Ionicons name="calendar-outline" size={24} color="#22186F" />
      </TouchableOpacity>
      {showStartPicker && (
        <DateTimePicker
          value={startDate ? new Date(startDate) : new Date()}
          mode="date"
          display="default"
          onChange={(e, d) => {
            setShowStartPicker(false);
            if (e.type === 'set' && d) {
              setStartDate(d.toISOString().slice(0, 10));
            }
          }}
        />
      )}
    </>
  )}
</View>

{/* ─── End Date Picker ────────────────────────────────────────────────────── */}
<Text style={styles.label}>End Date</Text>
<View style={styles.datePickerContainer}>
  {Platform.OS === 'web' ? (
    <>
      <input
        ref={endInputRef}
        type="date"
        value={endDate}
        onChange={e => setEndDate(e.target.value)}
        style={{
          flex: 1,
          height: 40,
          padding: '0 10px',
          borderRadius: 4,
          border: '1px solid #999',
          backgroundColor: '#FFF',
          boxSizing: 'border-box',
        }}
      />
      <button
        onClick={() => endInputRef.current?.showPicker?.()}
        style={{
          marginLeft: 8,
          padding: 6,
          backgroundColor: '#FFF',
          border: '1px solid #999',
          borderRadius: 4,
          cursor: 'pointer',
        }}
      >
        <Ionicons name="calendar-outline" size={24} color="#22186F" />
      </button>
    </>
  ) : (
    <>
      <Pressable
        style={styles.datePicker}
        onPress={() => setShowEndPicker(true)}
      >
        <Text style={{ color: endDate ? '#000' : '#999' }}>
          {formatDate(endDate)}
        </Text>
      </Pressable>
      <TouchableOpacity
        onPress={() => setShowEndPicker(true)}
        style={styles.calendarIcon}
      >
        <Ionicons name="calendar-outline" size={24} color="#22186F" />
      </TouchableOpacity>
      {showEndPicker && (
        <DateTimePicker
          value={endDate ? new Date(endDate) : new Date()}
          mode="date"
          display="default"
          onChange={(e, d) => {
            setShowEndPicker(false);
            if (e.type === 'set' && d) {
              setEndDate(d.toISOString().slice(0, 10));
            }
          }}
        />
      )}
    </>
  )}
</View>

      {/* ─── Leave Type Picker ──────────────────────────────────────────────────── */}
      <Text style={styles.label}>Leave Type</Text>
      <View style={styles.pickerContainer}>
        <Picker selectedValue={leaveType} onValueChange={setLeaveType} style={{height: '100%',}} > 
          <Picker.Item
            label="Paid Leave"
            value="paid"
            enabled={!disablePaidOption && !disablePaidByClubbing}
          />
          <Picker.Item
            label="Half-Paid Leave"
            value="Half Paid Leave"
            enabled={!disableHalfPaidOption && !disablePaidOption}
          />
          <Picker.Item
            label="Sick Leave"
            value="sick"
            enabled={!disableHalfPaidOption && !disableSickByClubbing}
          />
          <Picker.Item label="Unpaid Leave" value="unpaid" enabled={true} />
          <Picker.Item label="Half-Unpaid Leave" value="Half UnPaid Leave" enabled={true} />
        </Picker>
      </View>

{/* ← Insert your half‑day selector here */}
{["Half Paid Leave", "Half UnPaid Leave"].includes(leaveType) && (
  <View style={styles.halfDayContainer}>
    <Text style={styles.label}>Select Half‑Day Period</Text>
    <View style={styles.buttonRow}>
      <TouchableOpacity
        style={[
          styles.halfDayButton,
          halfDayPeriod === "morning" && styles.halfDayButtonSelected,
        ]}
        onPress={() => setHalfDayPeriod("morning")}
      >
        <Text
          style={
            halfDayPeriod === "morning"
              ? styles.halfDayButtonSelectedText
              : styles.halfDayButtonText
          }
        >
          Morning
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.halfDayButton,
          halfDayPeriod === "afternoon" && styles.halfDayButtonSelected,
        ]}
        onPress={() => setHalfDayPeriod("afternoon")}
      >
        <Text
          style={
            halfDayPeriod === "afternoon"
              ? styles.halfDayButtonSelectedText
              : styles.halfDayButtonText
          }
        >
          Afternoon
        </Text>
      </TouchableOpacity>
    </View>
  </View>
)}

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
          disableSickByClubbing ||
          (["Half Paid Leave","Half UnPaid Leave"].includes(leaveType) && !halfDayPeriod)
        }
      >
        <Text style={styles.buttonText}>Submit Request</Text>
      </TouchableOpacity>
      </View>
     </View>
    </View>
  );
};

const windowHeight = Dimensions.get('window').height;
const FORM_MAX_HEIGHT = Math.round(windowHeight * 0.8);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    height: Platform.OS === 'web' ? windowHeight : undefined,
    backgroundColor: '#f2f4f7',        // light neutral background
  },

  // NEW: wrapper that on web lays out children side by side
  contentWrapper: {
  flexDirection: Platform.OS === 'web' ? 'row' : 'column',
  flexWrap: Platform.OS === 'web' ? 'nowrap' : 'wrap',
  width: '100%',
  justifyContent: 'space-between',
  alignItems: Platform.OS === 'web' ? 'flex-start' : 'stretch',
},


  // Summary “card”
  summaryContainer: {
  width: Platform.OS === 'web' ? '40%' : '100%',
  marginRight: Platform.OS === 'web' ? 16 : 0,
  backgroundColor: '#fff',
  padding: 20,
  borderRadius: 12,
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 4,
  elevation: 3,
  // force shrink below content size
  flexShrink: 1,
  minWidth: 0,
},

  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#22186F',
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 14,
    color: '#333',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#22186F',
  },

  // Form “card”
  formContainer: {
  width: Platform.OS === 'web' ? '55%' : '100%',
  maxHeight: Platform.OS === 'web' ? FORM_MAX_HEIGHT : undefined,
  backgroundColor: '#fff',
  padding: 20,
  borderRadius: 12,
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 4,
  elevation: 3,
  flexShrink: 1,
  minWidth: 0,

  // web-only vertical scrolling
  ...(Platform.OS === 'web'
    ? { overflowY: 'auto', WebkitOverflowScrolling: 'touch' }
    : {}),
},

  heading: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
    color: '#22186F',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 12,
    color: '#555',
  },
  datePickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  datePicker: {
    flex: 1,
    height: 40,
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 4,
    backgroundColor: '#FFF',
  },
  calendarIcon: {
    marginLeft: 8,
  },
  pickerContainer: {
    height: 48,              // makes your dropdown taller
    justifyContent: 'center',// vertically center the selected value
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 4,
    marginTop: 4,

    // only needed to clip the <select> on web; has no effect on native
    ...Platform.select({
      web: {
        overflow: 'hidden',
      },
    }),
  },
  input: {
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 4,
    padding: 10,
    marginTop: 12,
    backgroundColor: '#FFF',
  },
  button: {
    marginTop: 20,
    paddingVertical: 12,
    borderRadius: 6,
    backgroundColor: '#22186F',
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#999',
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  warning: {
    color: '#D9534F',
    marginTop: 8,
  },
  note: {
    color: '#5A5A5A',
    fontSize: 12,
    marginTop: 8,
  },
   halfDayContainer: {
    marginVertical: 12,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 8,
  },
  halfDayButton: {
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    backgroundColor: "#fff",
  },
  halfDayButtonSelected: {
    borderColor: "#22186F",
    backgroundColor: "#22186F",
  },
  halfDayButtonText: {
    fontSize: 14,
    color: "#333",
  },
  halfDayButtonSelectedText: {
    fontSize: 14,
    color: "#fff",
    fontWeight: "600",
  },
});

export default LeaveRequestForm;