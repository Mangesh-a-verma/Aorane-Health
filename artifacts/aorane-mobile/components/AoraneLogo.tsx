import React from "react";
import { Image, ImageStyle, StyleProp } from "react-native";

type Props = {
  /** Logo width in pixels. Height auto-scales (logo aspect ratio ~1:1). */
  width?: number;
  /** @deprecated Older callers passed crossWidth — used as width fallback. */
  crossWidth?: number;
  /** @deprecated tagline is now baked into the logo image */
  showTagline?: boolean;
  /** @deprecated color is now baked into the logo image */
  color?: string;
  style?: StyleProp<ImageStyle>;
};

export default function AoraneLogo({ width, crossWidth, style }: Props) {
  const w = width ?? crossWidth ?? 140;
  return (
    <Image
      source={require("../assets/images/aorane-logo.png")}
      style={[{ width: w, height: w, resizeMode: "contain" }, style]}
    />
  );
}
