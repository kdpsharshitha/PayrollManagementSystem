// components/EmployeeRow.tsx
import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { AntDesign } from '@expo/vector-icons';
import { Employee } from '../app/types/attendance';

export type AttendanceStatus = 'none' | 'entry' | 'exit';

interface Props {
  employee: Employee;
  index: number;
  onPress: () => void;
  status?: AttendanceStatus;
}

export default function EmployeeRow({
  employee,
  index,
  onPress,
  status = 'none',
}: Props) {
  const badgeColor =
    status === 'entry'
      ? '#388E3C'
      : status === 'exit'
      ? '#D32F2F'
      : '#1976D2';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.badge, { backgroundColor: badgeColor }]}>
        <Text style={styles.badgeText}>{index + 1}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.name}>{employee.name || '—'}</Text>
        <Text style={styles.meta}>ID: {employee.id}</Text>
        <Text style={styles.meta}>Designation: {employee.designation}</Text>
      </View>
      <AntDesign name="right" size={18} color="#ccc" style={styles.chevron} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    marginVertical: 6,
    padding: 12,
    // iOS shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    // Android
    elevation: 2,
  },
  badge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  badgeText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  info: {
    flex: 1,
    justifyContent: 'center',
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  meta: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
  },
  chevron: {
    marginLeft: 8,
  },
});
