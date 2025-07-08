import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
  SafeAreaView,
} from "react-native";
import {
  Card,
  Text as PaperText,
  Searchbar,
  IconButton,
  Menu,
  Provider,
  Chip,
  useTheme,
} from "react-native-paper";
import { DatePickerModal } from "react-native-paper-dates";
import axios from "axios";
import { getAccessToken } from "../../auth";

const { width } = Dimensions.get("window");

interface LeaveRequest {
  id: number;
  employee_id: number;
  employee_name: string;
  start_date: string;
  end_date: string;
  total_days: number;
  leave_type: string;
  status: string;
  warning_message?: string;
  note?: string;
}

export default function AllRequestsScreen() {
  const theme = useTheme();

  // existing state
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [menuVisible, setMenuVisible] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);

  // new date‐range state
  const [range, setRange] = useState<{ startDate?: Date; endDate?: Date }>({});
  const [openPicker, setOpenPicker] = useState(false);

  useEffect(() => {
    const loadRequests = async () => {
      try {
        const token = await getAccessToken();
        const response = await axios.get<LeaveRequest[]>(
          "http://192.168.220.49:8000/api/leave-requests/all-leave-requests/",
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setRequests(response.data);
      } catch (err: any) {
        console.error("Failed to fetch leave requests:", err);
        if (err.response?.status === 401) {
          console.warn("Token expired or invalid—redirecting to login");
        }
      } finally {
        setLoading(false);
      }
    };

    loadRequests();
  }, []);

  const filteredAndSorted = useMemo(() => {
    return requests
      .filter((r) => {
        const name = r.employee_name.toLowerCase();
        const status = r.status.toLowerCase();

        if (status === "pending") return false;

        const matchesStatus = filterStatus
          ? status === filterStatus
          : status === "approved" || status === "rejected";

        const matchesSearch = name.includes(searchQuery.toLowerCase());

        const afterStart = range.startDate
          ? new Date(r.start_date) >= range.startDate
          : true;
        const beforeEnd = range.endDate
          ? new Date(r.end_date) <= range.endDate
          : true;

        return matchesStatus && matchesSearch && afterStart && beforeEnd;
      })
      .sort(
        (a, b) =>
          new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
      );
  }, [requests, searchQuery, filterStatus, range]);

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  const renderStatusChip = (status: string) => {
    let chipStyle = { backgroundColor: "#EDE9FE" }; // indigo-100
    let textColor = "#4338CA"; // indigo-700

    switch (status.toLowerCase()) {
      case "approved":
        chipStyle = { backgroundColor: "#E3FCEF" }; // mint-100
        textColor = "#047857"; // emerald-700
        break;
      case "rejected":
        chipStyle = { backgroundColor: "#FEE2E2" }; // rose-100
        textColor = "#B91C1C"; // rose-800
        break;
    }

    return (
      <Chip style={[styles.chip, chipStyle]} textStyle={{ color: textColor }}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Chip>
    );
  };

  return (
    <Provider>
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <View style={[styles.header, { backgroundColor: theme.colors.primary }]}>
          {/* Search */}
          <Searchbar
            placeholder="Search by name"
            onChangeText={setSearchQuery}
            value={searchQuery}
            style={[styles.search, { backgroundColor: theme.colors.surface }]}
            iconColor={theme.colors.onSurface}
            inputStyle={{ color: theme.colors.onSurface }}
          />

          {/* Selected date‐range label */}
          <PaperText
            style={{ color: theme.colors.onPrimary, marginHorizontal: 8 }}
          >
            {range.startDate && range.endDate
              ? `${range.startDate.toLocaleDateString()} → ${range.endDate.toLocaleDateString()}`
              : "All dates"}
          </PaperText>

          {/* Clear‐range button */}
          {(range.startDate || range.endDate) && (
            <IconButton
              icon="close-circle"
              size={24}
              onPress={() => setRange({})}
              iconColor={theme.colors.onPrimary}
            />
          )}

          {/* Calendar button */}
          <IconButton
            icon="calendar-range"
            size={24}
            onPress={() => setOpenPicker(true)}
            iconColor={theme.colors.onPrimary}
          />

          {/* Status‐filter menu */}
          <Menu
            visible={menuVisible}
            onDismiss={() => setMenuVisible(false)}
            anchor={
              <IconButton
                icon="filter-variant"
                size={24}
                onPress={() => setMenuVisible(true)}
                iconColor={theme.colors.onPrimary}
              />
            }
          >
            <Menu.Item
              onPress={() => {
                setFilterStatus(null);
                setMenuVisible(false);
              }}
              title="All"
            />
            <Menu.Item
              onPress={() => {
                setFilterStatus("approved");
                setMenuVisible(false);
              }}
              title="Approved"
            />
            <Menu.Item
              onPress={() => {
                setFilterStatus("rejected");
                setMenuVisible(false);
              }}
              title="Rejected"
            />
          </Menu>

          {/* Date‐range picker modal */}
          <DatePickerModal
            locale="en"
            mode="range"
            visible={openPicker}
            onDismiss={() => setOpenPicker(false)}
            startDate={range.startDate}
            endDate={range.endDate}
            onConfirm={({ startDate, endDate }) => {
              setOpenPicker(false);
              setRange({ startDate, endDate });
            }}
          />
        </View>

        <FlatList
          contentContainerStyle={styles.list}
          data={filteredAndSorted}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <Card
              style={[styles.card, { backgroundColor: theme.colors.surface }]}
              elevation={4}
            >
              <Card.Content>
                {/* ROW 1: user | dates & total days | type | status */}
                <View style={styles.rowDetails}>
                  <PaperText
                    variant="titleMedium"
                    style={[styles.detailText, { color: theme.colors.onSurface }]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {item.employee_name}
                  </PaperText>
                  <PaperText
                    variant="bodyMedium"
                    style={[styles.detailText, styles.dateText, { color: theme.colors.onSurfaceVariant }]}
                  >
                    {new Date(item.start_date).toLocaleDateString()} –{" "}
                    {new Date(item.end_date).toLocaleDateString()} ({item.total_days} day{item.total_days > 1 ? "s" : ""})
                  </PaperText>
                  <PaperText
                    variant="bodyMedium"
                    style={[styles.detailText, styles.typeText, { color: theme.colors.onSurfaceVariant }]}
                  >
                    {item.leave_type}
                  </PaperText>
                  {renderStatusChip(item.status)}
                </View>

                {/* ROW 2: note and/or warning */}
                {(item.note || item.warning_message) && (
                  <View style={styles.rowNote}>
                    {item.note && (
                      <PaperText
                        variant="bodySmall"
                        style={[styles.noteText, styles.typeText, { color: theme.colors.onSurfaceVariant }]}
                      >
                        Note: {item.note}
                      </PaperText>
                    )}
                    {item.warning_message && (
                      <PaperText
                        variant="bodySmall"
                        style={[styles.noteText, { color: theme.colors.error }]}
                      >
                        {item.warning_message}
                      </PaperText>
                    )}
                  </View>
                )}
              </Card.Content>
            </Card>
          )}
        />
      </SafeAreaView>
    </Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  appbar: {
    elevation: 2,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    elevation: 2,
  },
  search: {
    flex: 1,
    marginRight: 8,
    borderRadius: 8,
  },
  list: {
    padding: 12,
  },
  card: {
    width: width * 0.92,
    marginBottom: 16,
    borderRadius: 12,
    shadowColor: "#00000033",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
  },
  rowDetails: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "nowrap",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  detailText: {
    marginRight: 12,
    flexShrink: 1,
  },
  dateText: {
    fontSize: 14,
  },
  typeText: {
    fontSize: 14,
  },
  rowNote: {
    flexDirection: "column",
    marginTop: 4,
  },
  noteText: {
    marginTop: 2,
  },
  chip: {
    height: 24,
    justifyContent: "center",
  },
  loaderContainer: {
    flex: 1,
    justifyContent: "center",
  },
});
