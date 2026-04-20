import React from "react";
import Svg, { Line, Text as SvgText } from "react-native-svg";

type Props = {
  color?: string;
  width?: number;
  height?: number;
  showTagline?: boolean;
};

export default function AoraneLogo({ color = "#E8622A", width = 200, height = 54, showTagline = true }: Props) {
  const scale = width / 270;
  const h = showTagline ? height : height * 0.7;

  return (
    <Svg width={width} height={h} viewBox={`0 0 270 ${showTagline ? 72 : 50}`} fill="none">
      <Line x1="6" y1="36" x2="78" y2="36" stroke={color} strokeWidth="1.9" />
      <Line x1="42" y1="6" x2="42" y2="66" stroke={color} strokeWidth="1.9" />
      <Line x1="37.5" y1="6" x2="46.5" y2="6" stroke={color} strokeWidth="1.9" />
      <Line x1="37.5" y1="66" x2="46.5" y2="66" stroke={color} strokeWidth="1.9" />
      <Line x1="6" y1="31.5" x2="6" y2="40.5" stroke={color} strokeWidth="1.9" />
      <Line x1="78" y1="31.5" x2="78" y2="40.5" stroke={color} strokeWidth="1.9" />
      <SvgText
        x="92" y="41"
        fontFamily="Inter_700Bold, Inter, Arial, sans-serif"
        fontSize="19"
        fontWeight="700"
        letterSpacing="5"
        fill={color}
      >
        AORANE
      </SvgText>
      {showTagline && (
        <SvgText
          x="93" y="56"
          fontFamily="Inter_400Regular, Inter, Arial, sans-serif"
          fontSize="7.5"
          fill={color}
          fillOpacity={0.65}
        >
          स्वस्थस्य स्वास्थ्य रक्षणं।
        </SvgText>
      )}
    </Svg>
  );
}
