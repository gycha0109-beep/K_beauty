import { StyleSheet, Text } from "react-native";
import { ScreenShell } from "../components/ScreenShell";

export default function AnalyzeScreen() {
  return (
    <ScreenShell
      eyebrow="ANALYZE"
      title="Native analysis entry"
      description="This route is a navigation placeholder for the future native survey and camera flow."
    >
      <Text style={styles.notice}>
        MOBILE-0 does not call /api/analyze and does not port the Recommendation Engine or browser camera implementation.
      </Text>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  notice: {
    fontSize: 15,
    lineHeight: 22,
    color: "#4B4458"
  }
});
