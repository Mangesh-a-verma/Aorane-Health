import { Stack } from "expo-router";

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="physical" />
      <Stack.Screen name="health" />
      <Stack.Screen name="lifestyle" />
      <Stack.Screen name="goals" />
    </Stack>
  );
}
