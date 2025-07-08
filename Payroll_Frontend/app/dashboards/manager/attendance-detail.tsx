// app/dashboards/manager/attendance-detail.tsx
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TextInput,
} from 'react-native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AntDesign } from '@expo/vector-icons';
import {
  fetchTodayAttendance,
  fetchEmployeeAttendance,
  markEntry,
  markExit,
} from '../../api/attendance';
import { Attendance, AttendanceSummary } from '../../types/attendance';

export default function AttendanceDetail() {
  const router = useRouter();
  const { employeeId, name = '', email = '' } = useLocalSearchParams<{
    employeeId: string;
    name: string;
    email: string;
  }>();

  // States
  const [record, setRecord] = useState<Attendance | null>(null);
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const [date, setDate] = useState(new Date());  // chosen date
  const [timeText, setTimeText] = useState('');  // "HH:MM"
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Load existing data
  const loadData = useCallback(async () => {
    if (!employeeId) return;
    setLoading(true);
    try {
      const rec = await fetchTodayAttendance(employeeId);
      const now = new Date();
      const sum = await fetchEmployeeAttendance(now.getMonth() + 1, now.getFullYear());
      setRecord(rec);
      setSummary(sum);
      if (rec?.date) setDate(new Date(rec.date));
      if (rec?.entry_time) {
        const [h, m] = rec.entry_time.split(':');
        setTimeText(`${h.padStart(2, '0')}:${m.padStart(2, '0')}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  // Formaters
  const formatDateDisplay = (d: Date) =>
    d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

  // Mark handlers
  const handleMark = async (type: 'entry' | 'exit') => {
    setLoading(true);
    try {
      const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
      const timeStr = timeText;                         // HH:MM

      const updated =
        type === 'entry'
          ? await markEntry(employeeId, dateStr, timeStr)
          : await markExit(employeeId, dateStr, timeStr);

      setRecord(updated);
      await AsyncStorage.setItem(
        `attendance-${employeeId}-${new Date().toISOString().split('T')[0]}`,
        type
      );
      const now = new Date();
      const sum = await fetchEmployeeAttendance(now.getMonth() + 1, now.getFullYear());
      setSummary(sum);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <ActivityIndicator style={{ flex: 1 }} size="large" />;
  }

  // Status badge
  const status = record
    ? record.exit_time
      ? 'exit'
      : record.entry_time
      ? 'entry'
      : 'none'
    : 'none';
  const statusColor = status === 'entry'
    ? '#4CAF50' : status === 'exit'
    ? '#F44336' : '#007aff';

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={[styles.headerCard, { borderLeftColor: statusColor }]}>
        <View style={styles.headerInfo}>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.meta}>{email}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
          <Text style={styles.statusText}>
            {status === 'entry' ? 'Checked In'
             : status === 'exit'  ? 'Checked Out'
             : 'No Status'}
          </Text>
        </View>
      </View>

      {/* Date & Time Inputs */}
      <View style={styles.inputRow}>
        <TouchableOpacity
          style={styles.dateField}
          onPress={() => setShowDatePicker(true)}
        >
          <Text style={styles.dateFieldText}>{formatDateDisplay(date)}</Text>
          <AntDesign name="calendar" size={20} color="#007aff" />
        </TouchableOpacity>
        <TextInput
          style={styles.timeField}
          value={timeText}
          onChangeText={setTimeText}
          placeholder="HH:MM"
          keyboardType="numeric"
        />
      </View>

      <DateTimePickerModal
        mode="date"
        isVisible={showDatePicker}
        date={date}
        onConfirm={(d) => {
          setShowDatePicker(false);
          setDate(d);
        }}
        onCancel={() => setShowDatePicker(false)}
      />

      {/* Mark Buttons */}
      <View style={styles.buttonsRow}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.entryBtn]}
          onPress={() => handleMark('entry')}
        >
          <AntDesign name="login" size={20} color="#fff" />
          <Text style={styles.actionText}>Mark Entry</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.exitBtn]}
          onPress={() => handleMark('exit')}
        >
          <AntDesign name="logout" size={20} color="#fff" />
          <Text style={styles.actionText}>Mark Exit</Text>
        </TouchableOpacity>
      </View>

      {/* Existing Record */}
      <Text style={styles.dateText}>Record for {record?.date}</Text>
      <View style={styles.timesRow}>
        <View style={styles.timeCard}>
          <Text style={styles.timeLabel}>Entry</Text>
          <Text style={styles.timeValue}>{record?.entry_time || '—'}</Text>
        </View>
        <View style={styles.timeCard}>
          <Text style={styles.timeLabel}>Exit</Text>
          <Text style={styles.timeValue}>{record?.exit_time || '—'}</Text>
        </View>
      </View>

      {/* 7‑Day Sparkline */}
      {summary?.details && (
        <ScrollView horizontal style={styles.weekRow}>
          {summary.details.slice(-7).map(d => {
            const bg = d.status === 'present'
              ? '#4CAF50' : d.status === 'absent'
              ? '#F44336' : '#FFC107';
            return <View key={d.date} style={[styles.dayDot, { backgroundColor: bg }]} />;
          })}
        </ScrollView>
      )}

      {/* Back */}
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <AntDesign name="arrowleft" size={18} color="#0066cc" />
        <Text style={styles.backText}>Back to Dashboard</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f9fc', padding: 16 },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderLeftWidth: 6,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
  },
  headerInfo: { flex: 1 },
  name: { fontSize: 22, fontWeight: '700', color: '#333' },
  meta: { fontSize: 14, color: '#666' },
  statusBadge: { padding: 6, borderRadius: 20 },
  statusText: { color: '#fff', fontWeight: '600', fontSize: 12 },
  inputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  dateField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    marginRight: 8,
    backgroundColor: '#fff',
  },
  dateFieldText: { flex: 1, fontSize: 16 },
  timeField: {
    width: 80,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    backgroundColor: '#fff',
    textAlign: 'center',
    fontSize: 16,
  },
  buttonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  actionBtn: {
    flex: 0.48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
  },
  entryBtn: { backgroundColor: '#4CAF50' },
  exitBtn: { backgroundColor: '#F44336' },
  actionText: { color: '#fff', fontSize: 16, fontWeight: '600', marginLeft: 8 },
  dateText: { textAlign: 'center', color: '#444', marginBottom: 16 },
  timesRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  timeCard: {
    flex: 0.45,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    elevation: 1,
  },
  timeLabel: { fontSize: 12, color: '#888', marginBottom: 6 },
  timeValue: { fontSize: 16, fontWeight: '600', color: '#333' },
  weekRow: { marginBottom: 24 },
  dayDot: { width: 16, height: 16, borderRadius: 8, marginHorizontal: 6 },
  backBtn: { flexDirection: 'row', justifyContent: 'center', paddingVertical: 12 },
  backText: { color: '#0066cc', fontSize: 16, marginLeft: 6 },
});
