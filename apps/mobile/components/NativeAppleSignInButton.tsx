import { useEffect, useState } from "react";
import * as AppleAuthentication from "expo-apple-authentication";
import { Platform, StyleSheet, View } from "react-native";

type NativeAppleSignInButtonProps = {
  disabled?: boolean;
  onPress: () => void;
};

export function NativeAppleSignInButton({ disabled = false, onPress }: NativeAppleSignInButtonProps) {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    let active = true;

    if (Platform.OS !== "ios") {
      setAvailable(false);
      return () => {
        active = false;
      };
    }

    AppleAuthentication.isAvailableAsync()
      .then((value) => active && setAvailable(value))
      .catch(() => active && setAvailable(false));

    return () => {
      active = false;
    };
  }, []);

  if (!available) return null;

  return (
    <View pointerEvents={disabled ? "none" : "auto"} style={disabled ? styles.disabled : undefined}>
      <AppleAuthentication.AppleAuthenticationButton
        accessibilityLabel="mobile-apple-sign-in"
        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
        cornerRadius={23}
        style={styles.button}
        onPress={onPress}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  button: { width: "100%", height: 46 },
  disabled: { opacity: 0.72 }
});
