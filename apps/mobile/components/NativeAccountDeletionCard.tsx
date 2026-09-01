import { useState } from "react";
import type { Session } from "@supabase/auth-js";
import { Alert, Linking, Pressable, StyleSheet, Text, View } from "react-native";

import {
  clearNativeSessionAfterAccountDeletion,
  getNativeAppleDeletionAuthorizationCode
} from "../lib/auth";
import {
  deleteNativeAccount,
  nativeAccountDeletionNeedsAppleReauthorization
} from "../lib/account-deletion";
import { getMobileApiBaseUrl } from "../lib/env";
import { useMobileShell } from "../lib/mobile-shell";

const COPY = {
  ko: {
    title: "개인정보 · 계정",
    body: "개인정보 처리 기준을 확인하거나 계정과 연결된 피부·분석·추천·다이어리 데이터를 영구 삭제할 수 있습니다.",
    privacy: "개인정보 처리방침",
    externalDeletion: "웹 계정 삭제 페이지",
    delete: "계정 영구 삭제",
    deleting: "삭제 중…",
    confirmTitle: "계정을 삭제할까요?",
    confirmBody: "피부 프로필, 분석 결과, 추천 기록, 저장 리포트, 체크인과 루틴을 포함한 계정 연결 데이터가 영구 삭제됩니다. 이 작업은 되돌릴 수 없습니다.",
    cancel: "취소",
    continue: "영구 삭제",
    appleReauth: "Apple 로그인 계정은 삭제 직전에 Apple 재인증과 토큰 해제가 필요합니다.",
    failed: "계정을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    support: "보호된 운영·보안 감사 기록과 연결된 계정은 자동 삭제를 완료할 수 없습니다. 웹 삭제 페이지의 안내를 확인해 주세요."
  },
  en: {
    title: "Privacy · Account",
    body: "Review the privacy policy or permanently delete your account and associated skin, analysis, recommendation, report, and diary data.",
    privacy: "Privacy policy",
    externalDeletion: "Web account deletion page",
    delete: "Delete account permanently",
    deleting: "Deleting…",
    confirmTitle: "Delete your account?",
    confirmBody: "This permanently deletes account-linked skin profiles, analysis results, recommendation history, saved reports, check-ins, and routines. This cannot be undone.",
    cancel: "Cancel",
    continue: "Delete permanently",
    appleReauth: "Accounts using Sign in with Apple require Apple reauthorization and token revocation immediately before deletion.",
    failed: "We could not delete the account. Please try again shortly.",
    support: "Accounts tied to protected operational or security audit records cannot complete automatic deletion. Review the web deletion page for guidance."
  }
} as const;

type Props = {
  session: Session;
  onDeleted: () => void;
};

export function NativeAccountDeletionCard({ session, onDeleted }: Props) {
  const { locale, palette } = useMobileShell();
  const copy = COPY[locale];
  const [state, setState] = useState<"idle" | "deleting" | "error" | "support">("idle");
  const needsAppleReauthorization = nativeAccountDeletionNeedsAppleReauthorization(session);
  const baseUrl = getMobileApiBaseUrl().replace(/\/$/, "");

  async function openWebPath(path: string) {
    await Linking.openURL(`${baseUrl}${path}`);
  }

  async function performDeletion() {
    if (state === "deleting") return;

    setState("deleting");

    try {
      const appleAuthorizationCode = needsAppleReauthorization
        ? await getNativeAppleDeletionAuthorizationCode()
        : null;

      await deleteNativeAccount(session, { appleAuthorizationCode });
      await clearNativeSessionAfterAccountDeletion();
      onDeleted();
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      setState(code === "account_deletion_requires_support" ? "support" : "error");
    }
  }

  function confirmDeletion() {
    Alert.alert(copy.confirmTitle, copy.confirmBody, [
      { text: copy.cancel, style: "cancel" },
      {
        text: copy.continue,
        style: "destructive",
        onPress: () => void performDeletion()
      }
    ]);
  }

  return (
    <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <Text style={[styles.title, { color: palette.text }]}>{copy.title}</Text>
      <Text style={[styles.body, { color: palette.textMuted }]}>{copy.body}</Text>

      <Pressable
        accessibilityRole="link"
        accessibilityLabel="mobile-privacy-policy"
        onPress={() => void openWebPath(locale === "ko" ? "/privacy" : "/en/privacy")}
        style={[styles.linkButton, { borderColor: palette.border }]}
      >
        <Text style={[styles.linkText, { color: palette.text }]}>{copy.privacy}</Text>
      </Pressable>

      <Pressable
        accessibilityRole="link"
        accessibilityLabel="mobile-external-account-deletion"
        onPress={() => void openWebPath(locale === "ko" ? "/account-deletion" : "/en/account-deletion")}
        style={[styles.linkButton, { borderColor: palette.border }]}
      >
        <Text style={[styles.linkText, { color: palette.text }]}>{copy.externalDeletion}</Text>
      </Pressable>

      {needsAppleReauthorization ? (
        <Text style={[styles.hint, { color: palette.textMuted }]}>{copy.appleReauth}</Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="mobile-account-delete"
        disabled={state === "deleting"}
        onPress={confirmDeletion}
        style={({ pressed }) => [
          styles.deleteButton,
          {
            borderColor: "#dc6b6b",
            opacity: pressed || state === "deleting" ? 0.68 : 1
          }
        ]}
      >
        <Text style={styles.deleteText}>{state === "deleting" ? copy.deleting : copy.delete}</Text>
      </Pressable>

      {state === "error" ? <Text style={styles.errorText}>{copy.failed}</Text> : null}
      {state === "support" ? <Text style={styles.errorText}>{copy.support}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 18, padding: 18, gap: 12 },
  title: { fontSize: 18, fontWeight: "800" },
  body: { fontSize: 14, lineHeight: 21 },
  hint: { fontSize: 12, lineHeight: 18 },
  linkButton: {
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 16
  },
  linkText: { fontSize: 14, fontWeight: "700" },
  deleteButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 999,
    backgroundColor: "rgba(220, 107, 107, 0.08)",
    paddingHorizontal: 16
  },
  deleteText: { color: "#c54848", fontSize: 14, fontWeight: "800" },
  errorText: { color: "#c54848", fontSize: 12, lineHeight: 18, fontWeight: "600" }
});
