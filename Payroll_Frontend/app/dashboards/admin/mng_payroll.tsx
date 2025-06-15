import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';
import { getAccessToken } from '../../auth/index';

interface Employee {
  id: string;
  name: string;
  date_joined: Date | null;
  pay_structure: "fixed" | "variable";
  role: "admin" | "hr" | "employee"; 
}

type EmployeeDropdownItem = {
  label: string;
  value: string;
  payStructure: "fixed" | "variable";
  dateJoined: Date | null;
};

const MngPayrollPage = () => {
  const [employees, setEmployees] = useState<EmployeeDropdownItem[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<EmployeeDropdownItem[]>([]); // New state for filtered list
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState(''); // New state for search input
  const [selectedEmployeeLabel, setSelectedEmployeeLabel] = useState<string | null>(null); // To display selected employee name
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [selectedEmployeePayStructure, setSelectedEmployeePayStructure] = useState<"fixed" | "variable" | null>(null);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [displayMonth, setDisplayMonth] = useState('');
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [loggedInEmployeeId, setLoggedInEmployeeId] = useState<string | null>(null);
  const [performanceCategory, setPerformanceCategory] = useState<string | null>(null);
  const [reimbursement, setReimbursement] = useState('');
  const [employeeDateJoined, setEmployeeDateJoined] = useState<Date | null>(null); 
  const [errorMessage, setErrorMessage] = useState<string | null>(null); // New state for error message

  const router = useRouter();

  useEffect(() => {
    const fetchLoggedInEmployeeId = async () => {
      const token = await getAccessToken();

      const response = await fetch('http://192.168.1.6:8000/api/employee/me/', {
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

    fetchLoggedInEmployeeId();
  }, []);


  useEffect(() => {
    const fetchEmployees = async () => {
      if (!loggedInEmployeeId) return;
      try {
        const token = await getAccessToken();

        const response = await fetch('http://192.168.1.6:8000/api/employee/employees/', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();

        const formattedEmployees = data.filter((emp: Employee) => emp.id !== loggedInEmployeeId).sort((a: Employee, b: Employee) =>
            a.id.toString().localeCompare(b.id.toString(), undefined, { numeric: true })
        ).map((emp: Employee) => ({
            label: `${emp.id} - ${emp.name} - ${emp.role}`,
            value: emp.id,
            payStructure: emp.pay_structure,
            dateJoined: emp.date_joined,
        }));
        
        setEmployees(formattedEmployees);
      } catch (error: any) {
        console.error('Failed to fetch employees:', error.message);
        Alert.alert('Error', 'Unable to load employees');
      }
    };

    fetchEmployees();
  }, [loggedInEmployeeId]);

  // Effect to filter employees based on search query
  useEffect(() => {
    if (employeeSearchQuery) {
      const lowerCaseQuery = employeeSearchQuery.toLowerCase();
      const filtered = employees.filter(emp =>
        emp.label.toLowerCase().includes(lowerCaseQuery)
      );
      setFilteredEmployees(filtered);
    } else {
      setFilteredEmployees(employees); // Show all if search query is empty
    }
  }, [employeeSearchQuery, employees]);

  const handleEmployeeSelect = (employee: EmployeeDropdownItem) => {
    setSelectedEmployee(employee.value);
    setSelectedEmployeeLabel(employee.label); // Set the name to display
    setSelectedEmployeePayStructure(employee.payStructure);
    setEmployeeDateJoined(employee.dateJoined);
    setEmployeeSearchQuery(employee.label); // Set the search input to the selected employee's label
    setFilteredEmployees([]); // Clear filtered results after selection
    setErrorMessage(null);
  };

  const handleSubmit = async () => {
    // Clear previous error message
    setErrorMessage(null);

    if (!selectedEmployee) {
      Alert.alert('Validation Error', 'Please select valid Employee');
      return;
    }

    if (!selectedMonth || !performanceCategory || reimbursement === '') {
      Alert.alert('Validation Error', 'Please fill all fields');
      return;
    }

    if (selectedEmployeePayStructure === 'fixed' && performanceCategory !== 'NA') {
      Alert.alert('Validation Error', 'Invalid!! "Not Applicable (NA)" is only allowed for employees with Fixed Pay Structure.');
      return;
    }

    if (selectedEmployeePayStructure === 'variable' && performanceCategory === 'NA') {
      Alert.alert('Validation Error', 'Invalid!! "Not Applicable (NA)" is not allowed for employees with Variable Pay Structure.');
      return;
    }

    // Date validation
    if (employeeDateJoined) {
      const selectedMonthDate = new Date(selectedMonth + '-01'); // Create date object from selectedMonth
      const joinDate = new Date(employeeDateJoined);
      const currentDate = new Date();
      const currentMonthYear = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}`;
      const selectedMonthYear = `${selectedMonthDate.getFullYear()}-${(selectedMonthDate.getMonth() + 1).toString().padStart(2, '0')}`;
      const joinMonthYear = `${joinDate.getFullYear()}-${(joinDate.getMonth() + 1).toString().padStart(2, '0')}`;

      if (selectedMonthYear < joinMonthYear || selectedMonthYear > currentMonthYear) {
        Alert.alert(
          'Validation Error',
          'Invalid!! Selected month must be between the employee\'s joined month and the current month.',
        );
        return;
      }
    }

    try {
      const token = await getAccessToken();

      const response = await fetch('http://192.168.1.6:8000/api/payroll/generate/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          employee_id: selectedEmployee,
          month: selectedMonth,
          perform_category: performanceCategory,
          reimbursement: parseFloat(reimbursement),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        // Check if the backend sent a specific error message
        if (errorData && errorData.error) {
          setErrorMessage(errorData.error); // Set the error message to display
        } else {
          setErrorMessage(errorData?.detail || 'Failed to generate payroll'); // Fallback error
        }
        console.error('Payroll generation failed:', errorData);
        return; 
      }

      Alert.alert('Success', 'Payroll generated successfully!');
      router.push({
        pathname: '/dashboards/admin/review_payroll',
        params: {
          employee_id: selectedEmployee,
          month: selectedMonth,
          perform_category: performanceCategory,
        },
      }); 
    } catch (error: any) {
      setErrorMessage(error.message);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Calculate Monthly Payroll</Text>

      <Text style={styles.label}>Select Employee:</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter Employee ID or Name"
        value={employeeSearchQuery}
        onChangeText={(text) => {
          setEmployeeSearchQuery(text);
          setSelectedEmployee(null); // Clear selection when typing
          setSelectedEmployeeLabel(null);
          setSelectedEmployeePayStructure(null);
          setEmployeeDateJoined(null);
          setErrorMessage(null);
        }}
        onFocus={() => {
          setFilteredEmployees(employees);
        }}
      />
      {employeeSearchQuery.length > 0 && filteredEmployees.length > 0 && selectedEmployee === null && (
        <View style={styles.searchResultsContainer}>
          {filteredEmployees.map((item) => (
            <TouchableOpacity
              key={item.value}
              style={styles.searchResultItem}
              onPress={() => handleEmployeeSelect(item)}
            >
              <Text style={styles.searchResultText}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      {selectedEmployee && ( // Display selected employee clearly
        <Text style={styles.selectedEmployeeText}>Selected: {selectedEmployeeLabel}</Text>
      )}

      <Text style={styles.label}>Select Month:</Text>
      <TouchableOpacity onPress={() => setShowMonthPicker(true)} style={styles.calendarButton}>
        <Ionicons name="calendar" size={24} color="#22186F" />
        <Text style={styles.calendarText}>
          {displayMonth || '-- Select Month --'}
        </Text>
      </TouchableOpacity>

      {showMonthPicker && (
        <DateTimePicker
          mode="date"
          value={new Date()}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, selectedDate) => {
            setShowMonthPicker(false);
            if (selectedDate) {
              const month = (selectedDate.getMonth() + 1).toString().padStart(2, '0');
              const year = selectedDate.getFullYear();
              const formatted = `${year}-${month}`;
              const display = selectedDate.toLocaleString('default', { month: 'long' }) + ' ' + year;

              setSelectedMonth(formatted); // sent to backend
              setDisplayMonth(display); // displayed in UI

              setErrorMessage(null);
            }
          }}
        />
      )}

      <Text style={styles.label}>Performance Category:</Text>
      <View style={styles.pickerContainer}>
        <Picker
          selectedValue={performanceCategory}
          onValueChange={(itemValue) => {setPerformanceCategory(itemValue);setErrorMessage(null);}}
          style={styles.picker}
        >
          <Picker.Item label="-- Select Performance --" value={null} />
          <Picker.Item label="Exceeds Expectations (E)" value="1" />
          <Picker.Item label="Meets Expectations (M)" value="2" />
          <Picker.Item label="Partially Meets Expectations (PM)" value="3" />
          <Picker.Item label="Below Expectations (BE)" value="4" />
          <Picker.Item label="Not Applicable (NA)" value="NA" />
        </Picker>
      </View>

      <Text style={styles.label}>Reimbursement:</Text>
      <TextInput
        style={styles.input}
        value={reimbursement}
        onChangeText={(text) => {
          setReimbursement(text);
          setErrorMessage(null); // Clear error when reimbursement changes
        }}
        placeholder="Enter reimbursement amount (if any)"
        keyboardType="numeric"
      />

      {/* Display error message here */}
      {errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}


      <TouchableOpacity onPress={handleSubmit} style={styles.submitButton}>
        <Text style={styles.submitText}>Calculate</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

export default MngPayrollPage;

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#fff',
    marginTop:20,
  },
  heading: {
    fontSize: 24,
    fontWeight: 'bold',
    color: "#22186F",
    marginBottom: 20,
    textAlign: "center",
  },
  label: {
    fontWeight: "600",
    fontSize: 16,
    marginTop: 15,
    marginBottom: 5,
    color: "#333",
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    backgroundColor: '#fff',
    marginBottom: 8,
    marginTop: 2,
  },
  picker: {
    borderColor: "#ccc",
    width: "100%",
  },
  calendarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    marginBottom: 8,
    padding: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    height: 55, 
  },
  calendarText: {
    marginLeft: 10,
    fontSize: 16,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 12,
    borderRadius: 6,
    fontSize: 16,
    backgroundColor: '#fff',
    height: 55,
    marginTop:2,
  },
  submitButton: {
    backgroundColor: '#22186F',
    marginTop: 30,
    borderRadius: 10,
    overflow: "hidden",
    alignSelf: "center",
  },
  submitText: {
    color: '#fff',
    fontSize: 16,
    textAlign: "center",
    paddingVertical: 10,
    paddingHorizontal: 20,
    fontWeight: "bold",
  },
  errorText: { // New style for error message
    color: 'red',
    marginTop: 10,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  // New styles for the search functionality
  searchResultsContainer: {
    maxHeight: 200, // Limit the height of the results
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    backgroundColor: '#fff',
    marginTop: 5,
    marginBottom: 10,
    elevation: 2, // For Android shadow
    shadowColor: '#000', // For iOS shadow
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  searchResultItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  searchResultText: {
    fontSize: 16,
    color: '#333',
  },
  selectedEmployeeText: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#22186F',
    textAlign: 'center',
    padding: 8,
    backgroundColor: '#e0f7fa',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#b2ebf2',
  },
});
