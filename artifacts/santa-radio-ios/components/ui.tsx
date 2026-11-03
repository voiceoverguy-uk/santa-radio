import React from 'react';
import { ActivityIndicator, Pressable, PressableProps, ScrollView, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle, StyleProp } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming, useReducedMotion, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
const AView: any = Animated.View;
import { brand, fonts } from '@/constants/colors';

export function useEntering(delay = 0) {
  const reduced = useReducedMotion();
  return reduced ? undefined : FadeInDown.duration(420).delay(delay);
}

type PressProps = PressableProps & { style?: StyleProp<ViewStyle>; haptic?: boolean; children?: React.ReactNode };
export function Press({ style, haptic = true, onPressIn, onPressOut, onPress, disabled, children, ...rest }: PressProps) {
  const reduced = useReducedMotion();
  const s = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Pressable
      {...rest}
      disabled={disabled}
      accessibilityState={{ disabled: !!disabled, ...(rest.accessibilityState || {}) }}
      onPressIn={e => { if (!reduced) s.value = withSpring(0.96, { damping: 18, stiffness: 420 }); onPressIn?.(e); }}
      onPressOut={e => { s.value = reduced ? 1 : withSpring(1, { damping: 14, stiffness: 260 }); onPressOut?.(e); }}
      onPress={e => { if (haptic) Haptics.selectionAsync().catch(() => {}); onPress?.(e); }}
    >
      <AView style={[style, anim, disabled ? { opacity: 0.55 } : null]}>{children}</AView>
    </Pressable>
  );
}

type BtnProps = { label: string; onPress?: () => void; variant?: 'red' | 'gold' | 'ghost'; icon?: keyof typeof Ionicons.glyphMap; busy?: boolean; disabled?: boolean; hint?: string; a11yLabel?: string };
export function Button({ label, onPress, variant = 'red', icon, busy, disabled, hint, a11yLabel }: BtnProps) {
  const bg = variant === 'red' ? brand.red : variant === 'gold' ? brand.glass : 'transparent';
  const border = variant === 'red' ? brand.redBright : variant === 'gold' ? brand.goldLine : 'transparent';
  return (
    <Press
      accessibilityRole="button"
      accessibilityLabel={a11yLabel || label}
      accessibilityHint={hint}
      accessibilityState={{ busy: !!busy, disabled: !!(disabled || busy) }}
      disabled={disabled || busy}
      onPress={onPress}
      style={[ui.btn, { backgroundColor: bg, borderColor: border }, variant === 'red' && ui.btnShadow]}
    >
      {busy ? <ActivityIndicator color={brand.cream} /> : icon ? <Ionicons name={icon} size={18} color={variant === 'ghost' ? brand.goldLight : brand.cream} /> : null}
      <Text style={[ui.btnText, variant === 'ghost' && { color: brand.goldLight }]}>{label}</Text>
    </Press>
  );
}

export function Screen({ children, scroll = true }: { children: React.ReactNode; scroll?: boolean }) {
  const insets = useSafeAreaInsets();
  const pad = { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 110, paddingHorizontal: 20 };
  return (
    <View style={{ flex: 1, backgroundColor: brand.navyDark }}>
      <LinearGradient colors={[brand.navy, brand.navyDark, brand.navyDark]} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
      {scroll ? (
        <ScrollView contentContainerStyle={pad} keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="never">{children}</ScrollView>
      ) : <View style={[{ flex: 1 }, pad]}>{children}</View>}
    </View>
  );
}

export function Eyebrow({ children }: { children: string }) {
  return <Text style={ui.eyebrow}>{children.toUpperCase()}</Text>;
}
export function Title({ children, size = 30 }: { children: React.ReactNode; size?: number }) {
  return <Text accessibilityRole="header" style={[ui.title, { fontSize: size, lineHeight: size * 1.22 }]}>{children}</Text>;
}
export function Body({ children, muted, style }: { children: React.ReactNode; muted?: boolean; style?: any }) {
  return <Text style={[ui.body, muted && { color: brand.muted }, style]}>{children}</Text>;
}
export function GoldRule() {
  return <View style={ui.rule} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><View style={ui.ruleLine} /><View style={ui.ruleDiamond} /><View style={ui.ruleLine} /></View>;
}

export function Card({ children, style, delay = 0 }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; delay?: number }) {
  const entering = useEntering(delay);
  return <AView entering={entering} style={[ui.card, style]}>{children}</AView>;
}

export function Field({ label, error, ...props }: TextInputProps & { label: string; error?: string }) {
  const [focus, setFocus] = React.useState(false);
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={ui.label}>{label}</Text>
      <TextInput
        {...props}
        accessibilityLabel={label}
        placeholderTextColor="#bcc9bd99"
        onFocus={e => { setFocus(true); props.onFocus?.(e); }}
        onBlur={e => { setFocus(false); props.onBlur?.(e); }}
        style={[ui.input, focus && { borderColor: brand.goldLight }]}
      />
      {error ? <Text style={ui.fieldErr}>{error}</Text> : null}
    </View>
  );
}

export function Notice({ tone = 'error', message, onRetry, retryLabel = 'Try again' }: { tone?: 'error' | 'info'; message: string; onRetry?: () => void; retryLabel?: string }) {
  const entering = useEntering();
  return (
    <AView entering={entering} accessibilityRole="alert" accessibilityLiveRegion="polite" style={[ui.notice, tone === 'error' ? { borderColor: brand.redBright, backgroundColor: '#9B111E26' } : { borderColor: brand.goldLine, backgroundColor: brand.glass }]}>
      <Ionicons name={tone === 'error' ? 'alert-circle' : 'information-circle'} size={20} color={tone === 'error' ? '#f0a0a8' : brand.goldLight} />
      <View style={{ flex: 1 }}>
        <Text style={ui.noticeText}>{message}</Text>
        {onRetry ? <Pressable accessibilityRole="button" onPress={onRetry} hitSlop={10} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={ui.link}>{retryLabel}</Text></Pressable> : null}
      </View>
    </AView>
  );
}

export function Skeleton({ h = 18, w = '100%' as any, style }: { h?: number; w?: any; style?: any }) {
  const reduced = useReducedMotion();
  const o = useSharedValue(0.35);
  React.useEffect(() => { if (!reduced) { const loop = () => { o.value = withTiming(o.value > 0.5 ? 0.35 : 0.7, { duration: 800 }); }; loop(); const t = setInterval(loop, 820); return () => clearInterval(t); } }, [reduced]);
  const a = useAnimatedStyle(() => ({ opacity: o.value }));
  return <AView style={[{ height: h, width: w, borderRadius: 10, backgroundColor: brand.navy }, a, style]} />;
}

export const ui = StyleSheet.create({
  btn: { minHeight: 52, borderRadius: 999, borderWidth: 1, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  btnShadow: { shadowColor: '#300b10', shadowOpacity: 0.5, shadowRadius: 14, shadowOffset: { width: 0, height: 7 } },
  btnText: { color: brand.cream, fontFamily: fonts.medium, fontSize: 16, textAlign: 'center', flexShrink: 1 },
  eyebrow: { color: brand.gold, fontFamily: fonts.semibold, fontSize: 12, letterSpacing: 2.2, marginBottom: 8 },
  title: { color: brand.cream, fontFamily: fonts.display },
  body: { color: brand.cream, fontFamily: fonts.body, fontSize: 16, lineHeight: 25 },
  rule: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 18 },
  ruleLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: brand.goldLine },
  ruleDiamond: { width: 7, height: 7, backgroundColor: brand.gold, transform: [{ rotate: '45deg' }] },
  card: { backgroundColor: '#123326e6', borderRadius: 22, borderWidth: 1, borderColor: brand.goldHair, padding: 20, marginBottom: 16 },
  label: { color: brand.goldLight, fontFamily: fonts.medium, fontSize: 14, marginBottom: 6 },
  input: { minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: brand.goldLine, backgroundColor: '#081e17cc', color: brand.cream, fontFamily: fonts.body, fontSize: 17, paddingHorizontal: 16 },
  fieldErr: { color: '#f0a0a8', fontFamily: fonts.body, fontSize: 14, marginTop: 4 },
  notice: { flexDirection: 'row', gap: 10, borderWidth: 1, borderRadius: 16, padding: 14, marginVertical: 10 },
  noticeText: { color: brand.cream, fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
  link: { color: brand.goldLight, fontFamily: fonts.semibold, fontSize: 15, textDecorationLine: 'underline' },
});
