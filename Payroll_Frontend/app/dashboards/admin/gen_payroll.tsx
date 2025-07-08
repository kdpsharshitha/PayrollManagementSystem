// pages/dashboards/admin/new_mng_payroll.tsx
import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Platform, Alert, ActivityIndicator
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import Checkbox from 'expo-checkbox';
import { Picker } from '@react-native-picker/picker';
import { getAccessToken } from '../../auth/index';
import { BASE_URL } from '../../../config';
import { Linking } from 'react-native'; // Import Linking for opening URLs


const NewMngPayroll = () => {
  const [selectedMonth, setSelectedMonth] = useState('');
  const [employees, setEmployees] = useState<any[]>([]);
  const [uploadFiles, setUploadFiles] = useState<{[id:string]: any}>({});
  const [confirmUpload, setConfirmUpload] = useState<{[id:string]: boolean}>({});
  const [formDataPerEmp, setFormDataPerEmp] = useState<{[id:string]: any}>({});
  const [payrollExists, setPayrollExists] = useState(false); // New state to track if payroll exists
  const [loading, setLoading] = useState(false); // New state for loading indicator
  const [submitting, setSubmitting] = useState(false);
  const [emailSubmitting, setEmailSubmitting] = useState(false);
  const [individualEmailSubmitting, setIndividualEmailSubmitting] = useState<{[id: string]: boolean}>({}); // To track individual email submission status

  const showAlert = (title: string, message: string) => {
          if (Platform.OS === "web") {
            window.alert(`${title}: ${message}`);
          } else {
            Alert.alert(title, message);
          }
        };

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonthNum = today.getMonth() + 1; 
  const currentMonthStr = `${currentYear}-${currentMonthNum < 10 ? '0' : ''}${currentMonthNum}`;

  const isValidMonth = (val: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(val);

  const validateSelectedMonth = (month: string) => {
    if (!month) {
      return { isValid: false, message: '' }; // No month selected yet, or initial state
    }
    if (!isValidMonth(month)) {
      return { isValid: false, message: 'Enter valid month (YYYY-MM).' };
    }
    // Check if selected month is in the future
    if (month > currentMonthStr) {
      return { isValid: false, message: 'Cannot select a future month.' };
    }
    return { isValid: true, message: '' }; // Month is valid
  };

  const monthValidation = validateSelectedMonth(selectedMonth);

  const fetchEmployees = async () => {

    if (!monthValidation.isValid && selectedMonth) { 
      setEmployees([]);
      setPayrollExists(false); 
      // No need for showAlert here, the message will be displayed in JSX
      return;
    }
    
    if (!selectedMonth) {
        setEmployees([]);
        setPayrollExists(false);
        return;
    }

    setLoading(true); // Start loading
    const token = await getAccessToken();
    try {
      const res = await fetch(`${BASE_URL}/api/payroll/monthly-employees/?month=${selectedMonth}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        // Handle cases where the endpoint might return 404 or other errors
        // if no employees or payroll data for the month
        if (res.status === 404 || res.status === 204) { // Assuming 204 No Content for no data
          setEmployees([]);
          setPayrollExists(false);
          showAlert('Info', `No payroll data found for ${selectedMonth}.`);
          return;
        }
        throw new Error(`Failed to load employees/payroll: ${res.status}`);
      }

      const data = await res.json();
      setEmployees(data.employees || []); // Assuming the backend sends {employees: [...]}
      setPayrollExists(data.payroll_exists || false); // Assuming backend sends {payroll_exists: true/false}

      // Populate formDataPerEmp with existing payroll data if it exists
      if (data.payroll_data && data.payroll_data.length > 0) {
        const initialFormData: {[id: string]: any} = {};
        data.payroll_data.forEach((payroll: any) => {
          initialFormData[String(payroll.employee_id_read)] = { // Assuming payroll.employee is the employee ID
            perform_category: payroll.perform_category,
            reimbursement: payroll.reimbursement.toString(),
            reimbursement_proof_url: payroll.reimbursement_proof, // Store the URL
          };
          console.log(`fetchEmployees - Storing reimbursement_proof_url for Employee ${payroll.employee}:`, payroll.reimbursement_proof);
        });
        console.log("fetchEmployees - Final initialFormData before setting:", initialFormData); // Another good existing log
        setFormDataPerEmp(initialFormData);
      } else {
        // Clear previous form data if no payroll exists for the new month
        setFormDataPerEmp({});
      }

    } catch (err) {
      console.error("Error fetching employees/payroll:", err);
      showAlert('Error', `Failed to load employees/payroll data: ${err instanceof Error ? err.message : String(err)}`);
      setEmployees([]);
      setPayrollExists(false);
      setFormDataPerEmp({});
    } finally {
      setLoading(false); // End loading
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, [selectedMonth]);

  const handleUpload = async (id: string) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf' });
      if (result.canceled === false && result.assets && result.assets.length > 0) {
        const pickedFile = result.assets[0];
        console.log("Picked File:", pickedFile); // Log to see the structure
        setUploadFiles(u => ({ ...u, [id]: pickedFile }));
        setConfirmUpload(c => ({ ...c, [id]: false }));
      } else {
        console.log("Document picking cancelled or no assets selected.");
      }
    } catch (err) {
      console.error("Error picking document:", err);
      showAlert("Error", "Failed to pick document.");
    }
  };

  const handleOpenProof = async (url: string) => {
    try {
      if (url) {
        const supported = await Linking.canOpenURL(url);
        if (supported) {
          await Linking.openURL(url);
        } else {
          showAlert('Error', `Cannot open URL: ${url}`);
        }
      } else {
        showAlert('Info', 'No proof URL available.');
      }
    } catch (error) {
      console.error('Error opening proof:', error);
      showAlert('Error', 'Failed to open proof.');
    }
  };

  const handleSubmit = async () => {
    if (submitting || emailSubmitting) return; // Prevent double submission
    if (payrollExists) { // Prevent submission if payroll already exists
      showAlert('Info', 'Payroll already generated for this month. You cannot submit again.');
      return;
    }
    if (!monthValidation.isValid) {
        showAlert('Validation Error', monthValidation.message);
        return;
    }

    setSubmitting(true); // Start submitting

    const token = await getAccessToken();
    const monthDateStr = selectedMonth;

    for (let emp of employees) {
      const e = formDataPerEmp[emp.id] || {};
      const perf = e.perform_category || emp.perform_category;
      const reimb = parseFloat(e.reimbursement ?? emp.reimbursement);

      if (!perf) {
        showAlert('Validation', `Select performance for Employee: ${emp.id}`);
        setSubmitting(false); 
        return;
      }

      const employeePayStructure = emp.pay_structure; // Get pay structure from employee object

      if (employeePayStructure === 'fixed' && perf !== 'NA') {
        showAlert('Validation Error', `Invalid! For Employee: ${emp.id}, "Not Applicable (NA)" is the only allowed Performance Category.`);
        setSubmitting(false); 
        return;
      }

      if (employeePayStructure === 'variable' && perf === 'NA') {
        showAlert('Validation Error', `Invalid! For Employee: ${emp.id}, "Not Applicable (NA)" is not allowed as Performance Category.`);
        setSubmitting(false); 
        return;
      }

      if (isNaN(reimb)) {
        showAlert('Validation Error', `Reimbursement must be a number for Employee: ${emp.id}`);
        setSubmitting(false); 
        return;
      }

      if (reimb > 0) {
        if (!uploadFiles[emp.id]) {
          showAlert('Validation', `Upload proof for Employee: ${emp.id}`);
          setSubmitting(false); 
          return;
        }
        if (!confirmUpload[emp.id]) {
          showAlert('Validation', `Confirm upload for Employee: ${emp.id}`);
          setSubmitting(false); 
          return;
        }
      }

      const fd = new FormData();
      fd.append('employee_id', emp.id);
      fd.append('month', monthDateStr);
      fd.append('perform_category', perf);
      fd.append('reimbursement', reimb.toString());

      if (reimb > 0 && uploadFiles[emp.id]) {
        const f = uploadFiles[emp.id];
        console.log("File object being appended:", f);
        if (f.uri.startsWith('data:')) {
          try {
            const base64Content = f.uri.split(',')[1];
            // Convert base64 to a Blob
            const blob = await new Promise<Blob>((resolve, reject) => {
              const byteCharacters = atob(base64Content);
              const byteNumbers = new Array(byteCharacters.length);
              for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
              }
              const byteArray = new Uint8Array(byteNumbers);
              resolve(new Blob([byteArray], { type: f.mimeType || 'application/pdf' }));
            });

            // Append the Blob as a File (with filename)
            fd.append('reimbursement_proof', blob, f.name); // <--- Append Blob directly with filename

          } catch (error) {
            console.error("Error converting Data URI to Blob:", error);
            showAlert("Error", `Failed to upload proof for Employee: ${emp.id}.`);
            setSubmitting(false); 
            return;
          }
        } else {
          // This path handles regular file:// or content:// URIs
          const fileType = f.mimeType || f.type || 'application/pdf';
          fd.append('reimbursement_proof', {
            uri: f.uri,
            name: f.name,
            type: fileType,
          } as any);
        }
      
      }

      try {
        const res = await fetch(`${BASE_URL}/api/payroll/generate/`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        if (!res.ok) {
          const errorText = await res.text();
          console.error("Server Response Error:", errorText);
          throw new Error(`Failed at Employee: ${emp.id}: ${errorText}`);
        }
      } catch (err) {
            if (err instanceof Error) {
                showAlert('Error', err.message);
            } else {
                showAlert('Error', 'Something went wrong');
            }
            setSubmitting(false);
            return;
        }
    }

    showAlert('Success', 'Payroll submitted');
    await fetchEmployees();
    setSubmitting(false);
  };

  // NEW: handleEmailPayslips function
  const handleEmailPayslips = async () => {
    if (emailSubmitting || submitting) return; // Prevent double submission or concurrent payroll generation
    if (!payrollExists) {
      showAlert('Info', 'Payroll has not been generated for this month yet.');
      return;
    }
    if (!monthValidation.isValid) {
      showAlert('Validation Error', monthValidation.message);
      return;
    }

    setEmailSubmitting(true);
    const token = await getAccessToken();
    const monthStr = selectedMonth;
    let successCount = 0;
    let failCount = 0;
    let failedEmployees: string[] = [];

    for (const emp of employees) {
      try {
        
        const res = await fetch(`${BASE_URL}/api/payroll/generate_payslip/?employee_id=${emp.id}&month=${monthStr}`, {
          method: 'GET', 
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          const errorText = await res.text();
          console.error(`Failed to email payslip for Employee ${emp.id}:`, errorText);
          failCount++;
          failedEmployees.push(emp.name || emp.id);
        } else {
          successCount++;
        }
      } catch (error) {
        console.error(`Error emailing payslip for Employee ${emp.id}:`, error);
        failCount++;
        failedEmployees.push(emp.name || emp.id);
      }
    }

    setEmailSubmitting(false);

    if (successCount > 0 && failCount === 0) {
      showAlert('Success', `Successfully emailed payslips to all ${successCount} employees.`);
    } else if (successCount > 0 && failCount > 0) {
      showAlert('Partial Success', `Emailed payslips to ${successCount} employees. Failed for ${failCount} employees: ${failedEmployees.join(', ')}.`);
    } else {
      showAlert('Error', `Failed to email payslips to any employee. Please try again. Failed for: ${failedEmployees.join(', ')}`);
    }
  };

  const emailPayslipForEmployee = async (employeeId: string, employeeName: string) => {
    if (submitting || individualEmailSubmitting[employeeId]) return;

    if (!payrollExists) {
      showAlert('Info', 'Payroll has not been generated for this month yet.');
      return;
    }
    if (!monthValidation.isValid) {
      showAlert('Validation Error', monthValidation.message);
      return;
    }

    setIndividualEmailSubmitting(prev => ({ ...prev, [employeeId]: true }));
    const token = await getAccessToken();
    const monthStr = selectedMonth;

    try {
      const res = await fetch(`${BASE_URL}/api/payroll/generate_payslip/?employee_id=${employeeId}&month=${monthStr}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error(`Failed to email payslip for Employee ${employeeId}:`, errorText);
        showAlert('Error', `Failed to email payslip for Employee ${employeeId}. ${errorText}`);
      } else {
        showAlert('Success', `Successfully emailed payslip to Employee ${employeeId}.`);
      }
    } catch (error) {
      console.error(`Error emailing payslip for Employee ${employeeId}:`, error);
      showAlert('Error', `Failed to email payslip to Employee ${employeeId}. Please try again.`);
    } finally {
      setIndividualEmailSubmitting(prev => ({ ...prev, [employeeId]: false }));
    }
  };

  const isEditable = !payrollExists && monthValidation.isValid;
  const canEmailPayslips = payrollExists && monthValidation.isValid;

  return (
    <ScrollView style={styles.con}>
      <Text style={styles.title}>Manage Payroll</Text>
      {Platform.OS === 'web' ? (
        <View style={styles.webTopRow}>
          <View style={styles.webMonthPickerContainer}>
            <Text style={styles.inlineLabel}>Select Month:</Text>
            <input
              type="month"
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              style={styles.inlineMonthInput}
            />
          </View>
          <View style={styles.webButtonGroup}>
          <TouchableOpacity
            onPress={handleSubmit}
            style={[styles.submitBtnWeb, (!isEditable || submitting || !monthValidation.isValid) && styles.disabledBtn]}
            disabled={!isEditable || submitting || !monthValidation.isValid}
          >
            <Text style={styles.submitTxt}>
              {submitting ? 'Submitting...' : payrollExists ? 'Payroll Generated' : 'Generate Payroll'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleEmailPayslips}
            style={[
              styles.emailPayslipsBtnWeb,
              (!canEmailPayslips || emailSubmitting || submitting) && styles.disabledBtn
            ]}
            disabled={!canEmailPayslips || emailSubmitting || submitting}
          >
            <Text style={styles.submitTxt}>
              {emailSubmitting ? 'Emailing...' : 'Email Payslips'}
            </Text>
          </TouchableOpacity>
          </View>
        </View>
      ) : (
        <>
          <Text style={styles.label}>Select Month:</Text>
          
          <TextInput placeholder="YYYY-MM" style={styles.month_input} value={selectedMonth} onChangeText={setSelectedMonth} />
        </>
      )}
      {selectedMonth && monthValidation.message ? (
        <Text style={styles.error}>{monthValidation.message}</Text>
      ) : null}

      {loading ? (
        <ActivityIndicator size="large" color="#0000ff" style={{ marginTop: 20 }} />
      ) : (
        <>
          {payrollExists && (
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>Payroll already generated for {selectedMonth}.</Text>
              {/* <Text style={styles.infoText}>Fields are not editable.</Text> */}
            </View>
          )}

          {monthValidation.isValid && employees.map(emp => {
            
            console.log(`RENDER CHECK - Employee ${emp.id}: payrollExists:`, payrollExists);
            console.log(`RENDER CHECK - Employee ${emp.id}: formDataPerEmp[${emp.id}]?.reimbursement_proof_url:`, formDataPerEmp[emp.id]?.reimbursement_proof_url);
            console.log(`RENDER CHECK - Employee ${emp.id}: reimbursement value (parsed):`, parseFloat(formDataPerEmp[emp.id]?.reimbursement ?? emp.reimbursement ?? '0'));
              
            return(
            <View key={emp.id} style={styles.card}>
              {/* Individual Email Payslip Button positioned absolutely at top right */}
              {Platform.OS === 'web' && canEmailPayslips && (
                <TouchableOpacity
                  onPress={() => emailPayslipForEmployee(emp.id, emp.name)}
                  style={[
                    styles.individualEmailBtnTopRight, // New style for top-right positioning
                    (individualEmailSubmitting[emp.id] || submitting) && styles.disabledBtn
                  ]}
                  disabled={individualEmailSubmitting[emp.id] || submitting}
                >
                  <Text style={styles.indbtnTxt}>
                    {individualEmailSubmitting[emp.id] ? 'Emailing...' : 'Email Payslip'}
                  </Text>
                </TouchableOpacity>
              )}
              <Text style={styles.cardTitle}>{emp.id} - {emp.name} - {emp.role}</Text>
              <Text style={styles.label}>Pay Structure: {emp.pay_structure}</Text>
              <Text style={styles.label}>Performance Category:</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={(formDataPerEmp[emp.id]?.perform_category ?? emp.perform_category) || ''}
                  onValueChange={val => isEditable && setFormDataPerEmp(f => ({ // Only update if editable
                    ...f, [emp.id]: { ...f[emp.id], perform_category: val }
                  }))}
                  enabled={isEditable} // Disable picker
                  style={isEditable ? styles.picker : styles.disabledPicker} // Apply disabled style
                >
                  <Picker.Item label="-- Select --" value="" />
                  <Picker.Item label="Exceeds Expectations (E)" value="1" />
                  <Picker.Item label="Meets Expectations (M)" value="2" />
                  <Picker.Item label="Partially Meets Expectations (PM)" value="3" />
                  <Picker.Item label="Below Expectations (BE)" value="4" />
                  <Picker.Item label="Not Applicable (NA)" value="NA" />
                </Picker>
              </View>
              <Text style={styles.label}>Reimbursement:</Text>
              <TextInput
                keyboardType="numeric"
                style={[styles.input, !isEditable && styles.disabledInput]}
                value={(formDataPerEmp[emp.id]?.reimbursement ?? emp.reimbursement ?? '').toString()}
                onChangeText={val => isEditable && setFormDataPerEmp(f => ({ // Only update if editable
                  ...f, [emp.id]: { ...f[emp.id], reimbursement: val }
                }))}
                editable={isEditable} // Disable TextInput
              />

              {/* Display or allow upload of reimbursement proof */}
              {payrollExists && formDataPerEmp[emp.id]?.reimbursement_proof_url ? (
                // If payroll exists and there's a proof URL, display a link
                <View style={{marginVertical:4}}>
                  <Text style={styles.label}>Reimbursement Proof Uploaded: {" "}
                    <Text style={{fontWeight: 'bold', textDecorationLine: 'underline', color: '#007bff',}}
                          onPress={() => handleOpenProof(formDataPerEmp[emp.id].reimbursement_proof_url)}>
                      {/* Extract filename from the URL */}
                      {formDataPerEmp[emp.id].reimbursement_proof_url.split('/').pop()}
                    </Text>
                  </Text>
                </View>
              ) : (
                // Else, show upload UI if editable and reimbursement > 0
                parseFloat(formDataPerEmp[emp.id]?.reimbursement ?? emp.reimbursement ?? '0') > 0 && isEditable &&
                <>
                  <TouchableOpacity onPress={() => handleUpload(emp.id)} style={styles.button} disabled={!isEditable}>
                    <Text style={styles.btnTxt}>Upload Reimbursement Proof (PDF)</Text>
                  </TouchableOpacity>
                  {uploadFiles[emp.id] && (
                    <View style={{marginVertical:4}}>
                      <Text style={styles.label}>Uploaded: {uploadFiles[emp.id].name}</Text>
                      <View  style={styles.checkboxContainer}>
                        <Checkbox
                          value={confirmUpload[emp.id] || false}
                          onValueChange={val => isEditable && setConfirmUpload(c => ({...c,[emp.id]: val}))}
                          disabled={!isEditable}
                        />
                        <Text>Confirm uploaded</Text>
                      </View>
                    </View>
                  )}
                </>
              )}
              {/* If payroll exists but no proof, show text */}
              {payrollExists && !formDataPerEmp[emp.id]?.reimbursement_proof_url && parseFloat(formDataPerEmp[emp.id]?.reimbursement ?? emp.reimbursement ?? '0') > 0 &&
                <Text style={styles.noProofText}>No reimbursement proof uploaded previously.</Text>
              }

              {/* Individual Email Payslip Button positioned at bottom right for mobile */}
              {Platform.OS !== 'web' && canEmailPayslips && (
                <TouchableOpacity
                  onPress={() => emailPayslipForEmployee(emp.id, emp.name)}
                  style={[
                    styles.individualEmailBtnMobile, // Mobile specific style for bottom-right
                    (individualEmailSubmitting[emp.id] || submitting) && styles.disabledBtn
                  ]}
                  disabled={individualEmailSubmitting[emp.id] || submitting}
                >
                  <Text style={styles.indbtnTxt}>
                    {individualEmailSubmitting[emp.id] ? 'Emailing...' : 'Email Payslip'}
                  </Text>
                </TouchableOpacity>
              )}

            </View>
            );
          })}

          {Platform.OS !== 'web' && (
          <View style={styles.mobileButtonRow}>
            <TouchableOpacity onPress={handleSubmit} style={[styles.submitBtnMobile, (!isEditable || submitting || !monthValidation.isValid) && styles.disabledBtn]}
              disabled={!isEditable || submitting || !monthValidation.isValid}>
              <Text style={styles.submitTxt}>
                {submitting ? 'Submitting...' : payrollExists ? 'Payroll Generated' : 'Generate Payroll'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleEmailPayslips}
              style={[
                styles.emailPayslipsBtnMobile,
                (!canEmailPayslips || emailSubmitting || submitting) && styles.disabledBtn
              ]}
              disabled={!canEmailPayslips || emailSubmitting || submitting}
            >
              <Text style={styles.submitTxt}>
                {emailSubmitting ? 'Emailing Payslips...' : 'Email Payslips'}
              </Text>
            </TouchableOpacity>
          </View>
          )}
        </>
      )}
    </ScrollView>
  );
};

export default NewMngPayroll;

const styles = StyleSheet.create({
  con: {
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: Platform.OS === "web" ? 50 : 24,
    color: '#22186F',
    textAlign: 'center',
  },
  pickerContainer: {
    borderWidth: Platform.OS === "web" ? 0 : 1,
    borderColor: '#ccc',
    borderRadius: 6,
    backgroundColor: '#fff',
    //marginBottom: 8,
    marginTop: 2,
  },
  picker: {
    borderColor: "#ccc",
    width: "100%",
    height: 50,
    borderRadius: 6,
    borderWidth: 1,
  },
  disabledPicker: {
    backgroundColor: '#f0f0f0',
    borderColor: "#ccc",
    color: '#888',
    width: "100%",
    height: 50,
    borderRadius: 6,
    borderWidth: 1,
    //opacity: 0.5,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 12,
    marginVertical: 8,
    borderRadius: 10,
    fontSize: 16,
    backgroundColor: '#fff',
    marginTop:2,
  },
  month_input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 12,
    marginVertical: 8,
    borderRadius: 10,
    fontSize: 16,
    backgroundColor: '#fff',
    marginTop:2,
    marginBottom:16,
  },
  error: {
    color: 'red',
    fontWeight: 'bold',
    marginTop: 10,
  },
  card: {
    padding: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    marginBottom: 16,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
    position: 'relative',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  label: {
    fontWeight: '600',
    marginTop: 10,
    marginBottom: 4,
    color: '#333',
  },
  button: {
    backgroundColor: '#22186F',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 6,
    marginTop: 8,
  },
  btnTxt: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 14,
  },
  submitTxt: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
  },
  disabledInput: {
    backgroundColor: '#f0f0f0',
    color: '#888',
  },
  disabledBtn: {
    backgroundColor: '#ccc',
  },
  infoBox: {
    backgroundColor: '#e0f7fa',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#b2ebf2',
    marginBottom: 15,
  },
  infoText: {
    color: '#00796b',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  noProofText: {
    color: '#d32f2f',
    marginTop: 8,
    fontStyle: 'italic',
  },
  proofName: {
    fontWeight: 'bold',
    textDecorationLine: 'underline',
    color: '#007bff',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  webTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 20,
    gap: 12,
    flexWrap: 'wrap',
  },
  webMonthPickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  inlineLabel: {
    fontWeight: '600',
    color: '#333',
  },
  inlineMonthInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 8,
    borderRadius: 8,
    fontSize: 16,
    backgroundColor: '#fff',
    borderStyle: 'solid', // Ensures consistent border
  },
  webButtonGroup: {
    flexDirection: 'row',
    gap: 30,
    marginLeft: 'auto', // Push buttons to the right
  },
  submitBtnWeb: {
    backgroundColor: '#22186F',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 8,
    height: 50,
    justifyContent: 'center',
  },
  emailPayslipsBtnWeb: {
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 8,
    height: 50,
    justifyContent: 'center',
  },
  mobileButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 18,
    marginBottom: 55,
  },
  submitBtnMobile: {
    flex: 1,
    backgroundColor: '#22186F',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 10,
    alignItems: 'center',
  },
  emailPayslipsBtnMobile: {
    flex: 1,
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    //paddingHorizontal: 2,
    borderRadius: 10,
    alignItems: 'center',
  },
  indbtnTxt: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '600',
    fontSize: Platform.OS === "web" ? 14 : 12,
  },
  individualEmailBtnTopRight: {
    backgroundColor: '#10b981',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 6,
    position: 'absolute',
    marginTop: 10,
    top: 10,
    right: 28,
    zIndex: 1,
  },
  individualEmailBtnMobile: {
    backgroundColor: '#10b981',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignSelf: 'flex-end', // Aligns to the right within the flex container (card)
    marginTop: 4, // Add some top margin to separate from other elements
  },

});
