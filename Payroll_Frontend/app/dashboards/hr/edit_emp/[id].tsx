import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Alert,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  TouchableOpacity,
  Platform,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
//import * as SecureStore from "expo-secure-store";
import { getAccessToken } from "../../../auth/index";

interface FormData {
  id: string;  
  name: string;
  email: string;
  gender: "M" | "F" | "O";
  account_type: "SBI" | "NonSBI";
  pan_no: string;
  phone_no: string;
  emergency_phone_no: string;
  address: string;
  employment_type: "full_time" | "part_time";
  role: "admin" | "hr" | "employee";
  designation: string;
  date_joined: Date | null;
  fee_per_month: string;
  pay_structure: "fixed" | "variable";
}

const EditEmployeeScreen = () => {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [formData, setFormData] = useState<FormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const showAlert = (title: string, message: string) => {
          if (Platform.OS === "web") {
            window.alert(`${title}: ${message}`);
          } else {
            Alert.alert(title, message);
          }
  };


  useEffect(() => {
    const fetchEmployee = async () => {
      try {
        const token = await getAccessToken();
        const res = await fetch(`http://192.168.1.6:8000/api/employee/employees/${id}/`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = await res.json();
        setFormData({
          id: data.id,
          name: data.name,
          email: data.email,
          gender: data.gender,
          account_type: data.account_type,
          pan_no: data.pan_no,
          phone_no: data.phone_no,
          emergency_phone_no: data.emergency_phone_no,
          address: data.address,
          employment_type: data.employment_type,
          role: data.role,
          designation: data.designation,
          date_joined: new Date(data.date_joined),
          fee_per_month: data.fee_per_month.toString(),
          pay_structure: data.pay_structure,
        });
        
        setLoading(false);
      } catch (err) {
        showAlert("Error", "Could not load employee data.");
      }
    };
    fetchEmployee();
  }, [id]);

  const handleChange = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    if (formData) setFormData({ ...formData, [key]: value });
  };

  const validateForm = () => {
    if (!formData) return false;

    const phoneRegex = /^\d{10}$/;
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

    if (!formData.name.trim()) {
      showAlert("Validation Error", "Name is required.");
      return false;
    }
    if (!phoneRegex.test(formData.phone_no)) {
      showAlert("Validation Error", "Phone number must be 10 digits.");
      return false;
    }
    if (formData.emergency_phone_no && !phoneRegex.test(formData.emergency_phone_no)) {
      showAlert("Validation Error", "Emergency phone number must be 10 digits.");
      return false;
    }
    if (!formData.pan_no || !panRegex.test(formData.pan_no)) {
      showAlert("Validation Error", "Enter a valid 10-character PAN number.");
      return false;
    }
    if (!formData.designation.trim()) {
      showAlert("Validation Error", "Designation is required.");
      return false;
    }
    if (!formData.fee_per_month || isNaN(Number(formData.fee_per_month))) {
      showAlert("Validation Error", "Fee per month must be a valid number.");
      return false;
    }
    if (!formData.date_joined) {
      showAlert("Validation Error", "Please select the joining date.");
      return false;
    }

    return true;
  };

  const handleUpdate = async () => {
    if (!validateForm()) return;

    try {
      const token = await getAccessToken();
      const res = await fetch(`http://192.168.1.6:8000/api/employee/employees/${id}/`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          date_joined: formData!.date_joined?.toISOString().split("T")[0],
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        showAlert("Update Failed", JSON.stringify(err));
      } else {
        showAlert("Success", "Employee updated successfully!");
      }
    } catch (error) {
      showAlert("Error", "Something went wrong.");
    }
  };

  const formatDate = (date: Date | null) =>
    date ? `${date.getDate()}-${date.getMonth() + 1}-${date.getFullYear()}` : "Select a date";

  const formatDateForWebInput = (date: Date | null) => {
    if (!date) return "";
    return date.toISOString().split("T")[0];
  };

  if (loading || !formData) {
    return <ActivityIndicator style={{ flex: 1 }} size="large" />;
  }

  return (
    <ScrollView style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Ionicons name="arrow-back" size={20} color="#22186F" />
      </TouchableOpacity>

      <View style={styles.formWrapper}>
      <Text style={styles.heading}>Edit Employee Details</Text>

      <Text style={styles.label}>Employee ID</Text>
      <TextInput style={[styles.input, { backgroundColor: "#f0f0f0" }]} value={formData.id} editable={false} />

      <Text style={styles.label}>Name</Text>
      <TextInput style={styles.input} value={formData.name} onChangeText={(v) => handleChange("name", v)} />

      <Text style={styles.label}>Email</Text>
      <TextInput style={[styles.input, { backgroundColor: "#f0f0f0" }]} value={formData.email} editable={false} />

      <Text style={styles.label}>Gender</Text>
      <View style={styles.pickerWrapper}>
        <Picker style={styles.picker} selectedValue={formData.gender} onValueChange={(v) => handleChange("gender", v)}>
            <Picker.Item label="Male" value="M" />
            <Picker.Item label="Female" value="F" />
            <Picker.Item label="Other" value="O" />
        </Picker>
      </View>
      

      <Text style={styles.label}>Account Type</Text>
      <View style={styles.pickerWrapper}>
        <Picker style={styles.picker} selectedValue={formData.account_type} onValueChange={(v) => handleChange("account_type", v)}>
            <Picker.Item label="SBI" value="SBI" />
            <Picker.Item label="Non-SBI" value="NonSBI" />
        </Picker>
      </View>
      

      <Text style={styles.label}>PAN No</Text>
      <TextInput style={styles.input} value={formData.pan_no} onChangeText={(v) => handleChange("pan_no", v)} />

      <Text style={styles.label}>Phone No</Text>
      <TextInput style={styles.input} value={formData.phone_no} onChangeText={(v) => handleChange("phone_no", v)} />

      <Text style={styles.label}>Emergency Phone No</Text>
      <TextInput
        style={styles.input}
        value={formData.emergency_phone_no}
        onChangeText={(v) => handleChange("emergency_phone_no", v)}
      />

      <Text style={styles.label}>Address</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        multiline
        value={formData.address}
        onChangeText={(v) => handleChange("address", v)}
      />

      <Text style={styles.label}>Employment Type</Text>
      <View style={styles.pickerWrapper}>
        <Picker style={styles.picker} selectedValue={formData.employment_type} onValueChange={(v) => handleChange("employment_type", v)}>
            <Picker.Item label="Full Time" value="full_time" />
            <Picker.Item label="Part Time" value="part_time" />
        </Picker>
      </View>
      

      <Text style={styles.label}>Role</Text>
      <TextInput style={[styles.input, { backgroundColor: "#f0f0f0" }]} value={formData.role} editable={false} />
      

      <Text style={styles.label}>Designation</Text>
      <TextInput style={styles.input} value={formData.designation} onChangeText={(v) => handleChange("designation", v)} />

      <Text style={styles.label}>Date Joined</Text>
      <TextInput style={[styles.input, { backgroundColor: "#f0f0f0" }]} value={formData.date_joined ? formData.date_joined.toISOString().split('T')[0] : ''} editable={false} />

      <Text style={styles.label}>Fee Per Month</Text>
      <TextInput
        style={styles.input}
        keyboardType="numeric"
        value={formData.fee_per_month}
        onChangeText={(v) => handleChange("fee_per_month", v)}
      />

      <Text style={styles.label}>Pay Structure</Text>
      <View style={styles.pickerWrapper}>
        <Picker style={styles.picker} selectedValue={formData.pay_structure} onValueChange={(v) => handleChange("pay_structure", v)}>
            <Picker.Item label="Fixed Pay" value="fixed" />
            <Picker.Item label="Variable Pay" value="variable" />
        </Picker>
      </View>
      

      <Pressable style={styles.button} onPress={() => {
        if (Platform.OS === "web") {
          const confirmed = window.confirm("Are you sure you want to edit this employee's details?");
          if (confirmed) handleUpdate();
        } else {
          Alert.alert(
            "Confirm Update",
            "Are you sure you want to edit this employee's details?",
            [
              { text: "Cancel", style: "cancel" },
              { text: "Update", onPress: handleUpdate },
            ]
          );
        }
      }}
      >
        <Text style={styles.buttonText}>Update</Text>
      </Pressable>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, paddingTop: 20,paddingHorizontal: 10, backgroundColor: "#fff" },
  heading: { fontSize: 24, fontWeight: "bold", marginBottom: Platform.OS === "web" ? 30 : 20,textAlign: "center",color: "#22186F", },
  label: { marginTop: 14,marginBottom: 4,fontWeight: "600", fontSize: 16,color: "#333", },
  formWrapper: {
    width: "100%",
    ...(Platform.OS === "web"
      ? {
          maxWidth: 800,
          alignSelf: "center",
        }
      : {}),
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 12,
    borderRadius: 6,
    backgroundColor: "#fff",
    fontSize: 16,
  },
  multiline: {
    height: 100,
    textAlignVertical: "top",
  },
  dateInput: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 12,
    borderRadius: 6,
    backgroundColor: "#fff",
  },
  button: {
    backgroundColor: "#22186F",
    padding: 14,
    borderRadius: 10,
    marginTop: 30,
    marginBottom: 50,
    overflow: "hidden",
    alignSelf: "center",
  },
  buttonText: { color: "#fff",textAlign: "center",paddingHorizontal: 20, fontSize: 16, fontWeight: "bold" },
  pickerWrapper: {
    borderWidth: Platform.OS === "web" ? 0 : 1,
    borderColor: "#ccc",
    borderRadius: 6,
    backgroundColor: "#fff",
    //marginBottom: 8,
    //marginTop: 5,
  },
  picker: {
    borderColor: "#ccc",
    height: 50,
    width: "100%",
    borderRadius: 6,
    borderWidth: 1,
  },
  backButton: {
    marginBottom: 12,
    width: 30,
    height: 30,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 20,
    backgroundColor: "#e1e4ee",
    alignSelf: "flex-start",
  },
});

export default EditEmployeeScreen;
