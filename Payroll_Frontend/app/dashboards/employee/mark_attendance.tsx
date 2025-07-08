import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  TextInput,
  Platform,
  Dimensions,
  StyleSheet,
} from 'react-native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { useRouter } from 'expo-router';
import { AntDesign, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  fetchTodayAttendance1,
  markEntry1,
  markExit1,
} from '../../api/attendance';
import { Attendance } from '../../types/attendance';
import * as Location from 'expo-location';
import { Alert } from 'react-native';


const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isLarge = SCREEN_WIDTH > 600;

export default function AdminAttendanceSimple() {
  const router = useRouter();
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [record, setRecord] = useState<Attendance | null>(null);
  const [status, setStatus] = useState<string>('');        // ← new          
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(new Date());
  const defaultTime = new Date().toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const [timeText, setTimeText] = useState<string>(defaultTime);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const loadAttendance = useCallback(async () => {
    setLoading(true);
    try {
      const stored = await AsyncStorage.getItem('currentUser');
      if (stored) {
        const parsed = JSON.parse(stored);
        setUser({ name: parsed.name, email: parsed.email });
      }
      const rec = await fetchTodayAttendance1();
      setRecord(rec);
      if (rec?.date) setDate(new Date(rec.date));
      if (rec?.entry_time) {
        const [h, m] = rec.entry_time.split(':');
        setTimeText(`${h.padStart(2, '0')}:${m.padStart(2, '0')}`);
      } else {
        setTimeText(defaultTime);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [defaultTime]);

  useEffect(() => { loadAttendance(); }, [loadAttendance]);

  async function requestLocationPermission(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert(
      'Location Permission',
      'We need access to your location to mark attendance.'
    );
    return false;
  }
  return true;
}
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
    d.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

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
    setStatus(type === 'entry' ? 'Entered' : 'Exited');
  } catch (err) {
    console.error(err);
  } finally {
    setLoading(false);
  }
};


  if (loading) {
    return <ActivityIndicator style={{ flex: 1 }} size="large" color="#007AFF" />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>{user?.name ?? '—'}</Text>
            <Text style={styles.subtitle}>{user?.email ?? '—'}</Text>
          </View>
        </View>

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

        <DateTimePickerModal
          mode="date"
          isVisible={showDatePicker}
          date={date}
          onConfirm={d => { setShowDatePicker(false); setDate(d); }}
          onCancel={() => setShowDatePicker(false)}
        />

        {/* Actions */}
        <View style={styles.row}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#34C759' }]}
            onPress={() => handleMark('entry')}
          >
            <AntDesign name="login" size={20} color="#fff" />
            <Text style={styles.actionText}>Mark Entry</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#FF3B30' }]}
            onPress={() => handleMark('exit')}
          >
            <AntDesign name="logout" size={20} color="#fff" />
            <Text style={styles.actionText}>Mark Exit</Text>
          </TouchableOpacity>
        </View>

        {/* Record Display */}
        <View style={styles.recordBox}>
          {status !== '' && (
            <Text
              style={[
                styles.statusText,
                { color: status === 'Entered' ? '#34C759' : '#FF3B30' },
              ]}
            >
              {status}
            </Text>
          )}
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

        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <AntDesign name="arrowleft" size={18} color="#007AFF" />
          <Text style={styles.backText}>Back to Dashboard</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    ...Platform.select({
      web: {
        maxWidth: 1000,
        marginHorizontal: 'auto',
        paddingVertical: 40,
        backgroundColor: '#fff',
      },
    }),
  },
  content: {
    padding: 20,
    paddingBottom: 40,
    ...Platform.select({
      web: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
      },
    }),
  },
  header: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
    ...Platform.select({
      web: {
        boxShadow: '0px 4px 6px rgba(0,0,0,0.1)',
        width: '100%',
      },
    }),
  },
  title: {
    fontSize: isLarge ? 32 : 24,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  subtitle: {
    fontSize: isLarge ? 16 : 14,
    color: '#636366',
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    ...Platform.select({
      web: {
        flexWrap: 'wrap',
        width: '48%',
      },
    }),
  },
  inputBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginRight: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
    ...Platform.select({
      web: {
        minWidth: 200,
      },
    }),
  },
  inputText: {
    fontSize: 16,
    color: '#1C1C1E',
    marginLeft: 8,
  },
  actionBtn: {
    flex: 0.48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 2,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        minWidth: 140,
      },
    }),
  },
  actionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  recordBox: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
    ...Platform.select({
      web: {
        boxShadow: '0px 2px 4px rgba(0,0,0,0.05)',
        width: '48%',
      },
    }),
  },
  statusText: {                                // ← new
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  recordDate: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 12,
    textAlign: 'center',
  },
  timeCard: {
    flex: 0.48,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
    ...Platform.select({
      web: {
        boxShadow: '0px 2px 4px rgba(0,0,0,0.05)',
      },
    }),
  },
  timeLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 6,
  },
  timeValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  backBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 16,
    ...Platform.select({
      web: { cursor: 'pointer', width: '100%' },
    }),
  },
  backText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});
