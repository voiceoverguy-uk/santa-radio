import React from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';

export function Logo({ width = 220 }: { width?: number }) {
  return (
    <View accessible accessibilityRole="image" accessibilityLabel="Santa Radio">
      <Image source={require('@/assets/images/brand/santa-radio-logo.png')} style={{ width, height: width * 190 / 827 }} contentFit="contain" />
    </View>
  );
}
