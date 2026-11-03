import React from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, useReducedMotion } from 'react-native-reanimated';
import { trackerSnapshot } from '@/lib/tracker';
import { Screen, Card, Eyebrow, Title, Body, Notice } from '@/components/ui';
const AView: any = Animated.View;
import { brand, fonts } from '@/constants/colors';

export default function Tracker() {
  const [snap, setSnap] = React.useState(() => { try { return trackerSnapshot(new Date()); } catch { return null; } });
  const reduced = useReducedMotion();
  const p = useSharedValue(0);
  const update = React.useCallback(() => { try { setSnap(trackerSnapshot(new Date())); } catch { setSnap(null); } }, []);
  React.useEffect(() => {
    const t = setInterval(update, 30000);
    const sub = AppState.addEventListener('change', st => { if (st === 'active') update(); });
    return () => { clearInterval(t); sub.remove(); };
  }, [update]);
  const prog = Math.max(0, Math.min(1, snap?.progress ?? 0));
  React.useEffect(() => { p.value = reduced ? prog : withTiming(prog, { duration: 900 }); }, [prog, reduced]);
  const bar = useAnimatedStyle(() => ({ transform: [{ scaleX: Math.max(0.001, p.value) }] }));

  return (
    <Screen>
      <Eyebrow>Santa Tracker</Eyebrow>
      {!snap ? <Notice message="The tracker could not be worked out right now." onRetry={update} /> : (
        <>
          <Title size={28}>{snap.title}</Title>
          <Text style={s.phase}>{snap.phase}</Text>
          <View style={s.hero}>
            <Image source={require('@/assets/images/brand/tracker-background.webp')} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityIgnoresInvertColors />
            <View style={s.heroShade} />
            <View style={{ padding: 18 }} accessibilityLiveRegion="polite">
              <Text style={s.small}>NOW</Text>
              <Text style={s.loc}>{snap.location}</Text>
              <Text style={s.small}>{snap.phase === 'LIVE' ? 'Estimated local time' : 'Phone clock'} {snap.localTime}</Text>
            </View>
          </View>
          <View style={s.track} accessibilityRole="progressbar" accessibilityLabel="Journey progress" accessibilityValue={{ min: 0, max: 100, now: Math.round(prog * 100) }}>
            <AView style={[s.fill, bar]} />
          </View>
          <View style={s.next}><Ionicons name="navigate" size={18} color={brand.gold} /><Text style={s.nextText}>Next stop: <Text style={{ color: brand.goldLight }}>{snap.nextLocation}</Text></Text></View>
          <Card><Body>{snap.description}</Body></Card>
          {snap.tradition ? (
            <Card delay={80}>
              <Eyebrow>Christmas here</Eyebrow>
              <Body>{snap.tradition}</Body>
              {snap.traditionSource ? <Text style={s.src}>Source: {snap.traditionSource}</Text> : null}
            </Card>
          ) : null}
        </>
      )}
      <View style={s.note}>
        <Ionicons name="information-circle-outline" size={18} color={brand.muted} />
        <Text style={s.noteText}>This is a simulated seasonal journey, estimated from this phone's clock. It does not use GPS or your location, and updates every 30 seconds.</Text>
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  phase: { color: brand.gold, fontFamily: fonts.medium, fontSize: 14, marginTop: 6 },
  hero: { borderRadius: 22, overflow: 'hidden', minHeight: 180, justifyContent: 'flex-end', marginVertical: 16, borderWidth: 1, borderColor: brand.goldHair },
  heroShade: { ...StyleSheet.absoluteFill, backgroundColor: '#081e1799' },
  small: { color: brand.goldLight, fontFamily: fonts.semibold, fontSize: 12, letterSpacing: 1.5 },
  loc: { color: brand.cream, fontFamily: fonts.display, fontSize: 26, marginVertical: 4 },
  track: { height: 8, borderRadius: 4, backgroundColor: brand.navy, overflow: 'hidden' },
  fill: { height: 8, width: '100%', backgroundColor: brand.gold, transformOrigin: 'left' },
  next: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 14 },
  nextText: { flex: 1, color: brand.cream, fontFamily: fonts.medium, fontSize: 16 },
  src: { color: brand.muted, fontFamily: fonts.body, fontSize: 13, marginTop: 8 },
  note: { flexDirection: 'row', gap: 8, marginTop: 6 },
  noteText: { flex: 1, color: brand.muted, fontFamily: fonts.body, fontSize: 13, lineHeight: 19 },
});
