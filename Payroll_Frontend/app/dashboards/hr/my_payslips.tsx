import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { getAccessToken } from '../../auth'; 
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

type Payslip = {
  month: string;
  net_fee_earned: number;
  employee_id: string;
};

const MyPayslipsScreen = () => {
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPayslips = async () => {
    setLoading(true);
    try {
      const token = await getAccessToken();
      const res = await fetch('http://192.168.1.6:8000/api/payroll/my_payslips/', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        throw new Error('Failed to fetch payslips');
      }
      const data = await res.json();
      setPayslips(data);
    } catch (err) {
      Alert.alert('Error', 'Failed to fetch payslips.');
    } finally {
      setLoading(false);
    }
  };

  const downloadPayslip = async (month: string, employee_id: string) => {
    try {
      setLoading(true);
      const token = await getAccessToken();
      const downloadUrl  = `http://192.168.1.6:8000/api/payroll/download_payslip/?employee_id=${employee_id}&month=${month}`;

      const downloadResumable = FileSystem.createDownloadResumable(
        downloadUrl,
        FileSystem.documentDirectory + `payslip_${employee_id}_${month}.pdf`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const downloadResult = await downloadResumable.downloadAsync();
      if (downloadResult?.uri) {
        const downloadedUri = downloadResult.uri;
        await Sharing.shareAsync(downloadedUri);
      } else {
        Alert.alert("Download failed.");
      }
    } catch (error) {
      console.error("PDF download error:", error);
      Alert.alert("Error downloading payslip.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayslips();
  }, []);

  if (loading) return <ActivityIndicator size="large" color="#0000ff" />;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>My Payslips</Text>
      {payslips.length === 0 ? (
        <Text>No payslips available.</Text>
      ) : (
        payslips.map((payslip, idx) => (
          <View key={idx} style={styles.card}>
            <Text>
                Month: {new Date(payslip.month + "-01").toLocaleDateString('en-US', {
                    month: 'long',
                    year: 'numeric',
                })}
            </Text>
            <Text>Net Pay: ₹{payslip.net_fee_earned}</Text>
            <TouchableOpacity
              style={styles.downloadButton}
              onPress={() => downloadPayslip(payslip.month, payslip.employee_id)}
            >
              <Text style={styles.downloadButtonText}>Download</Text>
            </TouchableOpacity>
          </View>
        ))
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 50,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: "#22186F",
    textAlign: "center",
  },
  card: {
    backgroundColor: '#f3f4f6',
    padding: 16,
    marginBottom: 12,
    borderRadius: 8,
  },
  downloadButton: {
    marginTop: 10,
    backgroundColor: '#2563EB',
    padding: 10,
    borderRadius: 6,
  },
  downloadButtonText: {
    color: 'white',
    textAlign: 'center',
  },
});

export default MyPayslipsScreen;
