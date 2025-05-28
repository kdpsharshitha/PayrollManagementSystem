// app/admin/createUserScreen.tsx

import React, { useState } from "react";
import { View, Text, TextInput, Button, Alert, StyleSheet } from "react-native";
import axios from "axios";
import * as SecureStore from "expo-secure-store";

const CreateUserScreen: React.FC = () => {
  const [userID, setUserID] = useState<string>("");
  const [username, setUsername] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [role, setRole] = useState<"employee" | "hr">("employee"); // Default new user role

  const handleCreateUser = async () => {
    try {
      const token = await SecureStore.getItemAsync("access_token");

      const response = await axios.post(
        "http://192.168.17.49:8000/employee/create-user/",
        { user_id: userID, username, email, password, role },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      Alert.alert("Success", `User ${response.data.username} created!`);
    } catch (error: any) {
      Alert.alert("Error", error.response?.data?.error || "Could not create user.");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Create a New User</Text>

      <TextInput
        placeholder="User ID"
        value={userID}
        onChangeText={setUserID}
        style={styles.input}
      />
      <TextInput
        placeholder="Username"
        value={username}
        onChangeText={setUsername}
        style={styles.input}
      />
      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        style={styles.input}
      />
      <TextInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={styles.input}
      />

      <Text>Role:</Text>
      <View style={styles.roleButtons}>
        <Button title="Employee" onPress={() => setRole("employee")} />
        <Button title="HR" onPress={() => setRole("hr")} />
      </View>

      <Button title="Create User" onPress={handleCreateUser} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 20 },
  heading: { fontSize: 24, marginBottom: 20, textAlign: "center" },
  input: { height: 40, borderColor: "gray", borderWidth: 1, marginBottom: 12, paddingHorizontal: 8 },
  roleButtons: { flexDirection: "row", justifyContent: "space-around", marginVertical: 10 },
});

export default CreateUserScreen;