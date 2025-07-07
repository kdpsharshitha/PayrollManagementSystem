import React, { useEffect, useState } from 'react';
 import {
   View,
   Text,
   FlatList,
   TextInput,
   TouchableOpacity,
   Modal,
   StyleSheet,
   Alert,
   Platform,
   ActivityIndicator,
   Linking, // Import Linking for opening URLs
   ScrollView, // Import ScrollView for the new modal
 } from 'react-native';
 import * as DocumentPicker from 'expo-document-picker';
 import Checkbox from 'expo-checkbox'; // Import Checkbox
 import { Ionicons, Feather } from '@expo/vector-icons';
 import { BASE_URL } from '../../../config';
 import { getAccessToken } from '../../auth';
 import axios from 'axios';

 type Payroll = {
   id: number;
   employee: string;
   month: string;
   base_pay_earned: string;
   perform_comp_payable: string;
   fee_earned: string;
   tds: string;
   net_fee_earned: number;
   generated_on: string;
   generated_time: string;
   reimbursement: number;
   reimbursement_proof?: string; // This will hold the URL
   perform_category: string;
 };

 type EmployeeDetails = {
   id: string;
   name: string;
   email: string;
   phone_no: string;
   role: string;
   designation: string;
   employment_type: string;
   supervisor: string;
   supervisor_email: string;
   account_type: string;
   account_name: string;
   ifsc_code: string;
   pan_no: string;
   date_joined: string;
 };

 type LeaveDetails = {
   month: string;
   working_days: number;
   paid_leaves: number;
   sick_leaves: number;
   unpaid_leaves: number;
   total_leaves_taken: number;
   absent_days: number;
   days_worked: number;
 };

 export default function ReviewPayrollsPage() {
   const [payrolls, setPayrolls] = useState<Payroll[]>([]);
   const [filteredPayrolls, setFilteredPayrolls] = useState<Payroll[]>([]);
   const [searchText, setSearchText] = useState('');
   const [loading, setLoading] = useState(true);

   const [selectedPayroll, setSelectedPayroll] = useState<Payroll | null>(null);
   const [newReimbursement, setNewReimbursement] = useState('');
   const [selectedFile, setSelectedFile] = useState<{
     name: string;
     uri: string;
     mimeType?: string;
   } | null>(null);
   const [confirmUpload, setConfirmUpload] = useState(false); // New state for confirm upload
   const [modalVisible, setModalVisible] = useState(false);
   const [isUpdating, setIsUpdating] = useState(false); // New state for update loading
   const [showEmailNewPayslipButton, setShowEmailNewPayslipButton] = useState(false);
   const [isEmailing, setIsEmailing] = useState(false);
   // State to store the original reimbursement and proof when the modal opens
   const [originalReimbursement, setOriginalReimbursement] = useState('');
   const [originalReimbursementProof, setOriginalReimbursementProof] = useState<string | undefined>(undefined);

   // New states for the "View Details" modal
   const [viewDetailsModalVisible, setViewDetailsModalVisible] = useState(false);
   const [employeeDetails, setEmployeeDetails] = useState<EmployeeDetails | null>(null);
   const [leaveDetails, setLeaveDetails] = useState<LeaveDetails | null>(null);
   const [viewDetailsLoading, setViewDetailsLoading] = useState(false);

   const showAlert = (title: string, message: string) => {
     if (Platform.OS === "web") {
       window.alert(`${title}: ${message}`);
     } else {
       Alert.alert(title, message);
     }
   };

   const fetchPayrolls = async () => {
     setLoading(true);
     try {
       const token = await getAccessToken();
       const res = await axios.get(`${BASE_URL}/api/payroll/payroll/`, {
         headers: { Authorization: `Bearer ${token}` },
       });

       // Sort the payroll data
        const sortedPayrolls = res.data.sort((a: Payroll, b: Payroll) => {
          // First, sort by month in descending order (recent month first)
          // Assuming month format is YYYY-MM
          const monthA = a.month.slice(0, 7);
          const monthB = b.month.slice(0, 7);
          if (monthA > monthB) return -1;
          if (monthA < monthB) return 1;

          // If months are the same, sort by employee ID in ascending order
          const idA = a.employee.split(' - ')[0];
          const idB = b.employee.split(' - ')[0];
          return idA.localeCompare(idB);
        });

       setPayrolls(sortedPayrolls);
       setFilteredPayrolls(sortedPayrolls);
     } catch (err) {
       console.error('Failed to fetch payrolls', err);
       showAlert('Error', 'Failed to load payrolls');
     }
     setLoading(false);
   };

   useEffect(() => {
     fetchPayrolls();
   }, []);

   const handleSearch = (text: string) => {
     setSearchText(text);
     const lower = text.toLowerCase();
     const filtered = payrolls.filter(
       (p) =>
         p.employee.split(' - ')[0].toLowerCase().includes(lower) ||
         p.employee.split(' - ')[1].toLowerCase().includes(lower) ||
         p.month.includes(lower)
     );
     setFilteredPayrolls(filtered);
   };

   const openEditModal = (payroll: Payroll) => {
     setSelectedPayroll(payroll);
     setNewReimbursement(String(payroll.reimbursement || '0'));
     // Store original values
     setOriginalReimbursement(String(payroll.reimbursement || '0'));
     setOriginalReimbursementProof(payroll.reimbursement_proof);

     setSelectedFile(null); // Clear selected file when opening modal
     setConfirmUpload(false); // Reset confirm upload checkbox
     setShowEmailNewPayslipButton(false);
     setModalVisible(true);
   };

   const pickPDF = async () => {
     try {
       const result = await DocumentPicker.getDocumentAsync({
         type: 'application/pdf',
         copyToCacheDirectory: false, // No need to copy to cache for web or direct URI usage
       });

       if (!result.canceled && result.assets?.length) {
         const file = result.assets[0];
         setSelectedFile({
           name: file.name,
           uri: file.uri,
           mimeType: file.mimeType || 'application/pdf',
         });
         setConfirmUpload(false); // Reset confirmation if a new file is picked
       } else {
         console.log("Document picking cancelled or no assets selected.");
       }
     } catch (err) {
       console.error("Error picking document:", err);
       showAlert("Error", "Failed to pick document.");
     }
   };

   const handleOpenProof = async (url: string | undefined) => {
     if (!url) {
       showAlert('Info', 'No proof URL available.');
       return;
     }
     try {
       const supported = await Linking.canOpenURL(url);
       if (supported) {
         await Linking.openURL(url);
       } else {
         showAlert('Error', `Cannot open URL: ${url}`);
       }
     } catch (error) {
       console.error('Error opening proof:', error);
       showAlert('Error', 'Failed to open proof.');
     }
   };

   // Determine if there are any changes
   const hasChanges = () => {
     if (!selectedPayroll) return false;

     // Check if reimbursement amount has changed
     if (newReimbursement !== originalReimbursement) {
       return true;
     }

     // Check if a new file has been selected
     if (selectedFile !== null) {
       return true;
     }

     // If a proof was previously uploaded, and now the reimbursement is 0 and no new file, consider it a change (to remove proof implicitly if backend handles it)
     if (originalReimbursementProof && parseFloat(newReimbursement || '0') === 0 && selectedFile === null) {
       return true;
     }

     return false;
   };

   const updatePayroll = async () => {
     if (!selectedPayroll) return;

     setIsUpdating(true); // Start updating
     const reimbursementValue = parseFloat(newReimbursement);

     if (isNaN(reimbursementValue) || reimbursementValue < 0) {
       showAlert('Validation Error', 'Reimbursement must be a valid non-negative number.');
       setIsUpdating(false);
       return;
     }

     // --- START: NEW Validation Logic for Reimbursement Proof ---
     const reimbursementAmountChanged = newReimbursement !== originalReimbursement;

     if (reimbursementValue > 0) {
       if (reimbursementAmountChanged || !originalReimbursementProof) {
         // If the reimbursement amount has changed, OR there was no original proof,
         // then a new file must be uploaded.
         if (!selectedFile) {
           showAlert('Validation', 'A new reimbursement proof must be uploaded for the updated reimbursement.');
           setIsUpdating(false);
           return;
         }
       }

       // If a new file is selected (either due to change or initial upload), confirm upload must be checked.
       if (selectedFile && !confirmUpload) {
         showAlert('Validation', 'Confirm upload for reimbursement proof.');
         setIsUpdating(false);
         return;
       }
     }
     // --- END: NEW Validation Logic ---


     const token = await getAccessToken();
     const formData = new FormData();

     formData.append('reimbursement', newReimbursement);
     formData.append('perform_category', selectedPayroll.perform_category ?? 'NA');
     formData.append('employee_id', selectedPayroll.employee.split(' - ')[0]);
     formData.append('month', selectedPayroll.month.slice(0, 7)); //YYYY-MM

     if (selectedFile) {
       // If a new file is explicitly selected, always upload it.
       if (selectedFile.uri.startsWith('data:')) {
         try {
           const base64Content = selectedFile.uri.split(',')[1];
           const blob = await new Promise<Blob>((resolve, reject) => {
             const byteCharacters = atob(base64Content);
             const byteNumbers = new Array(byteCharacters.length);
             for (let i = 0; i < byteCharacters.length; i++) {
               byteNumbers[i] = byteCharacters.charCodeAt(i);
             }
             const byteArray = new Uint8Array(byteNumbers);
             resolve(new Blob([byteArray], { type: selectedFile.mimeType || 'application/pdf' }));
           });
           formData.append('reimbursement_proof', blob, selectedFile.name);
         } catch (error) {
           console.error("Error converting Data URI to Blob:", error);
           showAlert("Error", `Failed to upload proof.`);
           setIsUpdating(false);
           return;
         }
       } else {
         const fileType = selectedFile.mimeType || 'application/pdf';
         formData.append('reimbursement_proof', {
           uri: selectedFile.uri,
           name: selectedFile.name,
           type: fileType,
         } as any);
       }
     } else if (reimbursementValue === 0 && originalReimbursementProof) {
       // If reimbursement is set to 0 and there was an original proof, explicitly tell the backend to clear it
       formData.append('reimbursement_proof', ''); // Send empty string or null to clear on backend
     }
     // No 'else if' for sending originalReimbursementProof here.
     // If no new file is selected, and reimbursement > 0, and amount has NOT changed,
     // we assume the backend retains the existing proof if the field isn't sent.


     try {
       await axios.post(`${BASE_URL}/api/payroll/generate/`, formData, {
         headers: {
           Authorization: `Bearer ${token}`,
           'Content-Type': 'multipart/form-data',
         },
       });
       showAlert('Success', 'Payroll updated successfully!');
       setShowEmailNewPayslipButton(true);
       fetchPayrolls(); // Refresh data after update
     } catch (err: any) {
       console.error('Update failed', err.response?.data || err.message);
       showAlert('Error', `Failed to update payroll: ${err.response?.data?.detail || err.message}`);
     } finally {
       setIsUpdating(false); // End updating
     }
   };

   const handleEmailNewPayslip = async () => {
     if (!selectedPayroll) {
       showAlert('Error', 'No payroll selected to email.');
       return;
     }

     // You might want to show a loading indicator here as well
     setIsEmailing(true); // new state for email loading

     try {
       const token = await getAccessToken();
       const employeeId = selectedPayroll.employee.split(' - ')[0];
       const month = selectedPayroll.month.slice(0, 7); //YYYY-MM


       await axios.get(`${BASE_URL}/api/payroll/generate_payslip/?employee_id=${employeeId}&month=${month}`, {
         headers: {
           Authorization: `Bearer ${token}`,
           'Content-Type': 'application/json',
         },
       });
       showAlert('Success', 'New payslip email sent successfully!');
       setModalVisible(false); // Close modal after emailing
       setShowEmailNewPayslipButton(false); // Reset state
     } catch (err: any) {
       console.error('Email payslip failed', err.response?.data || err.message);
       showAlert('Error', `Failed to send payslip email: ${err.response?.data?.detail || err.message}`);
     } finally {
       setIsEmailing(false); // reset email loading
     }
   };

   const fetchEmployeeAndLeaveDetails = async (employeeId: string, month: string) => {
     setViewDetailsLoading(true);
     setEmployeeDetails(null);
     setLeaveDetails(null);

     try {
       const token = await getAccessToken();

       // Fetch Employee Details
       const employeeRes = await axios.get(`${BASE_URL}/api/employee/employees/${employeeId}/`, {
         headers: { Authorization: `Bearer ${token}` },
       });
       setEmployeeDetails(employeeRes.data);

       // Fetch Leave Details (Assuming an API endpoint for this)
       const leaveRes = await axios.get(`${BASE_URL}/api/leavedetails/leavedetails/?{employeeId}&month=${month}`, {
         headers: { Authorization: `Bearer ${token}` },
       });
       if (leaveRes.data && leaveRes.data.length > 0) {
          setLeaveDetails({ ...leaveRes.data[0], month: month }); // Take the first (and likely only) item
        } else {
          setLeaveDetails(null); // No leave details found for this employee and month
          showAlert('Info', 'No leave details found for this employee and month.');
        }
     } catch (err: any) {
       console.error('Failed to fetch employee/leave details', err.response?.data || err.message);
       showAlert('Error', `Failed to load details: ${err.response?.data?.detail || err.message}`);
     } finally {
       setViewDetailsLoading(false);
     }
   };

   const openViewDetailsModal = (payroll: Payroll) => {
     setSelectedPayroll(payroll);
     const employeeId = payroll.employee.split(' - ')[0];
     const month = payroll.month.slice(0, 7);
     fetchEmployeeAndLeaveDetails(employeeId, month);
     setViewDetailsModalVisible(true);
   };

   const renderPayrollItem = ({ item }: { item: Payroll }) => (
     <View style={styles.card}>
       <Text style={styles.rowText}>ID: {item.employee.split(' - ')[0]}</Text>
       <Text style={styles.rowText}>Name: {item.employee.split(' - ')[1]}</Text>
       <Text style={styles.rowText}>Month: {item.month.slice(0, 7)}</Text>
       <Text style={styles.rowText}>Net Fee: ₹ {item.net_fee_earned}</Text>
       <Text>
          {`Generated On: ${item.generated_on}${item.generated_time ? ' , ' + item.generated_time.slice(0, 8) : ''}`}
       </Text>
       <View style={styles.actions}>
         <TouchableOpacity onPress={() => openViewDetailsModal(item)} style={[styles.button, styles.viewButton]}>
           <Feather name="eye" size={20} color="white" />
         </TouchableOpacity>
         <TouchableOpacity onPress={() => openEditModal(item)} style={[styles.button, styles.editButton]}>
           <Feather name="edit" size={20} color="white" />
         </TouchableOpacity>
       </View>
     </View>
   );

   return (
     <View style={styles.container}>
       <Text style={styles.title}>Payroll Records</Text>
       <TextInput
         style={styles.searchInput}
         placeholder="Search by ID, Name, or Month"
         value={searchText}
         onChangeText={handleSearch}
       />

       {loading ? (
         <ActivityIndicator size="large" color="#007bff" style={{ marginTop: 20 }} />
       ) : (
         <FlatList
           data={filteredPayrolls}
           keyExtractor={(item) => item.id.toString()}
           renderItem={renderPayrollItem}
           contentContainerStyle={{ paddingBottom: 80 }}
         />
       )}

       {/* Edit Modal */}
       <Modal
         visible={modalVisible}
         animationType="slide"
         transparent
         onRequestClose={() => { setModalVisible(false); setShowEmailNewPayslipButton(false); }}
       >
         <View style={styles.modalOverlay}>
           <View style={styles.modalContent}>
             <Text style={styles.modalTitle}>Edit Payroll</Text>
             <Text>Employee Id: {selectedPayroll?.employee.split(' - ')[0] || 'N/A'}</Text>
             <Text>Name: {selectedPayroll?.employee.split(' - ')[1] || 'N/A'}</Text>
             <Text>Month: {selectedPayroll?.month.slice(0, 7) || 'N/A'}</Text>

             <Text style={styles.label}>Reimbursement:</Text>
             <TextInput
               placeholder="Reimbursement Amount"
               keyboardType="numeric"
               value={newReimbursement}
               onChangeText={setNewReimbursement}
               style={styles.input}
             />

             {/* Display existing proof or allow new upload */}
             {selectedPayroll?.reimbursement_proof && !selectedFile && parseFloat(newReimbursement || '0') > 0 ? (
               <View style={{ marginBottom: 8}}>
                  <Text style={styles.label}>Reimbursement Proof Uploaded:</Text>
                  <TouchableOpacity onPress={() => handleOpenProof(selectedPayroll.reimbursement_proof)}>
                    <Text style={styles.proofName}>
                      {selectedPayroll.reimbursement_proof.split('/').pop()}
                    </Text> 
                  </TouchableOpacity>
               </View>
             ) : null}

             {/* Show upload option only if reimbursement > 0 */}
             {parseFloat(newReimbursement || '0') > 0 && (
               <>
                 <TouchableOpacity onPress={pickPDF} style={styles.uploadBtn} disabled={isUpdating}>
                   <Text>{selectedFile?.name || 'Upload Reimbursement Proof (PDF)'}</Text>
                 </TouchableOpacity>

                 {selectedFile && ( // Show checkbox only if a file is selected
                   <View style={styles.checkboxContainer}>
                     <Checkbox
                       value={confirmUpload}
                       onValueChange={setConfirmUpload}
                       disabled={isUpdating}
                     />
                     <Text>Confirm uploaded</Text>
                   </View>
                 )}
               </>
             )}

             <View style={styles.modalButtons}>
               {showEmailNewPayslipButton ? (
                 <TouchableOpacity
                   style={[styles.saveBtn, { backgroundColor: '#28a745' }, isEmailing && styles.disabledBtn]} // Green color for email button
                   onPress={handleEmailNewPayslip}
                   disabled={isEmailing} // Disable if still updating previous state
                  >
                   {isEmailing ? ( // <--- Show ActivityIndicator or text
                     <ActivityIndicator color="#fff" />
                   ) : (
                     <Text style={styles.saveText}>Email New Payslip</Text>
                   )}
                 </TouchableOpacity>
               ) : (
                 <> {/* Existing Save and Cancel buttons */}
                   <TouchableOpacity
                     style={[styles.saveBtn, (!hasChanges() || isUpdating) && styles.disabledBtn]}
                     onPress={updatePayroll}
                     disabled={!hasChanges() || isUpdating}
                   >
                     {isUpdating ? (
                       <ActivityIndicator color="#fff" />
                     ) : (
                       <Text style={styles.saveText}>Save</Text>
                     )}
                   </TouchableOpacity>
                   <TouchableOpacity
                     style={[styles.cancelBtn, isUpdating && styles.disabledBtn]}
                     onPress={() => {
                       setModalVisible(false);
                       setShowEmailNewPayslipButton(false); // Make sure to reset
                     }}
                     disabled={isUpdating}
                   >
                     <Text>Cancel</Text>
                   </TouchableOpacity>
                 </>
               )}
             </View>
           </View>
         </View>
       </Modal>

       {/* View Details Modal */}
       <Modal
         visible={viewDetailsModalVisible}
         animationType="slide"
         transparent
         onRequestClose={() => setViewDetailsModalVisible(false)}
       >
         <View style={styles.modalOverlay}>
           <View style={styles.modalContent}>
             <Text style={styles.modalTitle}>Employee & Payroll Details</Text>
             {viewDetailsLoading ? (
               <ActivityIndicator size="large" color="#007bff" style={{ marginTop: 20 }} />
             ) : (
               <ScrollView>
                 {employeeDetails && (
                   <View style={styles.detailsSection}>
                     <Text style={styles.sectionTitle}>Employee Information</Text>
                     <Text style={styles.detailText}>Employee ID: {employeeDetails.id}</Text>
                     <Text style={styles.detailText}>Name: {employeeDetails.name}</Text>
                     <Text style={styles.detailText}>Email: {employeeDetails.email}</Text>
                     <Text style={styles.detailText}>Phone: {employeeDetails.phone_no}</Text>
                     <Text style={styles.detailText}>Role: {employeeDetails.role}</Text>
                     <Text style={styles.detailText}>Designation: {employeeDetails.designation}</Text>
                     <Text style={styles.detailText}>Employment Type: {employeeDetails.employment_type}</Text>
                     <Text style={styles.detailText}>Assigned Supervisor: {employeeDetails.supervisor}</Text>
                     <Text style={styles.detailText}>Supervisor Email: {employeeDetails.supervisor_email}</Text>
                     <Text style={styles.detailText}>Date of Joining: {employeeDetails.date_joined}</Text>
                     <Text style={styles.detailText}>Bank Name: {employeeDetails.account_type}</Text>
                     <Text style={styles.detailText}>Account Name: {employeeDetails.account_name}</Text>
                     <Text style={styles.detailText}>IFSC Code: {employeeDetails.ifsc_code}</Text>
                     <Text style={styles.detailText}>PAN: {employeeDetails.pan_no}</Text>
                   </View>
                 )}

                 {leaveDetails && (
                   <View style={styles.detailsSection}>
                     <Text style={styles.sectionTitle}>Leave Details (for {leaveDetails.month.slice(0, 7)})</Text>
                     <Text style={styles.detailText}>Working Days: {leaveDetails.working_days}</Text>
                     <Text style={styles.detailText}>Paid Leaves: {leaveDetails.paid_leaves}</Text>
                     <Text style={styles.detailText}>Sick Leaves: {leaveDetails.sick_leaves}</Text>
                     <Text style={styles.detailText}>Unpaid Leaves: {leaveDetails.unpaid_leaves}</Text>
                     <Text style={styles.detailText}>Total Leaves Taken: {leaveDetails.total_leaves_taken}</Text>
                     <Text style={styles.detailText}>Absent Days: {leaveDetails.absent_days}</Text>
                     <Text style={styles.detailText}>Days Worked: {leaveDetails.days_worked}</Text>
                   </View>
                 )}

                 {selectedPayroll && (
                   <View style={styles.detailsSection}>
                     <Text style={styles.sectionTitle}>Payroll Details (for {selectedPayroll.month.slice(0, 7)})</Text>
                     <Text style={styles.detailText}>Base Pay Earned: ₹ {selectedPayroll.base_pay_earned}</Text>
                     <Text style={styles.detailText}>Performance Category: {selectedPayroll.perform_category}</Text>
                     <Text style={styles.detailText}>Variable Pay Earned: {selectedPayroll.perform_comp_payable}</Text>
                     <Text style={styles.detailText}>Fee Earned: {selectedPayroll.fee_earned}</Text>
                     <Text style={styles.detailText}>TDS Deducted: {selectedPayroll.tds}</Text>
                     <Text style={styles.detailText}>Reimbursement: ₹ {selectedPayroll.reimbursement}</Text>
                     {selectedPayroll.reimbursement_proof && (
                        <View style={styles.reimbursementProofContainer}>
                          <Text style={styles.detailText}>Reimbursement Proof: </Text>
                          <TouchableOpacity onPress={() => handleOpenProof(selectedPayroll.reimbursement_proof)}>
                            <Text style={styles.proofName}>
                              {selectedPayroll.reimbursement_proof.split('/').pop()}
                            </Text>
                          </TouchableOpacity>
                        </View> 
                     )}
                     <Text style={styles.detailText}>Net Fee Earned: ₹ {selectedPayroll.net_fee_earned}</Text>
                     <Text style={styles.detailText}>Generated On: {selectedPayroll.generated_on}, {selectedPayroll.generated_time?.slice(0, 8)}</Text>
                   </View>
                 )}

                 {!employeeDetails && !leaveDetails && !selectedPayroll && !viewDetailsLoading && (
                   <Text style={styles.detailText}>No details available.</Text>
                 )}
               </ScrollView>
             )}
             <TouchableOpacity
               style={[styles.cancelBtn, { marginTop: 20 }]}
               onPress={() => setViewDetailsModalVisible(false)}
             >
               <Text>Close</Text>
             </TouchableOpacity>
           </View>
         </View>
       </Modal>
     </View>
   );
 }

 const styles = StyleSheet.create({
   container: { 
      flex: 1,
      width: "100%", 
      paddingHorizontal: 8,
      paddingTop: 20, 
      backgroundColor: '#fff' 
    },
   title: { fontSize: 24, fontWeight: 'bold', marginBottom: 10, textAlign: 'center', color: '#22186F' },
   searchInput: {
    backgroundColor: "white", padding: 12, borderRadius: 12,marginTop: 20, marginBottom: 20,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    alignSelf: "center",       // center search box
    width: "100%",
    maxWidth: 900,
   },
   card: {
     backgroundColor: 'white',
     padding: 16,
     borderRadius: 16,
     marginBottom: 16,
     shadowColor: '#000', shadowOpacity: 0.2,shadowOffset: { width: 0, height: 2 }, shadowRadius: 4, elevation: 3,
     alignSelf: "center",       // center search box
     width: "100%",
     maxWidth: 900,
   },
   rowText: { fontSize: 14, marginBottom: 4 },
   actions: { flexDirection: 'row', marginTop: 10, justifyContent: 'flex-end', gap: 10 }, // Added gap for spacing
   iconBtn: { marginRight: 15 },

   modalOverlay: {
     flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', // Darker overlay
     padding: 20,
   },
   modalContent: {
     backgroundColor: '#fff', borderRadius: 10, padding: 20,
     shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5,
     maxHeight: '80%', // Limit height of modal content
   },
   modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center', color: '#22186F' },
   label: {
     fontWeight: '600',
     marginTop: 10,
     marginBottom: 4,
     color: '#333',
   },
   input: {
     borderWidth: 1, borderColor: '#ccc', borderRadius: 8,
     padding: 10, marginTop: 5, marginBottom: 15,
     fontSize: 16,
   },
   uploadBtn: {
     padding: 10, borderWidth: 1, borderColor: '#007bff',
     borderRadius: 6, alignItems: 'center', marginBottom: 10,
     backgroundColor: '#e0f7fa', // Light background for upload button
   },
   modalButtons: {
     flexDirection: 'row', justifyContent: 'space-around', marginTop: 20,
   },
   saveBtn: {
     backgroundColor: '#007bff', paddingVertical: 12, paddingHorizontal: 25, borderRadius: 8,
     minWidth: 100, alignItems: 'center',
   },
   saveText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
   cancelBtn: {
     paddingVertical: 12, paddingHorizontal: 25, borderRadius: 8, borderWidth: 1, borderColor: '#ccc',
     minWidth: 100, alignItems: 'center',
   },
   viewButton: {
     backgroundColor: "#2563EB",
   },
   editButton: {
     backgroundColor: "#10b981", // green
   },
   button: {
     padding: 10,
     borderRadius: 8, // Slightly smaller radius for consistency
   },
   reimbursementProofContainer: {
      flexDirection: 'row', // Align children horizontally
      alignItems: 'baseline', // Vertically align items in the center
      marginBottom: 8,
      flexWrap: 'wrap', // Allow content to wrap if it's too long
      gap: 5, // Small gap between text and link
    },
   proofName: {
     fontWeight: 'bold',
     textDecorationLine: 'underline',
     color: '#007bff',
     flexShrink: 1, 
   },
   checkboxContainer: {
     flexDirection: 'row',
     alignItems: 'center',
     marginTop: 6,
     marginBottom: 10,
     gap: 8, // Space between checkbox and text
   },
   disabledBtn: {
     backgroundColor: '#ccc',
   },
   detailsSection: {
     marginBottom: 20,
     padding: 10,
     backgroundColor: '#f0f8ff',
     borderRadius: 8,
   },
   sectionTitle: {
     fontSize: 16,
     fontWeight: 'bold',
     marginBottom: 10,
     color: '#22186F',
   },
   detailText: {
     fontSize: 14,
     marginBottom: 4,
   },
 });