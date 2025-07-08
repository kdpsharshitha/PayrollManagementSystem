import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  SafeAreaView,
} from "react-native";
import axios from "axios";
import { getAccessToken } from "../../auth";

type Employee = {
  id: string;
  name: string;
  email: string;
  gender: string;
  account_type: string;
  pan_no: string | null;
  phone_no: string | null;
  emergency_phone_no: string | null;
  address: string | null;
  employment_type: string;
  role: string;
  designation: string | null;
  date_joined: string;
  fee_per_month: string;
  pay_structure: string;
  is_active: boolean;
  is_staff: boolean;
};

export default function ViewProfileScreen() {
  const [profile, setProfile] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const BASE_URL = "http://192.168.1.4:8000/api/employee";

  useEffect(() => {
    async function loadProfile() {
      try {
        const token = await getAccessToken();
        const resp = await axios.get<Employee>(`${BASE_URL}/profile/`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setProfile(resp.data);
      } catch (err: any) {
        console.error("Failed to load profile:", err);
        setError("Could not fetch profile.");
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0057e7" />
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error ?? "No profile data."}</Text>
      </View>
    );
  }

  // Helper to render a labeled row
  const Row = ({ label, value }: { label: string; value: string }) => (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {profile.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </Text>
            </View>
            <Text style={styles.name}>{profile.name}</Text>
            <Text style={styles.title}>{profile.designation || profile.role}</Text>
          </View>

          {/* Personal Info */}
          <Text style={styles.sectionTitle}>Personal Information</Text>
          <Row label="Gender" value={profile.gender} />
          <Row label="Date Joined" value={new Date(profile.date_joined).toLocaleDateString()} />

          {/* Contact Info */}
          <Text style={styles.sectionTitle}>Contact Information</Text>
          <Row label="Email" value={profile.email} />
          <Row label="Phone" value={profile.phone_no || "–"} />
          <Row label="Emergency Phone" value={profile.emergency_phone_no || "–"} />
          <Row label="Address" value={profile.address || "–"} />

          {/* Employment */}
          <Text style={styles.sectionTitle}>Employment Details</Text>
          <Row label="Type" value={profile.employment_type} />
          <Row label="Role" value={profile.role} />
          <Row label="Designation" value={profile.designation || "–"} />

          {/* Account & Finance */}
          <Text style={styles.sectionTitle}>Account & Finance</Text>
          <Row label="Account Type" value={profile.account_type} />
          <Row label="PAN No." value={profile.pan_no || "–"} />
          <Row label="Monthly Fee" value={profile.fee_per_month} />
          <Row label="Pay Structure" value={profile.pay_structure} />
          <Row label="Active" value={profile.is_active ? "Yes" : "No"} />
          <Row label="Staff" value={profile.is_staff ? "Yes" : "No"} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#eef2f6",
  },
  scroll: {
    alignItems: "center",
    paddingVertical: 30,
    paddingHorizontal: 10,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#eef2f6",
  },
  card: {
    width: "100%",
    maxWidth: 800,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 24,
    // iOS shadow
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    // Android elevation
    elevation: 4,
  },
  header: {
    alignItems: "center",
    marginBottom: 24,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#0057e7",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 28,
    color: "#fff",
    fontWeight: "700",
  },
  name: {
    fontSize: 22,
    fontWeight: "700",
    color: "#222",
  },
  title: {
    fontSize: 16,
    color: "#666",
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0057e7",
    marginTop: 20,
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  rowLabel: {
    fontSize: 14,
    color: "#555",
    flex: 1,
  },
  rowValue: {
    fontSize: 14,
    color: "#222",
    flex: 1,
    textAlign: "right",
  },
  error: {
    color: "#d32f2f",
    fontSize: 16,
  },
});
