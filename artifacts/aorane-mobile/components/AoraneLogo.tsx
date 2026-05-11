import React from "react";
import { Image, ImageStyle, StyleProp } from "react-native";

const LOGO_ASPECT = 1342 / 757;

type Props = {
  width?: number;
  crossWidth?: number;
  showTagline?: boolean;
  color?: string;
  style?: StyleProp<ImageStyle>;
};

export default function AoraneLogo({ width, crossWidth, style }: Props) {
  const w = width ?? crossWidth ?? 180;
  const h = w / LOGO_ASPECT;
  return (
    <Image
      source={require("../assets/images/aorane-logo.png")}
      style={[{ width: w, height: h, resizeMode: "contain" }, style]}
    />
  );
}
