import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { AntDesign } from '@expo/vector-icons';
import { LeaveRequest } from '../app/types/attendance';

interface Props {
  leave: LeaveRequest;
  index: number;
  onPress: () => void;
}

export default function LeaveCard({ leave, index, onPress }: Props) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{index + 1}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.name}>{leave.employee_name || '—'}</Text>
        <Text style={styles.meta}>ID: {leave.employee_id || leave.id}</Text>
        <Text style={styles.meta}>Designation: {leave.designation || 'N/A'}</Text>
        <Text style={styles.period}>{leave.start_date} → {leave.end_date}</Text>
        <Text style={styles.type}>{leave.leave_type.charAt(0).toUpperCase() + leave.leave_type.slice(1)} Leave</Text>
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
    // Android elevation
    elevation: 2,
  },
  badge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFB300',
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
  period: {
    fontSize: 14,
    color: '#444',
    marginTop: 4,
  },
  type: {
    fontSize: 14,
    color: '#007aff',
    fontWeight: '500',
    marginTop: 2,
  },
  chevron: {
    marginLeft: 8,
  },
});
