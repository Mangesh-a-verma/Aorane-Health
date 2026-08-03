import colors from "@/constants/colors";

/**
 * Returns the design tokens for the app's single (light) palette.
 *
 * The app does not support dark mode, so this always returns
 * `colors.light` regardless of the device's appearance setting.
 */
export function useColors() {
  return { ...colors.light, radius: colors.radius };
}
