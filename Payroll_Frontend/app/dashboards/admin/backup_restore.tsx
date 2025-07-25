import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, Platform,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { getAccessToken } from '../../auth/index';
import { BASE_URL } from "../../../config";

export default function BackupRestoreScreen() {
  const [loading, setLoading] = useState(false);
  const [rloading, setrloading] = useState(false);

  const showAlert = (title: string, message: string) => {
        if (Platform.OS === "web") {
          window.alert(`${title}: ${message}`);
        } else {
          Alert.alert(title, message);
        }
    };

  const handleBackup = async () => {
    try {
        setLoading(true);
        const token = await getAccessToken();

        const res = await fetch(`${BASE_URL}/api/backup_restore/backup/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Failed to backup: ${res.status} - ${errorText}`);
        }

        const content = await res.text();

        if (Platform.OS === 'web') {
        const blob = new Blob([content], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.style.display = 'none'; // IMPORTANT: Hide the element
        a.href = url;
        let filename = 'backup.json'; // Fallback filename
        const contentDisposition = res.headers.get('Content-Disposition'); // Get the header
        console.log('Frontend received Content-Disposition header:', contentDisposition);
        if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
            if (filenameMatch?.[1]) {
            filename = filenameMatch[1];
            } else {
            // Fallback for cases where filename is not quoted (less common but possible)
            const nonQuotedFilenameMatch = contentDisposition.match(/filename=([^;]+)/);
            if (nonQuotedFilenameMatch?.[1]) {
                filename = nonQuotedFilenameMatch[1].trim();
            }
            }
        }
        console.log('Detected filename for download:', filename);
        a.download = filename; 
        document.body.appendChild(a);
        a.click();
        a.remove(); // Clean up the element
        window.URL.revokeObjectURL(url); // Revoke the object URL

        window.alert('Backup downloaded successfully!'); // Specific alert for web

        } else { 
        const fileUri = FileSystem.documentDirectory + 'backup.json';
        
        await FileSystem.writeAsStringAsync(fileUri, content, {
            encoding: FileSystem.EncodingType.UTF8,
        });

        Alert.alert('Success', 'Backup file is ready. Please select a location to save it from the share menu.');

        await Sharing.shareAsync(fileUri, {
            UTI: 'public.json', // iOS file type hint
            mimeType: 'application/json' // Android file type hint
        });

        
        }

    } catch (err: any) {
        console.error('Error during backup process:', err); // Log the actual error
        showAlert('Error', err.message);
    } finally {
        setLoading(false);
    }
  };

  const handleRestore = async () => {
    try {
        setrloading(true);
        const token = await getAccessToken();

        const result = await DocumentPicker.getDocumentAsync({ type: 'application/json' });
       
        if (result.canceled || !result.assets?.[0]) {
        setrloading(false);
        return;
        }

        const selectedAsset = result.assets[0]; // Get the selected asset
        const formData = new FormData();

        if (Platform.OS === 'web') {
            // For web, DocumentPicker provides a data URL or File object directly
            // If it's a data URL, we need to convert it to a Blob
            if (selectedAsset.uri.startsWith('data:')) {
                const response = await fetch(selectedAsset.uri); // Fetch the data URL
                const blob = await response.blob(); // Get the content as a Blob

                formData.append('backup_file', blob, selectedAsset.name || 'restore.json');
                
            } else if (selectedAsset.file) {
                // If DocumentPicker provides a File object directly (e.g., from an input type="file")
                formData.append('backup_file', selectedAsset.file, selectedAsset.name || 'restore.json');
            } else {
                // Fallback or error for unexpected web asset type
                throw new Error('Unsupported file format from document picker on web.');
            }
        } else {
            
            formData.append('backup_file', {
                uri: selectedAsset.uri,
                name: selectedAsset.name || 'restore.json', // Use selectedAsset.name if available
                type: selectedAsset.mimeType || 'application/json', // Use selectedAsset.mimeType if available
            } as any);
        }

        const requestHeaders = {
        Authorization: `Bearer ${token}`,
        };
        
        const res = await fetch(`${BASE_URL}/api/backup_restore/restore/`, {
        method: 'POST',
        headers: requestHeaders,
        body: formData,
        });

        if (!res.ok) {
        const errorText = await res.text();
        console.error('Restore: Server response not OK. Error:', errorText);
        throw new Error(`Restore failed: ${res.status} - ${errorText}`);
        }

        showAlert('Success', 'Restore completed successfully!');
        console.log('Restore: Completed successfully.');

    } catch (err: any) {
        console.error('Restore: An error occurred:', err);
        showAlert('Error', err.message);
    } finally {
        setrloading(false);
        console.log('Restore: Loading state reset.');
    }
  };
  return (
    <View style={styles.container}>
        <View style={styles.card}>
        <Text style={styles.header}>Backup & Restore</Text>

        <TouchableOpacity
            style={[styles.button, { backgroundColor: '#28a745' }]}
            onPress={handleBackup}
            disabled={loading}
        >
            <Text style={styles.buttonText}>
            {loading ? 'Downloading...' : '📦 Backup Database'}
            </Text>
        </TouchableOpacity>

        <TouchableOpacity
            style={[styles.button, { backgroundColor: '#007bff' }]}
            onPress={handleRestore}
            disabled={rloading}
        >
            <Text style={styles.buttonText}>
            {rloading ? 'Uploading...' : '🔁 Restore from Backup'}
            </Text>
        </TouchableOpacity>
        </View>
    </View>
    );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
    alignSelf: "center",
  },
  header: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#22186F',
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginVertical: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 2,
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
});
