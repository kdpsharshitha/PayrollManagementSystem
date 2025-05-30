import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  TextInput,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons, Feather, MaterialIcons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";

type Employee = {
  id: string;
  name: string;
  email: string;
  role: string;
  designation: string;
  phone_no: string;
};

export default function EmployeeManagementScreen() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState("");
  const router = useRouter();

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const token = await SecureStore.getItemAsync("access_token");
      if (!token) {
        Alert.alert("Authentication Error", "You are not logged in.");
        return;
      }

      const res = await fetch("http://192.168.1.6:8000/api/employee/employees/", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error("Failed to fetch");
      }

      const data = await res.json();
      setEmployees(data);
    } catch (error) {
      console.error("Failed to fetch employees:", error);
    }
  };

  const deleteEmployee = async (id: string) => {
    Alert.alert("Confirm Delete", "Are you sure you want to delete this employee?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const token = await SecureStore.getItemAsync("access_token");
            if (!token) {
              Alert.alert("Authentication Error", "You are not logged in.");
              return;
            }

            await fetch(`http://192.168.1.6:8000/api/employee/employees/${id}/`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${token}` },
            });

            setEmployees((prev) => prev.filter((emp) => emp.id !== id));
            Alert.alert("Success", "Employee deleted successfully.");
          } catch (error) {
            console.error("Delete failed:", error);
          }
        },
      },
    ]);
  };

  const handleSearch = () => {
    if (!search) return employees;
    const lowerSearch = search.toLowerCase();
    return employees.filter(
      (emp) =>
        emp.id?.toString().toLowerCase().includes(lowerSearch) ||
        emp.email?.toLowerCase().includes(lowerSearch) ||
        emp.name?.toLowerCase().includes(lowerSearch)
    );
  };

  const renderItem = ({ item }: { item: Employee }) => (
    <View style={styles.card}>
      <Text style={styles.name}>{item.name}</Text>
      <Text>ID: {item.id}</Text>
      <Text>Email: {item.email}</Text>
      <Text>Role: {item.role}</Text>
      <Text>Designation: {item.designation}</Text>
      <Text>Phone No: {item.phone_no}</Text>

      <View style={styles.actionsRow}>
        <TouchableOpacity
          onPress={() =>
            router.push({
              pathname: "/dashboards/admin/view_emp/[id]",
              params: { id: item.id },
            })
          }
          style={[styles.button, styles.viewButton]}
        >
          <Ionicons name="eye" size={15} color="white" />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() =>
            router.push({
              pathname: "/dashboards/admin/edit_emp/[id]",
              params: { id: item.id },
            })
          }
          style={[styles.button, styles.editButton]}
        >
          <Feather name="edit" size={15} color="white" />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => deleteEmployee(item.id)}
          style={[styles.button, styles.deleteButton]}
        >
          <MaterialIcons name="delete" size={15} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <FlatList
      style={styles.container}
      data={handleSearch()}
      renderItem={renderItem}
      keyExtractor={(item) => item.id.toString()}
      ListHeaderComponent={
        <TextInput
          style={styles.searchBox}
          placeholder="Search by ID, Email, or Name"
          value={search}
          onChangeText={setSearch}
        />
      }
      contentContainerStyle={{ paddingBottom: 100 }}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff", // light gray
    paddingHorizontal: 8,
    paddingTop: 16,
  },
  searchBox: {
    backgroundColor: "white",
    padding: 12,
    marginBottom: 12,
    borderRadius: 12,
    elevation: 2,
  },
  card: {
    backgroundColor: "white",
    padding: 16,
    marginVertical: 8,
    borderRadius: 16,
    elevation: 2,
  },
  name: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 4,
    color: '#22186F',
  },
  actionsRow: {
    flexDirection: "row",
    marginTop: 12,
    gap: 12,
  },
  button: {
    padding: 10,
    borderRadius: 12,
  },
  viewButton: {
    backgroundColor: "#2563EB", 
  },
  editButton: {
    backgroundColor: "#10b981", // green
  },
  deleteButton: {
    backgroundColor: "#ef4444", // red
  },
});
