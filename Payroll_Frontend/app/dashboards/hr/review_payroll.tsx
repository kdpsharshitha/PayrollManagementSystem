import React, { useEffect, useState } from 'react';
import { View, Text,TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { getAccessToken } from '../../auth/index';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';


interface PayrollData {
  employee: string;
  month: string;
  base_pay_earned: number;
  perform_category: string;
  perform_comp_payable: number;
  fee_earned: number;
  tds: number;
  reimbursement: number;
  net_fee_earned: number;
}

const GenPayslipPage = () => {
  const router = useRouter();
  const params = useLocalSearchParams();

  const [payroll, setPayroll] = useState<PayrollData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [reimbursementUpd, setReimbursementUpd] = useState('');

  const employee_id = params.employee_id as string;
  const month = params.month as string;
  const formattedMonth = `${month}-01`;
  const perform_category = params.perform_category as string;

  // Fetch payroll data for employee and month
  const fetchPayroll = async () => {
    try {

      const token = await getAccessToken();
      setLoading(true);
      const response = await fetch(`http://192.168.1.6:8000/api/payroll/payroll/`,{
          method: 'GET',
          headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
          },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch payroll data');
      }

      const data = await response.json();
      const filtered = data.find((p: any) => p.employee.split(' - ')[0] === employee_id && p.month === formattedMonth);
      setPayroll(filtered);
      setReimbursementUpd(filtered.reimbursement.toString());
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load payroll data');
      router.back();
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    if (!employee_id || !month) {
      Alert.alert('Missing parameters', 'Employee ID and month are required');
      router.back();
      return;
    }
    fetchPayroll();
  }, []);

  const handleUpdate = async () => {
    if (reimbursementUpd === '') {
      Alert.alert('Validation Error', 'Please fill Reimbursement field');
      return;
    }
    try{
      const token = await getAccessToken();
      setLoading(true);

      const response = await fetch('http://192.168.1.6:8000/api/payroll/generate/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          employee_id: employee_id,
          month: month,
          perform_category: perform_category,
          reimbursement: parseFloat(reimbursementUpd),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update payroll');
      }
      
      Alert.alert('Success', 'Payroll updated successfully!');
      await fetchPayroll();
    } catch (error: any) {
      Alert.alert("Error", "Something went wrong.");
    } finally {
        setLoading(false);
    }
  };

  const handleGeneratePayslip = async (employee_id: string, month: string) => {
    try {
      setLoading(true);
      const token = await getAccessToken();
      const apiUrl = `http://192.168.1.6:8000/api/payroll/generate_payslip/?employee_id=${employee_id}&month=${month}`;
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate payslip from backend');
      }

      const responseData = await response.json();
      const pdfData = responseData.pdf_data; // This is the base64-like string from the backend
      const backendMessage = responseData.message; // The success message from the backend

      if (pdfData) {
        const fileUri = FileSystem.documentDirectory + `payslip_${employee_id}_${month}.pdf`;
        // Encode the Latin-1 string back to bytes for FileSystem.writeAsStringAsync
        const pdfDataB64 = btoa(pdfData);  
        await FileSystem.writeAsStringAsync(fileUri, pdfDataB64, { encoding: FileSystem.EncodingType.Base64 }); 
        Alert.alert('Success', backendMessage); // Display the message from the backend
        await Sharing.shareAsync(fileUri); // Opens the PDF
      } else {
        Alert.alert('Error', 'Payslip PDF data not received from the server.');
      }

    } catch (error: any) {
      console.error(error);
      Alert.alert("Error", error.message || "Failed to generate or send payslip.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#22186F" />
      </View>
    );
  }

  if (!payroll) {
    return (
      <View style={styles.centered}>
        <Text>No payroll data available.</Text>
      </View>
    );
  }

  return (
      <ScrollView style={styles.container}>
        <Text style={styles.headerTitle}>Review & Generate Payslip</Text>
        <View style={styles.content}>
          {/* Display payroll fields */}
          <View style={styles.fieldRow}>
            <Text style={styles.label}>Employee Id:</Text>
            <Text style={styles.value}>{payroll.employee.split(' - ')[0]}</Text>
          </View>
          <View style={styles.fieldRow}>
            <Text style={styles.label}>Month:</Text>
            <Text style={styles.value}>
              {(() => {
                const dateObj = new Date(payroll.month);
                const year = dateObj.getFullYear();
                const month = dateObj.getMonth() + 1; // Months are zero-based
                const formattedMonth = month < 10 ? `0${month}` : month;
                return `${year}-${formattedMonth}`;
              })()}
            </Text>
          </View>
          <View style={styles.fieldRow}>
            <Text style={styles.label}>Base Pay Earned:</Text>
            <Text style={styles.value}>{payroll.base_pay_earned}</Text>
          </View>
          <View style={styles.fieldRow}>
            <Text style={styles.label}>Performance Category:</Text>
            <Text style={styles.value}>{payroll.perform_category}</Text>
          </View>
          <View style={styles.fieldRow}>
            <Text style={styles.label}>Performance Component Payable:</Text>
            <Text style={styles.value}>{payroll.perform_comp_payable}</Text>
          </View>
          <View style={styles.fieldRow}>
            <Text style={styles.label}>Fee Earned:</Text>
            <Text style={styles.value}>{payroll.fee_earned}</Text>
          </View>
          <View style={styles.fieldRow}>
            <Text style={styles.label}>TDS:</Text>
            <Text style={styles.value}>{payroll.tds}</Text>
          </View>
          <View style={styles.fieldRow}>
            <Text style={styles.label}>Reimbursement:</Text>
            <TextInput
                    style={styles.textInput}
                    value={reimbursementUpd}
                    onChangeText={(text) => {
                      setReimbursementUpd(text);
                    }}
                    placeholder="Enter reimbursement amount (if any)"
                    keyboardType="numeric"
                  />
          </View>
          <View style={styles.fieldRow}>
            <Text style={styles.label}>Net Fee Earned:</Text>
            <Text style={styles.value}>{payroll.net_fee_earned}</Text>
          </View>
        </View>
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.updateButton} onPress={handleUpdate}>
            <Text style={styles.ButtonText}>Update</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.generateButton} onPress={()=>handleGeneratePayslip(employee_id, month)}>
            <Text style={styles.ButtonText}>Generate</Text>
          </TouchableOpacity>
        </View>
        
      </ScrollView>
    
  );
};

export default GenPayslipPage;

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#fff', 
    paddingTop: 10, 
    paddingHorizontal: 10,
  },
  headerTitle: { 
    fontSize: 22,
    fontWeight: '600', 
    marginBottom: 25,
    textAlign: "center", 
    color: '#22186F' 
  },
  content: { 
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 10,
  },
  label: { 
    fontWeight: '600', 
    fontSize: 16, 
    color: '#555', 
    flex: 1 
  },
  value: { 
    fontSize: 16,
    fontWeight: "600", 
    color: '#222', 
    flex: 1, 
    textAlign: 'right' 
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 25,
    gap: 120,
  },
  updateButton: {
    flex: 1,
    backgroundColor: '#2563EB',
    borderRadius: 10,
    alignSelf: 'center',
    overflow: 'hidden',
    paddingVertical: 12,
  },
  generateButton: {
    flex:1,
    backgroundColor: '#22186F',
    borderRadius: 10,
    overflow: 'hidden',
    alignSelf: "center",
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  ButtonText: { 
    color: '#fff',
    fontSize: 16, 
    fontWeight: 'bold', 
    textAlign: "center",
  },
  textInput: {
    width: 100,
    fontSize: 16,
    fontWeight: '600',
    color: '#222',
    textAlign: 'right',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingVertical: 6,
  },
  centered: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
});
