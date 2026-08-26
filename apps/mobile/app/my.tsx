import { StyleSheet, Text } from "react-native";
import { ScreenShell } from "../components/ScreenShell";

export default function MyScreen() {
  return (
    <ScreenShell
      eyebrow="MY"
      title="Native account space"
      description="This route reserves the native My experience without changing the existing authenticated Web APIs."
    >
      <Text style={styles.notice}>
        Supabase mobile authentication and Bearer-token server authorization belong to MOBILE-2 and are intentionally absent here.
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
