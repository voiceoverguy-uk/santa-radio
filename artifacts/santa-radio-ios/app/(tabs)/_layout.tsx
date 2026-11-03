import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { brand, fonts } from '@/constants/colors';
import { useRadio } from '@/lib/radio';

type IconName = keyof typeof Ionicons.glyphMap;
const icon = (on: IconName, off: IconName) => ({ color, focused }: { color: any; focused: boolean }) => (
  <Ionicons name={focused ? on : off} size={24} color={color} />
);

function RadioIcon({ color, focused }: { color: any; focused: boolean }) {
  const { status } = useRadio();
  return (
    <View>
      <Ionicons name={focused ? 'radio' : 'radio-outline'} size={25} color={color} />
      {status === 'playing' ? <View style={s.live} /> : null}
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: brand.goldLight,
        tabBarInactiveTintColor: brand.muted,
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11 },
        tabBarStyle: { position: 'absolute', borderTopColor: brand.goldHair, backgroundColor: Platform.OS === 'ios' ? 'transparent' : brand.navyDark, elevation: 0 },
        tabBarBackground: () => Platform.OS === 'ios'
          ? <BlurView intensity={70} tint="dark" style={[StyleSheet.absoluteFill, { backgroundColor: '#081e17b3' }]} />
          : <View style={[StyleSheet.absoluteFill, { backgroundColor: brand.navyDark }]} />,
        tabBarAllowFontScaling: true,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Free Message', tabBarAccessibilityLabel: 'Free Santa Message', tabBarIcon: icon('mail', 'mail-outline') }} />
      <Tabs.Screen name="studio" options={{ title: 'Santa Studio', tabBarAccessibilityLabel: 'Santa Studio', tabBarIcon: icon('mic', 'mic-outline') }} />
      <Tabs.Screen name="radio" options={{ title: 'Santa Radio', tabBarAccessibilityLabel: 'Santa Radio live', tabBarIcon: RadioIcon }} />
      <Tabs.Screen name="dash" options={{ title: 'Santa Dash', tabBarAccessibilityLabel: 'Santa Dash game', tabBarIcon: icon('game-controller', 'game-controller-outline') }} />
      <Tabs.Screen name="tracker" options={{ title: 'Santa Tracker', tabBarAccessibilityLabel: 'Santa Tracker', tabBarIcon: icon('navigate', 'navigate-outline') }} />
    </Tabs>
  );
}

const s = StyleSheet.create({ live: { position: 'absolute', top: -1, right: -3, width: 8, height: 8, borderRadius: 4, backgroundColor: brand.redBright, borderWidth: 1, borderColor: brand.navyDark } });
