// app/dashboard/manager/manage-attendance.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
  TextInput,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import SegmentedControl from '@react-native-segmented-control/segmented-control';
import { AntDesign } from '@expo/vector-icons';
import {
  fetchManageAttendance,
  markEntry,
  markExit,
} from '../../api/attendance';
import { Employee, LeaveRequest } from '../../types/attendance';
import EmployeeRow from '../../../components/EmployeeRow';
import LeaveCard from '../../../components/LeaveCard';

type Section = 'present' | 'on_leave';
type AttendanceStatus = 'none' | 'entry' | 'exit';

const RowWithStatus = EmployeeRow as unknown as React.ComponentType<{
  employee: Employee;
  index: number;
  status: AttendanceStatus;
  onPress: () => void;
}>;

export default function ManageAttendance() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [present, setPresent] = useState<Employee[]>([]);
  const [onLeave, setOnLeave] = useState<LeaveRequest[]>([]);
  const [section, setSection] = useState<Section>('present');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusById, setStatusById] = useState<
    Record<string, AttendanceStatus>
  >({});
  const [fabOpen, setFabOpen] = useState(false);

  const getTodayKey = () => new Date().toISOString().split('T')[0];

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchManageAttendance();
        const data = (result as any).data || result;
        setPresent(data.present);
        setOnLeave(data.on_leave);

        const today = getTodayKey();
        const map: Record<string, AttendanceStatus> = {};
        await Promise.all(
          data.present.map(async (emp: Employee) => {
            const stored = await AsyncStorage.getItem(
              `attendance-${emp.id}-${today}`
            );
            map[emp.id] = (stored as AttendanceStatus) || 'none';
          })
        );
        setStatusById(map);
      } catch (e: any) {
        setError(e.message ?? 'Unknown error');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useFocusEffect(
    useCallback(() => {
      async function refresh() {
        await new Promise((r) => setTimeout(r, 200));
        const today = getTodayKey();
        const map: Record<string, AttendanceStatus> = {};
        for (const emp of present) {
          const stored = await AsyncStorage.getItem(
            `attendance-${emp.id}-${today}`
          );
          map[emp.id] = (stored as AttendanceStatus) || 'none';
        }
        setStatusById(map);
      }
      refresh();
    }, [present])
  );

  const filteredPresent = present.filter(
    (e) =>
      e.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const filteredOnLeave = onLeave.filter((l) =>
    l.employee_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleBulk = async (type: 'entry' | 'exit') => {
    if (loading) return;
    setLoading(true);
    try {
      const apiFn = type === 'entry' ? markEntry : markExit;
      const ids = present.map((e) => String(e.id));
      const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const nowHM = new Date().toTimeString().slice(0,5);  // HH:MM


      // call API for every employee with all 3 required args
      await Promise.all(
        ids.map((id) => apiFn(id, today, nowHM))
      );

      // persist local status flags
      await Promise.all(
        ids.map((id) =>
          AsyncStorage.setItem(`attendance-${id}-${today}`, type)
        )
      );

      // update local UI state
      setStatusById((prev) => {
        const next = { ...prev };
        ids.forEach((id) => (next[id] = type));
        return next;
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setFabOpen(false);
    }
};

  if (loading) return <ActivityIndicator style={{ flex: 1 }} />;
  if (error)
    return (
      <View style={styles.errorContainer}>
        <Text style={{ color: '#c00' }}>Error: {error}</Text>
      </View>
    );

  return (
    <View style={styles.container}>
      {/* Top Summary */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, styles.statPresent]}>
          <Text style={styles.statNumber}>{present.length}</Text>
          <Text style={styles.statLabel}>Present</Text>
        </View>
        <View style={[styles.statCard, styles.statOnLeave]}>
          <Text style={styles.statNumber}>{onLeave.length}</Text>
          <Text style={styles.statLabel}>On Leave</Text>
        </View>
      </View>

      {/* Section Toggle */}
      <SegmentedControl
        values={['Present', 'On Leave']}
        selectedIndex={section === 'present' ? 0 : 1}
        onChange={(e) =>
          setSection(e.nativeEvent.selectedSegmentIndex === 0 ? 'present' : 'on_leave')
        }
        style={styles.segmented}
      />

      {/* Search */}
      <TextInput
        style={styles.searchBar}
        placeholder="Search employees..."
        value={searchTerm}
        onChangeText={setSearchTerm}
      />

      {/* List */}
      {section === 'present' ? (
        <FlatList
          data={filteredPresent}
          keyExtractor={(item) => String(item.id)}
          extraData={statusById}
          renderItem={({ item, index }) => (
            <RowWithStatus
              employee={item}
              index={index}
              status={statusById[String(item.id)] || 'none'}
              onPress={() =>
                router.push({
                  pathname: '/dashboards/manager/attendance-detail',
                  params: {
                    employeeId: item.id,
                    name: item.name ?? item.email,
                    email: item.email,
                  },
                })
              }
            />
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No one’s present today.</Text>
          }
        />
      ) : (
        <FlatList
          data={filteredOnLeave}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item, index }) => (
            <LeaveCard
              leave={item}
              index={index}
              onPress={() =>
                router.push({
                  pathname: '/dashboards/manager/leave-detail',
                  params: { employeeId: String(item.employee_id) },
                })
              }
            />
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No one’s on leave today.</Text>
          }
        />
      )}

      {/* FAB for Bulk Actions */}
      {section === 'present' && (
        <View style={styles.fabContainer}>
          {fabOpen && (
            <>
              <TouchableOpacity
                style={[styles.fabMini, { bottom: 90 }]}
                onPress={() => handleBulk('entry')}
              >
                <AntDesign name="login" size={20} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.fabMini, { bottom: 150 }]}
                onPress={() => handleBulk('exit')}
              >
                <AntDesign name="logout" size={20} color="#fff" />
              </TouchableOpacity>
            </>
          )}
          <TouchableOpacity
            style={styles.fab}
            activeOpacity={0.8}
            onPress={() => setFabOpen((o) => !o)}
          >
            <AntDesign name={fabOpen ? 'close' : 'plus'} size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f2f6fc',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff5f5',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },

  /* Summary Cards */
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  statPresent: { backgroundColor: '#e6f7ff' },
  statOnLeave: { backgroundColor: '#fff5e6' },
  statNumber: {
    fontSize: 28,
    fontWeight: '700',
    color: '#333',
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },

  /* Segmented Control */
  segmented: {
    marginBottom: 16,
  },

  /* Search Bar */
  searchBar: {
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    fontSize: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },

  /* Empty Text */
  emptyText: {
    textAlign: 'center',
    marginTop: 40,
    color: '#aaa',
    fontSize: 16,
  },

  /* FAB */
  fabContainer: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    alignItems: 'center',
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#0066cc',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  fabMini: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#0066cc',
    alignItems: 'center',
    justifyContent: 'center',
    right: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 3,
  },
});
