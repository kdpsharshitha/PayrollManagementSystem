import React, { useState } from 'react';
import { View, Text, TextInput, Button, Alert, StyleSheet } from 'react-native';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';

const LoginScreen: React.FC = () => {
  const router = useRouter();

  const [email, setEmail] = useState<string>('');  // ✅ Updated username → email
  const [password, setPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const handleLogin = async () => {
    const trimmedEmail = email.trim();  // ✅ Ensure email is processed properly
    const trimmedPassword = password.trim();

    console.log("Login attempt:", { email: trimmedEmail, password: trimmedPassword });

    if (!trimmedEmail || !trimmedPassword) {
      Alert.alert("Error", "Please enter both email and password");
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(
        "http://192.168.1.6:8000/api/employee/login/",
        { email: trimmedEmail, password: trimmedPassword },  // ✅ Changed username → email
        {
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          timeout: 5000,
        }
      );

      console.log("Server Response:", response.data);
      const { access, role } = response.data;
      await SecureStore.setItemAsync("access_token", access);

      // ✅ Navigation based on role (unchanged)
      switch (role) {
        case "admin":
          router.push("/dashboards/admin");
          break;
        case "hr":
          router.push("/dashboards/hr");
          break;
        case "employee":
          router.push("/dashboards/employee");
          break;
        default:
          Alert.alert("Login Failed", "Invalid user role");
      }
    } catch (error: any) {
      console.error("Login Error:", error.response?.data || error.message);
      Alert.alert("Login Failed", error.response?.data?.error || "Unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Login</Text>
      <TextInput
        placeholder="Email"  // ✅ Updated placeholder
        value={email}
        onChangeText={setEmail}  // ✅ Updated username → email
        autoCapitalize="none"
        keyboardType="email-address"  // ✅ Improved UX for email input
        style={styles.input}
      />
      <TextInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={styles.input}
      />
      <Button title={loading ? 'Logging in...' : 'Login'} onPress={handleLogin} disabled={loading} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20 },
  heading: { fontSize: 24, marginBottom: 20, textAlign: 'center',color:'#22186F' },
  input: { height: 40, borderColor: 'gray', borderWidth: 1, marginBottom: 12, paddingHorizontal: 8 },
});

export default LoginScreen;