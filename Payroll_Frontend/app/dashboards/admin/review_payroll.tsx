import React, { useEffect, useState } from 'react';
import { View, Text,TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { getAccessToken } from '../../auth/index';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { BASE_URL } from "../../../config";

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

  const showAlert = (title: string, message: string) => {
      if (Platform.OS === "web") {
        window.alert(`${title}: ${message}`);
      } else {
        Alert.alert(title, message);
      }
    };

  // Fetch payroll data for employee and month
  const fetchPayroll = async () => {
    try {

      const token = await getAccessToken();
      setLoading(true);
      const response = await fetch(`${BASE_URL}/api/payroll/payroll/`,{
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
      showAlert('Error', error.message || 'Failed to load payroll data');
      router.back();
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    if (!employee_id || !month) {
      showAlert('Missing parameters', 'Employee ID and month are required');
      router.back();
      return;
    }
    fetchPayroll();
  }, []);

  const handleUpdate = async () => {
    if (reimbursementUpd === '') {
      showAlert('Validation Error', 'Please fill Reimbursement field');
      return;
    }

    const reimbursementValue = parseFloat(reimbursementUpd);
    if (isNaN(reimbursementValue)) {
      showAlert('Validation Error', 'Reimbursement must be a number');
      return;
    }

    try{
      const token = await getAccessToken();
      setLoading(true);

      const response = await fetch(`${BASE_URL}/api/payroll/generate/`, {
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
      
      showAlert('Success', 'Payroll updated successfully!');
      await fetchPayroll();
    } catch (error: any) {
      showAlert("Error", "Something went wrong.");
    } finally {
        setLoading(false);
    }
  };

  const handleGeneratePayslip = async (employee_id: string, month: string) => {
    try {
      setLoading(true);
      const token = await getAccessToken();
      const apiUrl = `${BASE_URL}/api/payroll/generate_payslip/?employee_id=${employee_id}&month=${month}`;
      
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
        if (Platform.OS === 'web') {
          const cleanedPdfData = pdfData.replace(/\s/g, ''); // Remove all whitespace characters
          // Step 1: Decode the cleaned base64 string to a binary string
          const binaryString = atob(cleanedPdfData); 
          // Step 2: Create a Uint8Array from the binary string
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
              bytes[i] = binaryString.charCodeAt(i);
          }
          // Step 3: Create a Blob from the Uint8Array
          const blob = new Blob([bytes], { type: 'application/pdf' });
          // Step 4: Create a URL for the Blob
          const blobUrl = URL.createObjectURL(blob);
          const fileName = `payslip_${employee_id}_${month}.pdf`;

          const confirmDownload = window.confirm(
            `${backendMessage}\n\nDo you want to download the payslip "${fileName}" ?`
          );

          if (confirmDownload) {
            // Step 5: Create a temporary link element and trigger the download
            const downloadLink = document.createElement('a');
            downloadLink.href = blobUrl;
            downloadLink.download = fileName;
            document.body.appendChild(downloadLink); // Append to body (important for some browsers)
            downloadLink.click();
            document.body.removeChild(downloadLink); // Clean up
          }

          URL.revokeObjectURL(blobUrl); // Release the object URL
          setTimeout(() => {
            router.push('/dashboards/admin/mng_payroll');
          }, 1000);

        } else {
          const fileUri = FileSystem.documentDirectory + `payslip_${employee_id}_${month}.pdf`;
          await FileSystem.writeAsStringAsync(fileUri, pdfData, { encoding: FileSystem.EncodingType.Base64 }); 
          Alert.alert(
            'Payslip Ready',
            `${backendMessage}\n\nWould you like to Download/Share ?`,
            [
              {
                text: "No",
                onPress: () => {
                  router.push('/dashboards/admin/mng_payroll'); // Navigate immediately if user chooses "No"
                },
                style: "cancel"
              },
              {
                text: "Download/Share",
                onPress: async () => {
                  try {
                    await Sharing.shareAsync(fileUri);
                  } catch (shareError: any) {
                    showAlert('Sharing Error', `Failed to open/share: ${shareError.message || 'Unknown error'}`);
                  }
                  // Navigate AFTER sharing attempt (success or failure)
                  router.push('/dashboards/admin/mng_payroll');
                }
              },
            ],
            { cancelable: false } // User must make a choice
          );
        }
      } else {
        showAlert('Error', 'Payslip PDF data not received from the server.');
      }

    } catch (error: any) {
      console.error(error);
      showAlert("Error", error.message || "Failed to generate or send payslip.");
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
        <View style={styles.formWrapper}>
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
  formWrapper: {
    width: "100%",
    ...(Platform.OS === "web"
      ? {
          maxWidth: 600,
          alignSelf: "center",
        }
      : {}),
  },
  headerTitle: { 
    fontSize: 22,
    fontWeight: '600',
    marginTop: Platform.OS === "web" ? 25 : 5, 
    marginBottom: Platform.OS === "web" ? 35 : 25,
    textAlign: "center", 
    color: '#22186F' 
  },
  content: { 
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
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
    gap: Platform.OS === "web" ? 400 : 120,
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
