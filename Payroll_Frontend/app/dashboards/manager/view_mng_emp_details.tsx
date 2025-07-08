import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  TextInput,
  StyleSheet,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons, Feather, MaterialIcons } from "@expo/vector-icons";
//import * as SecureStore from "expo-secure-store";
import { getAccessToken } from "../../auth/index";
import { BASE_URL } from "../../../config";

type Employee = {
  id: string;
  name: string;
  email: string;
  role: string;
  designation: string;
  phone_no: string;
  supervisor: string;
};

export default function EmployeeManagementScreen() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState("");
  const router = useRouter();
  const [loggedInEmployeeId, setLoggedInEmployeeId] = useState<string | null>(null);

  useEffect(() => {
    const fetchLoggedInEmployeeInfo = async () => {
      const token = await getAccessToken();

      const response = await fetch(`${BASE_URL}/api/employee/me/`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log(data.id);
        setLoggedInEmployeeId(data.id);
      }
    };

    fetchLoggedInEmployeeInfo();
  }, []);

  useEffect(() => {
    if(loggedInEmployeeId){
      fetchEmployees();
    }
  }, [loggedInEmployeeId]);

  const showAlert = (title: string, message: string) => {
          if (Platform.OS === "web") {
            window.alert(`${title}: ${message}`);
          } else {
            Alert.alert(title, message);
          }
  };

  const fetchEmployees = async () => {
    try {
      const token = await getAccessToken();
      if (!token) {
        showAlert("Authentication Error", "You are not logged in.");
        return;
      }

      const res = await fetch(`${BASE_URL}/api/employee/employees/`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error("Failed to fetch");
      }

      const data = await res.json();
      const filtered = data.filter((emp: Employee) => emp.role === "employee" && emp.supervisor && emp.supervisor.split("-")[0] === loggedInEmployeeId)
      .sort((a: Employee, b: Employee) => Number(a.id) - Number(b.id));
      setEmployees(filtered);
    } catch (error) {
      console.error("Failed to fetch employees:", error);
    }
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
              pathname: "/dashboards/manager/view_emp/[id]",
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
              pathname: "/dashboards/manager/edit_emp/[id]",
              params: { id: item.id },
            })
          }
          style={[styles.button, styles.editButton]}
        >
          <Feather name="edit" size={15} color="white" />
        </TouchableOpacity>

      </View>
    </View>
  );

  return (
    <View style={styles.outerWrapper}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    flex: 1,
    backgroundColor: "#fff", // light gray
    paddingHorizontal: 8,
    paddingTop: 16,
  },
  outerWrapper: {
    flex: 1,
    alignItems: "center", // center content on wide screens
    backgroundColor: "#fff",
  },
  searchBox: {
    backgroundColor: "white",
    padding: 12,
    marginTop: Platform.OS === "web" ? 20 : 10,
    marginBottom: Platform.OS === "web" ? 20 : 12,
    borderRadius: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    alignSelf: "center",       // center search box
    width: "100%",
    maxWidth: 800,
  },
  card: {
    backgroundColor: "white",
    padding: 16,
    marginVertical: 8,
    borderRadius: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    alignSelf: "center",       // center card in wide screens
    width: "100%",
    maxWidth: 800,
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
