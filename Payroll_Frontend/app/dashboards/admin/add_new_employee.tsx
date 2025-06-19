import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Alert,
  StyleSheet,
  Pressable,
  TouchableOpacity,
  Platform,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { getAccessToken } from "../../auth/index";

interface FormData {
  id: string;
  name: string;
  email: string;
  password: string;
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

const initialFormData: FormData = {
    id: "",
    name: "",
    email: "",
    password: "",
    gender: "M",
    account_type: "SBI",
    pan_no: "",
    phone_no: "",
    emergency_phone_no: "",
    address: "",
    employment_type: "full_time",
    role: "employee",
    designation: "",
    date_joined: null,
    fee_per_month: "",
    pay_structure: "fixed",
};

const AddEmployeeScreen = () => {
  
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const validateForm = () => {
    const {
      id,
      name,
      email,
      password,
      phone_no,
      emergency_phone_no,
      address,
      fee_per_month,
      pan_no,
      designation,
      date_joined,
    } = formData;

    const showAlert = (title: string, message: string) => {
      if (Platform.OS === "web") {
        window.alert(`${title}: ${message}`);
      } else {
        Alert.alert(title, message);
      }
    };

    if (!id || id.length !== 6) {
      showAlert("Validation Error", "Employee ID must be 6 characters.");
      return false;
    }

    if (!name.trim()) {
      showAlert("Validation Error", "Name is required.");
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      showAlert("Validation Error", "Please enter a valid email address.");
      return false;
    }

    if (!password || password.length < 4) {
      showAlert("Validation Error", "Password must be at least 4 characters.");
      return false;
    }

    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    if (!pan_no || !panRegex.test(pan_no)) {
      showAlert("Validation Error", "Invalid PAN number format.");
      return false;
    }

    const phoneRegex = /^\d{10}$/;
    if (!phone_no || !phoneRegex.test(phone_no)) {
      showAlert("Validation Error", "Phone number must be 10 digits.");
      return false;
    }

    if (!emergency_phone_no || !phoneRegex.test(emergency_phone_no)) {
      showAlert("Validation Error", "Emergency phone number must be 10 digits.");
      return false;
    }

    if (!address.trim()) {
      showAlert("Validation Error", "Address is required.");
      return false;
    }

    if (!designation.trim()) {
      showAlert("Validation Error", "Designation is required.");
      return false;
    }

    if (!fee_per_month || isNaN(Number(fee_per_month)) || Number(fee_per_month) < 0) {
      showAlert("Validation Error", "Fee per month must be a valid number >= 0.");
      return false;
    }

    if (!date_joined) {
      showAlert("Validation Error", "Please select the Date Joined.");
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    
    if (!validateForm()) return;

    const showAlert = (title: string, message: string) => {
      if (Platform.OS === "web") {
        window.alert(`${title}: ${message}`);
      } else {
        Alert.alert(title, message);
      }
    };

    try {

      const token = await getAccessToken(); 
      if (!token) {
        showAlert("Authentication Error", "You are not logged in.");
        return;
      }
      const response = await fetch("http://192.168.1.6:8000/api/employee/employees/", {
        method: "POST",
        headers: { "Content-Type": "application/json",'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          ...formData,
          date_joined: formData.date_joined?.toISOString().split("T")[0],
        }),
      });
      

      if (response.ok) {
        showAlert("Success", "Employee added successfully!");
        setFormData(initialFormData);
      } else {
        const error = await response.json();
        showAlert("Error", JSON.stringify(error));
      }
    } catch (error) {
      showAlert("Error", "Failed to submit employee data");
      console.error(error);
    }
  };

  const handleChange = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setFormData({ ...formData, [key]: value });
  };

  const formatDate = (date: Date | null) => {
    if (!date) return "Select a date";
    const d = date.getDate().toString().padStart(2, "0");
    const m = (date.getMonth() + 1).toString().padStart(2, "0");
    const y = date.getFullYear();
    return `${d}-${m}-${y}`;
  };

  const formatDateForInput = (date: Date | null) => {
    if (!date) return "";
    return date.toISOString().split("T")[0];
  };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.formWrapper}>
      <Text style={styles.heading}>Add New Employee</Text>

      {/* id */}
      <View>
        <Text style={styles.label}>Employee ID</Text>
        <TextInput
          style={styles.input}
          value={formData.id}
          onChangeText={(text) => handleChange("id", text)}
        />
      </View>

      {/* name */}
      <View>
        <Text style={styles.label}>Name</Text>
        <TextInput
          style={styles.input}
          value={formData.name}
          onChangeText={(text) => handleChange("name", text)}
        />
      </View>

      {/* email */}
      <View>
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          keyboardType="email-address"
          value={formData.email}
          onChangeText={(text) => handleChange("email", text)}
        />
      </View>

      {/* password */}
      <View>
        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          secureTextEntry
          value={formData.password}
          onChangeText={(text) => handleChange("password", text)}
        />
      </View>

      {/* gender */}
      <Text style={styles.label}>Gender</Text>
      <View style={styles.pickerWrapper}>
        <Picker
          selectedValue={formData.gender}
          onValueChange={(value) => handleChange("gender", value)}
          style={styles.picker}
        >
          <Picker.Item label="Male" value="M" />
          <Picker.Item label="Female" value="F" />
          <Picker.Item label="Other" value="O" />
        </Picker>
      </View>

      {/* account_type */}
      <Text style={styles.label}>Account Type</Text>
      <View style={styles.pickerWrapper}>
        <Picker
          selectedValue={formData.account_type}
          onValueChange={(value) => handleChange("account_type", value)}
          style={styles.picker}
        >
          <Picker.Item label="SBI" value="SBI" />
          <Picker.Item label="Non-SBI" value="NonSBI" />
        </Picker>
      </View>

      {/* pan_no */}
      <View>
        <Text style={styles.label}>PAN No</Text>
        <TextInput
          style={styles.input}
          value={formData.pan_no}
          onChangeText={(text) => handleChange("pan_no", text)}
        />
      </View>

      {/* phone_no */}
      <View>
        <Text style={styles.label}>Phone No</Text>
        <TextInput
          style={styles.input}
          keyboardType="phone-pad"
          value={formData.phone_no}
          onChangeText={(text) => handleChange("phone_no", text)}
        />
      </View>

      {/* emergency_phone_no */}
      <View>
        <Text style={styles.label}>Emergency Phone No</Text>
        <TextInput
          style={styles.input}
          keyboardType="phone-pad"
          value={formData.emergency_phone_no}
          onChangeText={(text) => handleChange("emergency_phone_no", text)}
        />
      </View>

      {/* address */}
      <View>
        <Text style={styles.label}>Address</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          multiline
          value={formData.address}
          onChangeText={(text) => handleChange("address", text)}
        />
      </View>

      {/* employment_type */}
      <Text style={styles.label}>Employment Type</Text>
      <View style={styles.pickerWrapper}>
        <Picker
          selectedValue={formData.employment_type}
          onValueChange={(value) => handleChange("employment_type", value)}
          style={styles.picker}
        >
          <Picker.Item label="Full Time" value="full_time" />
          <Picker.Item label="Part Time" value="part_time" />
        </Picker>
      </View>

      {/* role */}
      <Text style={styles.label}>Role</Text>
      <View style={styles.pickerWrapper}>
        <Picker
          selectedValue={formData.role}
          onValueChange={(value) => handleChange("role", value)}
          style={styles.picker}
        >
          <Picker.Item label="Admin" value="admin" />
          <Picker.Item label="HR" value="hr" />
          <Picker.Item label="Employee" value="employee" />
        </Picker>
      </View>

      {/* designation */}
      <View>
        <Text style={styles.label}>Designation</Text>
        <TextInput
          style={styles.input}
          value={formData.designation}
          onChangeText={(text) => handleChange("designation", text)}
        />
      </View>

      {/* date_joined */}
      <Text style={styles.label}>Date Joined</Text>
      {Platform.OS === "web" ? (
        <input
          type="date"
          value={formatDateForInput(formData.date_joined)}
          onChange={(e) => {
            const val = e.target.value;
            handleChange("date_joined", val ? new Date(val) : null);
          }}
          style={{
            padding: 12,
            borderWidth: "1px",
            borderStyle: "solid",
            borderColor: "#ccc",
            borderRadius: 6,
            fontSize: 16,
            width: "100%",    
            backgroundColor: "#fff",
            boxSizing: "border-box", 
          }}
        />
      ) : (
        <View style={styles.datePickerContainer}>
          <Pressable style={styles.datePicker} onPress={() => setShowDatePicker(true)}>
            <Text style={{ color: formData.date_joined ? "#000" : "#999" }}>
              {formatDate(formData.date_joined)}
            </Text>
          </Pressable>
          <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.calendarIcon}>
            <Ionicons name="calendar" size={28} color="#22186F" />
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={formData.date_joined || new Date()}
              mode="date"
              display="default"
              onChange={(event, selectedDate) => {
                setShowDatePicker(false);
                if (event.type === "set" && selectedDate) {
                  handleChange("date_joined", selectedDate);
                }
              }}
            />
          )}
        </View>
      )}

      {/* fee_per_month */}
      <View>
        <Text style={styles.label}>Fee per Month</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={formData.fee_per_month}
          onChangeText={(text) => handleChange("fee_per_month", text)}
        />
      </View>

      {/* pay_structure */}
      <Text style={styles.label}>Pay Structure</Text>
      <View style={styles.pickerWrapper}>
        <Picker
          selectedValue={formData.pay_structure}
          onValueChange={(value) => handleChange("pay_structure", value)}
          style={styles.picker}
        >
          <Picker.Item label="Fixed Pay" value="fixed" />
          <Picker.Item label="Variable Pay" value="variable" />
        </Picker>
      </View>

      <TouchableOpacity style={styles.buttonContainer} onPress={handleSubmit}>
        <Text style={styles.buttonText}>ADD</Text>
      </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: "#fff",
  },
  formWrapper: {
    width: "100%",
    ...(Platform.OS === "web"
      ? {
          maxWidth: 800,
          alignSelf: "center",
        }
      : {}),
  },
  heading: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#22186F",
    marginTop: Platform.OS === "web" ? 50 : 5,
    marginBottom: Platform.OS === "web" ? 50 : 30,
    textAlign: "center",
  },
  label: {
    fontWeight: "600",
    marginBottom: 6,
    marginTop: 14,
    color: "#333",
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
  datePickerContainer: {
    flexDirection: "row",
    alignItems: "center",
    //marginTop: 8,
    //marginBottom: 10,
  },
  datePicker: {
    flex: 1,
    padding: 12,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6,
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  calendarIcon: {
    marginLeft: 10,
  },
  buttonContainer: {
    marginTop: 30,
    marginBottom:30,
    backgroundColor: "#22186F",
    borderRadius: 10,
    overflow: "hidden",
    alignSelf: "center",
  },
  buttonText: {
    color: "#fff",
    textAlign: "center",
    paddingVertical: 10,
    paddingHorizontal: 20,
    fontSize: 16,
    fontWeight: "bold",
  },
});

export default AddEmployeeScreen;
