import { Redirect } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useColors } from "@/hooks/useColors";

export default function Index() {
  const { isLoading, isAuthenticated, isOnboardingDone, isPinSet } = useAuth();
  const colors = useColors();

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!isAuthenticated) return <Redirect href="/(auth)/login" />;
  if (!isOnboardingDone) return <Redirect href="/(onboarding)/" />;
  if (!isPinSet) return <Redirect href="/(auth)/setup-pin" />;
  return <Redirect href="/(tabs)/dashboard" />;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
