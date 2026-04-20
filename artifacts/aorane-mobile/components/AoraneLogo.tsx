import React from "react";
import { View, Text } from "react-native";
import Svg, { Line } from "react-native-svg";

type Props = {
  color?: string;
  crossWidth?: number;
  showTagline?: boolean;
  width?: number;
};

export default function AoraneLogo({
  color = "#E8622A",
  crossWidth,
  width,
  showTagline = true,
}: Props) {
  const cw = crossWidth ?? (width ? width * 0.55 : 90);
  const scale = cw / 72;
  const crossH = 60 * scale;
  const sw = Math.max(1.2, 1.9 * scale);

  const textLeft = 38 * scale;
  const nameTop = 33 * scale;
  const nameFontSize = Math.max(7, 13 * scale);
  const nameLs = Math.max(1.5, 3.5 * scale);
  const tagFontSize = Math.max(5, 7 * scale);

  return (
    <View style={{ width: cw, height: crossH }}>
      <Svg width={cw} height={crossH} viewBox="0 0 72 60">
        <Line x1="0" y1="30" x2="72" y2="30" stroke={color} strokeWidth={sw} />
        <Line x1="36" y1="0" x2="36" y2="60" stroke={color} strokeWidth={sw} />
        <Line x1="31.5" y1="0" x2="40.5" y2="0" stroke={color} strokeWidth={sw} />
        <Line x1="31.5" y1="60" x2="40.5" y2="60" stroke={color} strokeWidth={sw} />
        <Line x1="0" y1="25.5" x2="0" y2="34.5" stroke={color} strokeWidth={sw} />
        <Line x1="72" y1="25.5" x2="72" y2="34.5" stroke={color} strokeWidth={sw} />
      </Svg>

      <View style={{ position: "absolute", left: textLeft, top: nameTop }}>
        <Text
          style={{
            color,
            fontSize: nameFontSize,
            fontWeight: "700",
            fontFamily: "Inter_700Bold",
            letterSpacing: nameLs,
          }}
          numberOfLines={1}
        >
          AORANE
        </Text>
        {showTagline && (
          <Text
            style={{
              color,
              fontSize: tagFontSize,
              opacity: 0.65,
              marginTop: 2 * scale,
            }}
            numberOfLines={1}
          >
            स्वस्थस्य स्वास्थ्य रक्षणं।
          </Text>
        )}
      </View>
    </View>
  );
}
