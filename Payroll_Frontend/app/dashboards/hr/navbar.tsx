import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { useRouter } from "expo-router";

export default function Navbar() {
  const [menuVisible, setMenuVisible] = useState(false);
  const [profileMenuVisible, setProfileMenuVisible] = useState(false);
  const [leavesDropdownVisible, setLeavesDropdownVisible] = useState(false);
  const router = useRouter();

  const handleNavigate = (path: string) => {
    setMenuVisible(false);
    router.push(path as any);
  };

  return (
    <View style={styles.container}>
      <View style={styles.navbar}>
        <View style={styles.left}>
            <Pressable  onPress={() => setMenuVisible(!menuVisible)}>
                <Ionicons name="menu" size={28} color="#fff" />  
            </Pressable>
            <Text style={styles.adminText}>HR</Text>
        </View>
        
        <Pressable onPress={() => setProfileMenuVisible(!profileMenuVisible)}>
          <Ionicons name="person-circle" size={40} color="#fff" />
        </Pressable>
      </View>

      {menuVisible && (
        <View style={styles.menu}>
          <Pressable onPress={() => handleNavigate("/dashboards/hr/view_mng_emp_details")}>
            <Text style={styles.menuItem}>View & Manage Employee Details</Text>
          </Pressable>
          <Pressable onPress={() => handleNavigate("/dashboards/hr/mng_attendance")}>
            <Text style={styles.menuItem}>Manage Attendance</Text>
          </Pressable>
          <Pressable onPress={() => handleNavigate("/dashboards/hr/emp_leave_requests")}>
            <Text style={styles.menuItem}>Manage Employee Leave Requests</Text>
          </Pressable>
          <Pressable onPress={() => handleNavigate("/dashboards/hr/mng_payroll")}>
            <Text style={styles.menuItem}>Manage Payroll</Text>
          </Pressable>
          <Pressable onPress={() => setLeavesDropdownVisible(!leavesDropdownVisible)}>
            <Text style={styles.menuItem}>My Leaves ▾</Text>
          </Pressable>
          {leavesDropdownVisible && (
            <View style={styles.dropdown}>
              <Pressable onPress={() => handleNavigate("/dashboards/hr/request_leave")}>
                <Text style={styles.dropdownItem}>Request Leave</Text>
              </Pressable>
              <Pressable onPress={() => handleNavigate("/dashboards/hr/leave_status")}>
                <Text style={styles.dropdownItem}>Leave Status</Text>
              </Pressable>
            </View>
          )}
          <Pressable onPress={() => handleNavigate("/dashboards/hr/my_payslips")}>
            <Text style={styles.menuItem}>My Payslips</Text>
          </Pressable>
        </View>
      )}

      {profileMenuVisible && (
        <View style={styles.profileMenu}>
          <Pressable onPress={() => handleNavigate("../../profile/view_profile")}>
            <Text style={styles.menuItem}>View Profile</Text>
          </Pressable>
          <Pressable onPress={() => handleNavigate("../../profile/chng_password")}>
            <Text style={styles.menuItem}>Change Password</Text>
          </Pressable>
          <Pressable onPress={() => handleNavigate("../../(tabs)")}>
            <Text style={[styles.menuItem, { color: "red" }]}>Logout</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#22186F",
    borderBottomWidth: 1,
    borderColor: "#ccc",
    zIndex: 10,
    elevation: 5, // Android shadow
    shadowColor: "#000", // iOS shadow
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
  },
  navbar: {
    height: 60,
    marginTop:55,
    paddingHorizontal: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
  },
  adminText: {
    fontSize: 18,
    marginLeft: 10,
    fontWeight: "600",
    color: '#fff',
  },
  menu: {
    backgroundColor: "#fff",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderColor: "#ccc",
  },
  menuItem: {
    fontSize: 16,
    paddingVertical: 10,
    color: '#22186F',
  },
  profileMenu: {
    position: "absolute",
    right: 10,
    top: 110,
    backgroundColor: "#f9f9f9",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 15,
    zIndex: 10,
  },
  dropdown: {
    paddingLeft: 20,
    backgroundColor: '#fff',
  },
  dropdownItem: {
    fontSize: 14,
    paddingVertical: 8,
    color: '#22186F',
  },
});
