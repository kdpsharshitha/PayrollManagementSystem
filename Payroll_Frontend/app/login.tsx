import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Alert as RNAlert,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

const isWeb = Platform.OS === 'web';

// Polyfill for Alert.alert on web
const showAlert = (title: string, message: string) => {
  if (isWeb) {
    window.alert(`${title}\n\n${message}`);
  } else {
    RNAlert.alert(title, message);
  }
};

// Unified storage for mobile & web
const Storage = {
  set: async (key: string, value: string) => {
    if (isWeb) {
      window.localStorage.setItem(key, value);
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  },
  get: async (key: string) => {
    if (isWeb) {
      return window.localStorage.getItem(key);
    } else {
      return SecureStore.getItemAsync(key);
    }
  },
};

// Base URL config (you can also inject via EAS config / env vars)
const API_HOST =
  Constants.expoConfig?.extra?.API_URL ||
  'http://192.168.1.7:8000';

const LoginScreen: React.FC = () => {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    console.log('Login attempt:', { trimmedEmail, trimmedPassword });
    if (!trimmedEmail || !trimmedPassword) {
      showAlert('Error', 'Please enter both email and password');
      return;
    }

    setLoading(true);
    try {
      const { data } = await axios.post(
        `${API_HOST}/api/employee/login/`,
        { email: trimmedEmail, password: trimmedPassword },
        {
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          timeout: 5000,
        }
      );

      console.log('Server Response:', data);
      const { access, refresh, role, name, gmail } = data;

      await Storage.set('access_token', access);
      await Storage.set('refresh_token', refresh);
      await AsyncStorage.setItem('currentUser', JSON.stringify({ name, email: gmail }));


      if (role === 'admin') {
        router.push('/dashboards/admin');
      } else if (role === 'manager') {
        router.push('/dashboards/manager');
      } else if (role === 'employee') {
        router.push('/dashboards/employee');
      } else {
        showAlert('Login Failed', 'Invalid user role');
      }
    } catch (err: any) {
      console.error('Login Error:', err.response?.data || err.message);
      showAlert(
        'Login Failed',
        err.response?.data?.error || 'Unexpected error occurred'
      );
    } finally {
      setLoading(false);
    }
  };

  // On web, KeyboardAvoidingView has no effect—just render a plain View
  const Container: React.ComponentType<any> =
    Platform.OS === 'web' ? View : KeyboardAvoidingView;

  return (
    <Container
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.heading}>Login</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#888"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#888"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Logging in...' : 'Login'}
          </Text>
        </TouchableOpacity>
      </View>
    </Container>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 400,         // constrain on large screens
    padding: 20,
    backgroundColor: '#FFF',
    borderRadius: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  heading: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2563EB',
    textAlign: 'center',
    marginBottom: 20,
  },
  input: {
    height: 50,
    borderColor: '#D1D5DB',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 15,
    fontSize: 16,
    color: '#111',
  },
  button: {
    backgroundColor: '#2563EB',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  buttonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default LoginScreen;