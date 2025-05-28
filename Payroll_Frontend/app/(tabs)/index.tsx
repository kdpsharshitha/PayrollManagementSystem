import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { IconSymbol } from '@/components/ui/IconSymbol'; // Assuming you're using this for icons

export default function Home() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

      <Text style={styles.title}>Payroll Management System</Text>

      {/* Get Started Button - Centered */}
      <TouchableOpacity style={styles.button} onPress={() => router.push('/login')}>
        <Text style={styles.buttonText}>Get Started</Text>
      </TouchableOpacity>

      {/* Home & Explore Icons at Bottom Edges */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity onPress={() => router.push('/')} style={styles.bottomButton}>
          <IconSymbol size={40} name="house.fill" color="#E2E8F0" />
          <Text style={styles.iconLabel}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/explore')} style={styles.bottomButton}>
          <IconSymbol size={40} name="paperplane.fill" color="#E2E8F0" />
          <Text style={styles.iconLabel}>Explore</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: '#E2E8F0',
    marginBottom: 40,
    textAlign: 'center',
    letterSpacing: 1.1,
    lineHeight: 40,
  },
  button: {
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderRadius: 32,
    shadowColor: '#1E3A8A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    marginBottom: 20,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#F8FAFC',
    letterSpacing: 0.8,
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 20,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  bottomButton: {
    alignItems: 'center',
  },
  iconLabel: {
    marginTop: 8,
    fontSize: 16,
    color: '#E2E8F0',
    fontWeight: '500',
  },
});