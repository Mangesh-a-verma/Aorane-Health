import { Stack } from "expo-router";

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
      <Stack.Screen name="language" />
      <Stack.Screen name="join-type" />
      <Stack.Screen name="enrollment-code" />
      <Stack.Screen name="department" />
      <Stack.Screen name="index" />
      <Stack.Screen name="physical" />
      <Stack.Screen name="health" />
      <Stack.Screen name="lifestyle" />
      <Stack.Screen name="goals" />
      <Stack.Screen name="permissions" />
    </Stack>
  );
}
