import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';

export default function HomeDashboard() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Payroll Management System</Text>
      <Text style={styles.subtitle}>Welcome to the Dashboard</Text>

      <Pressable style={styles.card} onPress={() => router.push('/employees')}>
        <Text style={styles.cardText}>View Employees</Text>
      </Pressable>

      <Pressable style={styles.card} onPress={() => router.push('/payroll')}>
        <Text style={styles.cardText}>Payroll Records</Text>
      </Pressable>

      <Pressable style={styles.card} onPress={() => router.push('/attendance')}>
        <Text style={styles.cardText}>Attendance</Text>
      </Pressable>

      <Pressable style={styles.card} onPress={() => router.push('/leave')}>
        <Text style={styles.cardText}>Leave Requests</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    color: '#cbd5e1',
    marginBottom: 20,
  },
  card: {
    width: '90%',
    backgroundColor: '#1f2937',
    padding: 15,
    marginVertical: 8,
    borderRadius: 10,
    borderColor: '#3b82f6',
    borderWidth: 1,
  },
  cardText: {
    color: '#f1f5f9',
    fontSize: 16,
  },
});
