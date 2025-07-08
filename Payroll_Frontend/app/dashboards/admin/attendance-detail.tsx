import React, { useState, useEffect, useCallback, ReactNode} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TextInput,
  Platform,
  Dimensions,
} from 'react-native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { useRouter } from 'expo-router';
import { AntDesign, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  fetchTodayAttendance1,
  markEntry1,
  markExit1,
  updateLeaveStatus,
  fetchLeaveSummary,
  fetchAttendanceByDate
  
} from '../../api/attendance';
import { Attendance, AttendanceSummary, LeaveSummary} from '../../types/attendance';
import * as Location from 'expo-location';
import { Alert } from 'react-native';


const LEAVE_STATUSES = [
  'Paid Leave',
  'Half Paid Leave',
  'UnPaid Leave',
  'Half UnPaid Leave',
  'Sick Leave',
  'Holiday',
];

export default function AdminAttendanceDetail() {
  const router = useRouter();
  const [name, setName] = useState<string>('Admin');
  const [email, setEmail] = useState<string>('');
  const [record, setRecord] = useState<Attendance | null>(null);
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(new Date());
  const defaultTime = new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
  const [timeText, setTimeText] = useState<string>(defaultTime);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [disableSick, setDisableSick] = useState<boolean>(false);
  const [note, setNote] = useState<string>('');
  const [checkingPrev, setCheckingPrev] = useState(false);
// existing: disableSick, note, date, selectedStatus…

  const [leaveSummary, setLeaveSummary] = useState<{
    remaining_paid_leaves: number;
    remaining_sick_leaves: number;
    month_paid_leaves: number;
    month_half_paid_leaves: number;
    
    
  } | null>(null);

  // inside your component, just above the JSX:
const MONTHLY_PAID_LIMIT = 1       // e.g. you get 2 paid leaves per month
const MONTHLY_HALF_PAID_LIMIT = 2  // e.g. you get 4 half-paid leaves
// you’ve used up ALL your paid leaves once rec.month_paid_leaves >= LIMIT
const noMoreMonthlyPaid = leaveSummary 
  ? leaveSummary.month_paid_leaves >= MONTHLY_PAID_LIMIT 
  : false

// same for half-paid
const noMoreMonthlyHalf = leaveSummary 
  ? leaveSummary.month_half_paid_leaves >= MONTHLY_HALF_PAID_LIMIT 
  : false

// you’ve literally gone below zero on your balance
const overdrawnPaid = leaveSummary 
  ? leaveSummary.remaining_paid_leaves < 0 
  : false

// sick-leave overdrawn
const overdrawnSick = leaveSummary 
  ? leaveSummary.remaining_sick_leaves < 1 
  : false

  const loadLeaveData = useCallback(async () => {
    try {
      const month = date.getMonth() + 1;
      const year = date.getFullYear();
      const leaveData = await fetchLeaveSummary(month, year);
      setLeaveSummary(leaveData);
    } catch (err) {
      console.error(err);
    }
  }, [date]);

  const loadAttendance = useCallback(async () => {
    setLoading(true);
    try {
      const [storedName, storedEmail] = await Promise.all([
        AsyncStorage.getItem('currentUserName'),
        AsyncStorage.getItem('currentUserEmail'),
      ]);
      if (storedName) setName(storedName);
      if (storedEmail) setEmail(storedEmail);

      const rec = await fetchTodayAttendance1();
      setRecord(rec);
      if (rec?.date) setDate(new Date(rec.date));
      if (rec?.entry_time) {
        const [h, m] = rec.entry_time.split(':');
        setTimeText(`${h.padStart(2, '0')}:${m.padStart(2, '0')}`);
      } else {
        setTimeText(defaultTime);
      }
      if (rec?.status) setSelectedStatus(rec.status);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [defaultTime]);



useEffect(() => {
  console.log('[useEffect] current date:', date)
  const prev = new Date(date)                // works only if date = "YYYY-MM-DD"
  prev.setDate(prev.getDate() - 1)
  const prevDs = prev.toISOString().slice(0,10)
  console.log('[useEffect] fetching for prev day:', prevDs)

  setCheckingPrev(true)
  fetchAttendanceByDate(prevDs)
    .then(rec => {
      console.log('[PrevRec]', rec)
      const paid = ['Paid Leave','Half Paid Leave']
      if (paid.includes(rec.status)) {
        setDisableSick(true)
        setNote('Paid leave cannot be clubbed with sick leave')

        // if the user already selected Sick Leave, clear it
        if (selectedStatus === 'Sick Leave') {
          setSelectedStatus('')
        }
      } else {
        setDisableSick(false)
        setNote('')
      }
    })
    .catch(err => {
      console.warn('[PrevRec] no record or error', err)
      setDisableSick(false)
      setNote('')
    })
    .finally(() => setCheckingPrev(false))

  console.log({
  date,                // the date you picked
  disableSick,         // should flip true/false
  selectedStatus,      // what’s currently in the picker
              // the array feeding your Picker
})

}, [date])

  useEffect(() => { loadAttendance(); }, [loadAttendance]);
  useEffect(() => { loadLeaveData(); }, [loadLeaveData]);

  // unified get-coords helper
async function getCoordsWithTimeout(
  timeoutMs: number
): Promise<{ latitude: number; longitude: number }> {
  if (Platform.OS === 'web') {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        return reject(new Error('Geolocation not supported'));
      }

      const onSuccess = (pos: GeolocationPosition) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });

      const onError = (err: GeolocationPositionError) =>
        reject(new Error(err.message));

      navigator.geolocation.getCurrentPosition(onSuccess, onError, {
        enableHighAccuracy: true,
        timeout: timeoutMs,
        maximumAge: 0,
      });
    });
  } else {
    // native path via Expo-Location
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Location permission denied');
    }

    const loc = await Promise.race([
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
      }),
      new Promise<Location.LocationObject>((_, rej) =>
        setTimeout(
          () => rej(new Error('Location timeout')),
          timeoutMs
        )
      ),
    ]);

    return {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
    };
  }
}

  const formatDateDisplay = (d: Date) =>
    d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

  const handleMark = async (type: 'entry' | 'exit') => {
  setLoading(true);
  try {
    // 3. call API with lat/lng
    const { latitude, longitude } = await getCoordsWithTimeout(20_000);
    const dateStr = date.toISOString().split('T')[0];
    const updated =
      type === 'entry'
        ? await markEntry1(dateStr, timeText, latitude, longitude)
        : await markExit1(dateStr, timeText, latitude, longitude);

    setRecord(updated);
  } catch (err) {
    console.error(err);
  } finally {
    setLoading(false);
  }
};

  const handleUpdateStatus = async () => {
    setLoading(true);
    try {
      const dateStr = date.toISOString().split('T')[0];
      const updated = await updateLeaveStatus(dateStr, selectedStatus);
      setRecord(updated);
      loadLeaveData();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <ActivityIndicator style={{ flex: 1 }} size="large" color="#007AFF" />;
  }

  const status = record
    ? record.exit_time ? 'exit' : record.entry_time ? 'entry' : 'none'
    : 'none';
  const statusColor = status === 'entry' ? '#34C759' : status === 'exit' ? '#FF3B30' : '#007AFF';

  interface CardProps {
  children: ReactNode;
}

const Card = ({ children }: CardProps) => {
  return <View style={styles.card}>{children}</View>;
};

// final “what options to show” array
const statuses = LEAVE_STATUSES.filter(opt => {
  // 1) never show “Sick Leave” when yesterday was Paid
  if (opt === 'Sick Leave' && disableSick) return false

  // 2) block paid‐type leaves when you’ve used up your monthly quota
  if (opt === 'Paid Leave' && (noMoreMonthlyPaid || overdrawnPaid))   return false
  if (opt === 'Half Paid Leave' && (noMoreMonthlyPaid ||noMoreMonthlyHalf || overdrawnPaid)) return false

  // 3) if you’ve overdrawn sick leaves, also strip out Sick Leave
  if (opt === 'Sick Leave' && overdrawnSick) return false

  return true
})


  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.grid}>
          {/* Profile & Status */}
          <View style={[styles.card, { borderLeftColor: statusColor }]}>  
            <View style={styles.headerText}>
              <Text style={styles.title}>{name}</Text>
              <Text style={styles.subtitle}>{email}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: statusColor }]}>  
              <Text style={styles.badgeText}>
                {status === 'entry' ? 'Checked In' : status === 'exit' ? 'Checked Out' : 'No Status'}
              </Text>
            </View>
          </View>

          {/* Leave Summary & Actions */}
          <View style={styles.sidebar}>
            {/* Leave Summary Card */}
            {leaveSummary && (
              <View style={styles.card}>  
                <Text style={styles.sectionTitle}>Leave Summary</Text>
                <View style={styles.summaryRow}>
                  <Text>Remaining Paid:</Text>
                  <Text>{leaveSummary.remaining_paid_leaves}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text>Remaining Sick:</Text>
                  <Text>{leaveSummary.remaining_sick_leaves}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text>Paid This Month:</Text>
                  <Text>{leaveSummary.month_paid_leaves}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text>Half-Paid This Month:</Text>
                  <Text>{leaveSummary.month_half_paid_leaves}</Text>
                </View>
              </View>
            )}

            {/* Actions */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Actions</Text>
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#34C759' }]} onPress={() => handleMark('entry')}>
                <AntDesign name="login" size={24} color="#fff" />
                <Text style={styles.actionText}>Mark Entry</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#FF3B30' }]} onPress={() => handleMark('exit')}>
                <AntDesign name="logout" size={24} color="#fff" />
                <Text style={styles.actionText}>Mark Exit</Text>
              </TouchableOpacity>
            </View>
          </View>

 {/* Main Content */}
<View style={styles.main}>
  {/* Date & Time */}
  <View style={styles.row}>
    <TouchableOpacity style={styles.inputBox} onPress={() => setShowDatePicker(true)}>
      <MaterialIcons name="date-range" size={20} color="#555" />
      <Text style={styles.inputText}>{formatDateDisplay(date)}</Text>
    </TouchableOpacity>
    <View style={styles.inputBox}>
      <TextInput
        style={styles.inputText}
        value={timeText}
        onChangeText={setTimeText}
        placeholder="HH:MM"
        keyboardType="numbers-and-punctuation"
        maxLength={5}
      />
    </View>
  </View>

  {Platform.OS === 'web' ? (
    showDatePicker && (
      // use a native HTML date-input for web
      <input
        type="date"
        value={date.toISOString().slice(0, 10)}
        onChange={e => {
          const picked = e.target.value;             // “YYYY-MM-DD”
          setDate(new Date(picked));                 // update state
          setShowDatePicker(false);                  // close picker
        }}
        style={{
          // you can tweak these to match your RN styles
          fontSize: 16,
          padding: 8,
          borderRadius: 4,
          border: '1px solid #ccc',
        }}
      />
    )
  ) : (
    <DateTimePickerModal
      mode="date"
      isVisible={showDatePicker}
      date={date}
      onConfirm={d => {
        setShowDatePicker(false);
        setDate(d);
      }}
      onCancel={() => setShowDatePicker(false)}
    />
  )}


  <View style={styles.card}>
      <Text style={styles.sectionTitle}>Leave Status</Text>

      <Picker
        selectedValue={selectedStatus}
        onValueChange={setSelectedStatus}
        enabled={!checkingPrev}
        style={styles.pickerStyle}
      >
        <Picker.Item label="Select Status" value="" />
        {statuses.map(opt => (
          <Picker.Item key={opt} label={opt} value={opt} />
        ))}
      </Picker>

      {checkingPrev && <ActivityIndicator size="small" />}

      {!!note && <Text style={styles.noteText}>{note}</Text>}

      <TouchableOpacity
        onPress={handleUpdateStatus}
        // disable if they haven’t picked anything OR they picked something we just hid
        disabled={!selectedStatus || !statuses.includes(selectedStatus)}
        style={[
          styles.updateBtn,
          (!selectedStatus || !statuses.includes(selectedStatus)) && styles.updateBtnDisabled
        ]}
      >
        <Text style={styles.updateText}>Update Status</Text>
      </TouchableOpacity>
    </View>



            {/* Record Display */}
            <View style={styles.card}>  
              <Text style={styles.sectionTitle}>Today's Record</Text>
              <Text style={styles.recordDate}>Record for {record?.date}</Text>
              <View style={styles.row}>  
                <View style={styles.timeCard}>
                  <Text style={styles.timeLabel}>Entry</Text>
                  <Text style={styles.timeValue}>{record?.entry_time || '—'}</Text>
                </View>
                <View style={styles.timeCard}>
                  <Text style={styles.timeLabel}>Exit</Text>
                  <Text style={styles.timeValue}>{record?.exit_time || '—'}</Text>
                </View>
              </View>
            </View>

            {/* 7-Day Sparkline */}
            {summary?.details && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sparkline}>
                {summary.details.slice(-7).map(d => {
                  const bg = d.status === 'present' ? '#34C759' : d.status === 'absent' ? '#FF3B30' : '#FFD60A';
                  return <View key={d.date} style={[styles.dot, { backgroundColor: bg }]} />;
                })}
              </ScrollView>
            )}

            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <AntDesign name="arrowleft" size={18} color="#007AFF" />
              <Text style={styles.backText}>Back to Dashboard</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const { width } = Dimensions.get('window');






const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    // make sure nothing ever bleeds outside on web
    ...Platform.select({ 
      web: { 
        overflowX: 'hidden', 
      }, 
    }),
  },
  content: {
    padding: 24,
  },
  grid: {
  flexDirection: Platform.select({ web: 'row', default: 'column' }),
  justifyContent: 'space-between',
  flexWrap: 'nowrap',             // keep them side-by-side
  overflow: Platform.select({     // ensure nothing bleeds out
    web: 'hidden',
    default: undefined,
  }),
},

sidebar: {
  flexBasis: Platform.select({ web: '30%', default: '100%' }),  // 30% of row
  flexGrow: 0,                                                  // don’t expand
  flexShrink: 1,                                                // do shrink if needed
  marginRight: Platform.select({ web: 24, default: 0 }),
  overflow: 'hidden',                                           // hide any extra
},

main: {
  flexBasis: Platform.select({ web: '65%', default: '100%' }),  // 65% of row
  flexGrow: 1,                                                  // fill leftover space
  flexShrink: 1,                                                // shrink if too big
  overflow: 'hidden',                                           // be a good citizen
},
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    marginBottom: 24,
    // Apply a shadow style based on the current platform.
    ...Platform.select({
      web: {
        boxSizing: 'border-box',
        maxWidth: '100%',
        boxShadow: '0 6px 8px rgba(0, 0, 0, 0.1)',
      },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },

  headerText: { flex: 1, paddingRight: 12 },
  title: { fontSize: 28, fontWeight: '700', color: '#1C1C1E' },
  subtitle: { fontSize: 16, color: '#636366', marginTop: 6 },
  badge: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 18 },
  badgeText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  inputBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  inputText: { fontSize: 16, color: '#1C1C1E', marginLeft: 8 },

  sectionTitle: { fontSize: 20, fontWeight: '600', marginBottom: 16, color: '#1C1C1E' },
  pickerStyle: { width: '100%', height: 60, marginBottom: 16 },
  updateBtn: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  updateText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  actionText: { color: '#fff', fontSize: 18, fontWeight: '600', marginLeft: 12 },

  timeCard: {
    flex: 0.48,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  timeLabel: { fontSize: 14, color: '#8E8E93', marginBottom: 8 },
  timeValue: { fontSize: 20, fontWeight: '600', color: '#1C1C1E' },

  recordDate: { fontSize: 16, color: '#8E8E93', marginBottom: 16, textAlign: 'center' },

  sparkline: { marginVertical: 20 },
  dot: { width: 18, height: 18, borderRadius: 9, marginHorizontal: 8 },

  backBtn: { flexDirection: 'row', justifyContent: 'center', paddingVertical: 18 },
  backText: { color: '#007AFF', fontSize: 18, fontWeight: '600', marginLeft: 10 },
  noteText: {
    color: 'crimson',
    marginVertical: 4,
    fontStyle: 'italic',
  },
  updateBtnDisabled: { opacity: 0.5 },
});
