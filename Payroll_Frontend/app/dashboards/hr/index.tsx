import { View, Text, StyleSheet } from "react-native";

export default function HRHome() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome!!</Text>
      <Text style={styles.subtitle}>HR</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    flex: 1,
    alignItems: "center",
    justifyContent: "center",

  },
  title: {
    fontSize: 30,
    fontWeight: "bold",
    color: "#22186F",
  },
  subtitle: {
    fontSize: 28,
    fontWeight: "semibold",
    color: "#22186F",
  },
});
