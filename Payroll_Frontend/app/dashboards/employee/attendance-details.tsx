import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
  FlatList,
  ScrollView,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';
import dayjs from 'dayjs';
import { fetchEmployeeAttendance, applySandwichPolicy } from '../../api/attendance';
import { AttendanceSummary, AttendanceDetail } from '../../types/attendance';

const publicHolidays = new Set([
  '1-1', '1-26', '5-1', '8-15', '10-2', '12-25'
]);
const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Color palette
const colors = {
  primary: '#0052CC',
  secondary: '#FF9800',
  background: '#FFFFFF',
  surface: '#F1F4F8',
  accent: '#007AFF',
  textPrimary: '#333333',
  textSecondary: '#555555',
  border: '#E0E0E0',
  heading: '#002B5B', // deep blue for headings
};

function getWorkingDays(year: number, month: number): number {
  const totalDays = dayjs(`${year}-${month}-01`).daysInMonth();
  let workingDays = 0;
  for (let day = 1; day <= totalDays; day++) {
    const d = dayjs(`${year}-${month}-${day}`);
    const dow = d.day();
    if (dow === 0 || dow === 6) continue;
    if (publicHolidays.has(`${month}-${day}`)) continue;
    workingDays++;
  }
  return workingDays;
}

export default function EmployeeAttendanceDetails() {
  const router = useRouter();
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  const [attendance, setAttendance] = useState<AttendanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchEmployeeAttendance(month, year);
        const details = applySandwichPolicy(data.details ?? []);
        setAttendance({ ...data, details });
      } catch (err: any) {
        setError(err.message || 'Unknown error');
      } finally {
        setLoading(false);
      }
    })();
  }, [month, year]);

  const summary = useMemo(() => {
    if (!attendance?.details) return null;
    const workingDays = getWorkingDays(year, month);
    const counts = attendance.details.reduce((acc, d) => {
      switch (d.status) {
        case 'Paid Leave': acc.PaidLeave++; break;
        case 'UnPaid Leave': acc.UnpaidLeave++; break;
        case 'Sick Leave': acc.SickLeave++; break;
        case 'Absent': acc.Absent++; break;
        case 'Present': acc.Present++; break;
        case 'Half Paid Leave': acc.HalfPaidLeave++; break;
        case 'Half UnPaid Leave': acc.HalfUnPaidLeave++; break;
      }
      return acc;
    }, {
      PaidLeave: 0, UnpaidLeave: 0, SickLeave: 0,
      Absent: 0, Present: 0, HalfPaidLeave: 0, HalfUnPaidLeave: 0,
    });
    return { workingDays, ...counts };
  }, [attendance, month, year]);

  // Sort details by date ascending
  const sortedDetails = useMemo(() => {
    return attendance?.details
      ? [...attendance.details].sort((a, b) =>
          dayjs(a.date, 'YYYY-MM-DD').unix() - dayjs(b.date, 'YYYY-MM-DD').unix()
        )
      : [];
  }, [attendance]);

  if (loading) return <ActivityIndicator style={styles.flex} size="large" color={colors.primary} />;
  if (error) return <Text style={styles.error}>{error}</Text>;

  const renderHeader = () => (
    <View style={styles.headerRow}>
      {['Date', 'Status', 'Entry', 'Exit'].map((h, i) => (
        <Text key={i} style={styles.headerCell}>{h}</Text>
      ))}
    </View>
  );

  const renderItem = ({ item, index }: { item: AttendanceDetail; index: number }) => (
    <View style={[styles.row, index % 2 === 0 && styles.rowAlt]}>  
      <Text style={styles.cell}>{item.date}</Text>
      <Text style={styles.cell}>{item.status}</Text>
      <Text style={styles.cell}>{item.entry_time ?? '—'}</Text>
      <Text style={styles.cell}>{item.exit_time ?? '—'}</Text>
    </View>
  );

  const detailsColumn = (
    <View style={styles.detailsContainer}>
      {renderHeader()}
      <FlatList
        data={sortedDetails}
        keyExtractor={i => i.date}
        renderItem={renderItem}
        style={styles.list}
      />
    </View>
  );

  const summaryColumn = summary && (
    <View style={styles.summaryContainer}>
      <Text style={styles.summaryTitle}>Month At A Glance</Text>
      {Object.entries(summary).map(([k, v], i) => (
        <View key={i} style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>{k.replace(/([A-Z])/g, ' $1').trim().replace(/^./, s => s.toUpperCase())}</Text>
          <Text style={styles.summaryValue}>{v}</Text>
        </View>
      ))}
    </View>
  );

  return (
    <ScrollView contentContainerStyle={styles.outerContainer}>
      <View style={styles.container}>
        <Text style={styles.title}>Attendance Tracker</Text>

        <View style={styles.filterContainer}>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={month}
              onValueChange={setMonth}
              style={styles.picker}
              itemStyle={styles.pickerItem}
            >
              {monthNames.map((name, idx) => (
                <Picker.Item key={idx} label={name} value={idx + 1} />
              ))}
            </Picker>
          </View>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={year}
              onValueChange={setYear}
              style={styles.picker}
              itemStyle={styles.pickerItem}
            >
              {[year-2, year-1, year, year+1].map(y => (
                <Picker.Item key={y} label={`${y}`} value={y} />
              ))}
            </Picker>
          </View>
        </View>

        {Platform.OS === 'web' ? (
          <View style={styles.webLayout}>
            {summaryColumn}
            {detailsColumn}
          </View>
        ) : (
          <>
            {summaryColumn}
            {detailsColumn}
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  outerContainer: {
    flexGrow: 1,
    padding: 24,
    backgroundColor: colors.surface,
  },
  container: {
    maxWidth: Platform.OS === 'web' ? 1200 : undefined,
    width: '100%',
    alignSelf: 'center',
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 32,
    ...Platform.select({ web: { boxShadow: '0 4px 16px rgba(0,0,0,0.1)' } }),
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    marginBottom: 24,
    textAlign: 'center',
    color: colors.heading,
    fontFamily: Platform.OS === 'web' ? 'Helvetica Neue, Arial, sans-serif' : undefined,
  },
  filterContainer: { flexDirection: 'row', marginBottom: 24 },
  pickerWrapper: {
    flex: 1,
    marginRight: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  picker: { height: 48, backgroundColor: '#fff' },
  pickerItem: { fontSize: 16, color: colors.textPrimary, height: 48 },
  webLayout: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  summaryContainer: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 24,
    marginRight: 24,
    ...Platform.select({ web: { boxShadow: '0 2px 8px rgba(0,0,0,0.08)' } }),
  },
  summaryTitle: { fontSize: 20, fontWeight: '600', marginBottom: 16, color: colors.primary },
  summaryItem: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  summaryLabel: { fontSize: 16, fontWeight: '500', color: colors.textSecondary },
  summaryValue: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  detailsContainer: { flex: 2, backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  headerRow: { flexDirection: 'row', backgroundColor: colors.surface, paddingVertical: 12, borderBottomWidth: 1, borderColor: colors.border },
  headerCell: { flex: 1, fontSize: 14, fontWeight: '600', textTransform: 'uppercase', paddingHorizontal: 16, color: colors.textPrimary },
  row: { flexDirection: 'row', paddingVertical: 16, paddingHorizontal: 16, alignItems: 'center' },
  rowAlt: { backgroundColor: '#fafafa' },
  cell: { flex: 1, fontSize: 14, minWidth: 80, fontFamily: Platform.OS === 'web' ? 'Arial, sans-serif' : undefined, color: colors.textSecondary },
  list: {},
  error: { color: 'red', padding: 16, textAlign: 'center' },
});
