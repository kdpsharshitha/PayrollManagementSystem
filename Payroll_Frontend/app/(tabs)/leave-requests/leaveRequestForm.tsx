// app/leave-requests/leaveRequestForm.tsx

import React, { useState } from "react";
import { View, Text, TextInput, Button, Alert, StyleSheet } from "react-native";
import axios from "axios";
import * as SecureStore from "expo-secure-store";

const LeaveRequestForm: React.FC = () => {
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [reason, setReason] = useState<string>("");

  const handleSubmit = async () => {
    try {
      const token = await SecureStore.getItemAsync("access_token");
      await axios.post(
        "http://192.168.17.49:8000/leave-requests/create/",
        { start_date: startDate, end_date: endDate, reason },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      Alert.alert("Success", "Leave request submitted!");
      setStartDate("");
      setEndDate("");
      setReason("");
    } catch (error: any) {
      console.error(error.response?.data || error.message);
      Alert.alert("Error", "Failed to submit leave request.");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Leave Request Form</Text>
      <TextInput
        style={styles.input}
        placeholder="Start Date (YYYY-MM-DD)"
        value={startDate}
        onChangeText={setStartDate}
      />
      <TextInput
        style={styles.input}
        placeholder="End Date (YYYY-MM-DD)"
        value={endDate}
        onChangeText={setEndDate}
      />
      <TextInput
        style={[styles.input, { height: 80 }]}
        placeholder="Reason"
        value={reason}
        onChangeText={setReason}
        multiline
      />
      <Button title="Submit Request" onPress={handleSubmit} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 20 },
  heading: { fontSize: 20, marginBottom: 10 },
  input: {
    height: 40,
    borderColor: "gray",
    borderWidth: 1,
    marginBottom: 12,
    paddingHorizontal: 8,
  },
});

export default LeaveRequestForm;