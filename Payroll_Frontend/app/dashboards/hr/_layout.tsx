import { View, StyleSheet } from "react-native";
import Navbar from "./navbar";
import { Slot } from "expo-router";


export default function Layout() {
  return (
    <View style={styles.container}>
      <Navbar />
      <View style={styles.content}>
        <Slot />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
  },
  content: {
    flex: 1,
    padding: 16,
  },
});
