// app/dashboards/manager/leave-detail.tsx
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
  markEntry,
  markExit,
} from '../../api/attendance';
import { Attendance } from '../../types/attendance';

export default function LeaveDetail() {
  const router = useRouter();
  const { employeeId } = useLocalSearchParams<{ employeeId: string }>();
  const id = String(employeeId);

  const [record, setRecord] = useState<Attendance | null>(null);
  const [loading, setLoading] = useState(true);

  // Date & time inputs
  const [date, setDate] = useState(new Date());
  const [timeText, setTimeText] = useState(''); // "HH:MM"
  const [showDatePicker, setShowDatePicker] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const rec = await fetchTodayAttendance(id);
      setRecord(rec);
      if (rec?.date) setDate(new Date(rec.date));
      if (rec?.entry_time) {
        const [h, m] = rec.entry_time.split(':');
        setTimeText(`${h.padStart(2,'0')}:${m.padStart(2,'0')}`);
      }
    } catch (err) {
      console.error('Error loading attendance:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const formatDateDisplay = (d: Date) =>
    d.toLocaleDateString(undefined, {
      weekday:'short', month:'short', day:'numeric', year:'numeric'
    });

  const handleMark = async (type: 'entry' | 'exit') => {
    setLoading(true);
    try {
      const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
      const timeStr = timeText;                         // HH:MM
      const updated =
        type === 'entry'
          ? await markEntry(id, dateStr, timeStr)
          : await markExit(id, dateStr, timeStr);
      setRecord(updated);
      await AsyncStorage.setItem(
        `attendance-${id}-${dateStr}`,
        type
      );
    } catch (err) {
      console.error(`Error marking ${type}:`, err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <ActivityIndicator style={{ flex:1 }} size="large" />;
  }

  const status = record
    ? record.exit_time
      ? 'exit'
      : record.entry_time
      ? 'entry'
      : 'none'
    : 'none';
  const statusColor = status === 'entry'
    ? '#4CAF50'
    : status === 'exit'
    ? '#F44336'
    : '#007aff';

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={[styles.headerCard, { borderLeftColor: statusColor }]}>
        <View style={styles.headerInfo}>
          <Text style={styles.name}>Employee ID: {id}</Text>
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
          <Text style={styles.dateFieldText}>
            {formatDateDisplay(date)}
          </Text>
          <AntDesign name="calendar" size={20} color="#007aff" />
        </TouchableOpacity>
        <TextInput
          style={styles.timeField}
          value={timeText}
          onChangeText={setTimeText}
          placeholder="HH:MM"
          keyboardType="numbers-and-punctuation"
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

      {/* Action Buttons */}
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

      {/* Display Record */}
      <Text style={styles.dateText}>Record for {record?.date}</Text>
      <View style={styles.timesRow}>
        <View style={styles.timeCard}>
          <Text style={styles.timeLabel}>Entry Time</Text>
          <Text style={styles.timeValue}>{record?.entry_time || '—'}</Text>
        </View>
        <View style={styles.timeCard}>
          <Text style={styles.timeLabel}>Exit Time</Text>
          <Text style={styles.timeValue}>{record?.exit_time || '—'}</Text>
        </View>
        <View style={styles.timeCard}>
          <Text style={styles.timeLabel}>Work Time</Text>
          <Text style={styles.timeValue}>
            {record?.entry_time && record?.exit_time
              ? formatWorkTime(record.entry_time, record.exit_time)
              : '—'}
          </Text>
        </View>
      </View>

      {/* Back */}
      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => router.back()}
      >
        <AntDesign name="arrowleft" size={18} color="#0066cc" />
        <Text style={styles.backText}>Back to Dashboard</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

// helper
function formatWorkTime(entry: string, exit: string) {
  const diffMs = new Date(exit).getTime() - new Date(entry).getTime();
  const mins = Math.floor(diffMs/60000);
  const h = Math.floor(mins/60);
  const m = mins%60;
  return `${h}h ${m}m`;
}

const styles = StyleSheet.create({
  container:{ flex:1, backgroundColor:'#f7f9fc', padding:16 },
  headerCard:{
    flexDirection:'row', alignItems:'center',
    backgroundColor:'#fff', borderLeftWidth:6,
    borderRadius:8, padding:16, marginBottom:16,
    elevation:2,
  },
  headerInfo:{ flex:1 },
  name:{ fontSize:18, fontWeight:'600', color:'#333' },
  statusBadge:{ padding:6, borderRadius:20 },
  statusText:{ color:'#fff', fontWeight:'600', fontSize:12 },
  inputRow:{ flexDirection:'row', alignItems:'center', marginBottom:24 },
  dateField:{
    flex:1, flexDirection:'row', alignItems:'center',
    padding:12, borderWidth:1, borderColor:'#ccc',
    borderRadius:8, marginRight:8, backgroundColor:'#fff',
  },
  dateFieldText:{ flex:1, fontSize:16 },
  timeField:{
    width:80, padding:12, borderWidth:1,
    borderColor:'#ccc', borderRadius:8,
    backgroundColor:'#fff', textAlign:'center', fontSize:16,
  },
  buttonsRow:{
    flexDirection:'row', justifyContent:'space-between', marginBottom:32,
  },
  actionBtn:{
    flex:0.48, flexDirection:'row',
    alignItems:'center', justifyContent:'center',
    paddingVertical:14, borderRadius:8,
  },
  entryBtn:{ backgroundColor:'#4CAF50' },
  exitBtn:{ backgroundColor:'#F44336' },
  actionText:{ color:'#fff', fontSize:16, fontWeight:'600', marginLeft:8 },
  dateText:{ textAlign:'center', color:'#444', marginBottom:16 },
  timesRow:{ flexDirection:'row', justifyContent:'space-between', marginBottom:24 },
  timeCard:{
    flex:0.3, backgroundColor:'#fff',
    borderRadius:8, padding:12, alignItems:'center',
    elevation:1,
  },
  timeLabel:{ fontSize:12, color:'#888', marginBottom:6 },
  timeValue:{ fontSize:16, fontWeight:'600', color:'#333' },
  backBtn:{ flexDirection:'row', justifyContent:'center', paddingVertical:12 },
  backText:{ color:'#0066cc', fontSize:16, marginLeft:6 },
});
