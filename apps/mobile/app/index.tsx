import { FACE_CAPTURE_STATES, SUPPORTED_LOCALES } from "@bejewely/shared";
import { StyleSheet, Text, View } from "react-native";
import { ScreenShell } from "../components/ScreenShell";

export default function HomeScreen() {
  return (
    <ScreenShell
      eyebrow="MOBILE-0"
      title="BEJEWELY Mobile"
      description="Web authority stays intact while the native client foundation is added beside it."
    >
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Foundation ready</Text>
        <Text style={styles.cardBody}>Native routes: Home · Analyze · My</Text>
        <Text style={styles.cardBody}>Locales reserved: {SUPPORTED_LOCALES.join(" / ")}</Text>
        <Text style={styles.cardBody}>Face capture contract states: {FACE_CAPTURE_STATES.length}</Text>
      </View>
      <Text style={styles.note}>
        Authentication, camera capture, analysis requests, and Premium are intentionally not implemented in MOBILE-0.
      </Text>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    gap: 8,
    padding: 20,
    borderRadius: 20,
    backgroundColor: "#F3F0FF"
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#201A2E"
  },
  cardBody: {
    fontSize: 15,
    lineHeight: 21,
    color: "#4B4458"
  },
  note: {
    fontSize: 14,
    lineHeight: 20,
    color: "#6A6471"
  }
});
