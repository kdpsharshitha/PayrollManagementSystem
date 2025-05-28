// app/dashboard/hrDashboard.tsx

import React from 'react';
import { View, Text, Button } from 'react-native';
import { useRouter } from 'expo-router';

const HrDashboard: React.FC = () => {
  const router = useRouter();

  return (
    <View style={{ padding: 20 }}>
      <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 10 }}>
        Leave Requests
      </Text>

      <Button
        title="Request Leave"
        onPress={() => router.push('/leave-requests/leaveRequestForm')}
      />

      <Button
        title="View Employee Leave Requests"
        onPress={() => router.push('/leave-requests/leaveRequestList')}
      />

      <Button
        title="View My Leave Requests"
        onPress={() => router.push('/leave-requests/hrLeaveStatus')}
      />
    </View>
  );
};

export default HrDashboard;