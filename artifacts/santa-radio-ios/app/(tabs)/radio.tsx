import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, useReducedMotion, cancelAnimation } from 'react-native-reanimated';
import { useRadio } from '@/lib/radio';
import { Screen, Eyebrow, Title, Body, Press, Notice, Skeleton } from '@/components/ui';
import { Logo } from '@/components/Brand';
const AView: any = Animated.View;
import { brand, fonts } from '@/constants/colors';

export default function Radio() {
  const r = useRadio();
  const reduced = useReducedMotion();
  const ring = useSharedValue(0);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    if (r.status === 'playing' && !reduced) ring.value = withRepeat(withTiming(1, { duration: 2200 }), -1, false);
    else { cancelAnimation(ring); ring.value = 0; }
  }, [r.status, reduced]);
  const ringStyle = useAnimatedStyle(() => ({ opacity: 0.55 * (1 - ring.value), transform: [{ scale: 1 + ring.value * 0.45 }] }));
  const toggle = async () => { if (busy) return; setBusy(true); try { await r.toggle(); } catch {} finally { setBusy(false); } };
  const playing = r.status === 'playing';
  const loading = r.status === 'loading';
  const label = loading ? 'Cancel connecting' : playing ? 'Pause' : r.status === 'error' ? 'Try again' : 'Listen Live';

  return (
    <Screen>
      <View style={{ alignItems: 'center', marginTop: 6 }}><Logo width={230} /></View>
      <Text style={s.tag}>Christmas Music 24 hours a day</Text>
      <View style={s.art}>
        {r.current?.artwork ? <Image source={{ uri: r.current.artwork }} style={StyleSheet.absoluteFill} contentFit="cover" transition={reduced ? 0 : 400} accessibilityLabel={'Artwork for ' + r.current.artist} />
          : <Image source={require('@/assets/images/brand/santa-studio-headphones.webp')} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityLabel="Santa wearing headphones" />}
        {playing ? <View style={s.liveBadge}><View style={s.liveDot} /><Text style={s.liveText}>LIVE</Text></View> : null}
      </View>
      <View style={{ alignItems: 'center', minHeight: 70 }} accessibilityLiveRegion="polite">
        {r.metadataStatus === 'loading' ? <><Skeleton h={18} w={160} /><Skeleton h={22} w={220} style={{ marginTop: 8 }} /></> : r.current && r.metadataStatus === 'ready' ? (
          <><Text style={s.artist}>{r.current.artist}</Text><Text style={s.song}>{r.current.title}</Text></>
        ) : <Text style={s.artist}>Live from the North Pole</Text>}
      </View>
      <View style={s.ctrl}>
        <AView style={[s.ring, ringStyle]} pointerEvents="none" />
        <Press accessibilityRole="button" accessibilityLabel={loading ? 'Cancel radio connection' : playing ? 'Pause Santa Radio' : 'Play Santa Radio live'} accessibilityState={{ busy: loading || busy }} onPress={toggle} style={s.pill}>
          <Ionicons name={playing ? 'pause' : loading ? 'hourglass-outline' : 'play'} size={26} color={brand.cream} />
          <Text style={s.pillText}>{label}</Text>
        </Press>
      </View>
      {r.status === 'error' ? <Notice message={r.error || 'The stream could not start. Check your connection and try again.'} onRetry={toggle} /> : null}
      <Body muted style={{ textAlign: 'center', marginTop: 14, fontSize: 14 }}>Keep listening while you make a message or check the tracker. Background audio is supported in the native iPhone build. Song details may lead the buffered audio.</Body>
    </Screen>
  );
}

const s = StyleSheet.create({
  tag: { color: brand.goldLight, fontFamily: fonts.display, fontSize: 16, textAlign: 'center', marginTop: 8 },
  art: { alignSelf: 'center', width: '82%', maxWidth: 340, aspectRatio: 1, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: brand.gold, marginVertical: 22, backgroundColor: brand.navy },
  liveBadge: { position: 'absolute', top: 12, left: 12, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#081e17cc', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: brand.redBright },
  liveText: { color: brand.cream, fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1.5 },
  artist: { color: brand.cream, fontFamily: fonts.semibold, fontSize: 18, textAlign: 'center' },
  song: { color: brand.muted, fontFamily: fonts.body, fontSize: 16, textAlign: 'center', marginTop: 4 },
  ctrl: { alignItems: 'center', justifyContent: 'center', marginTop: 18, minHeight: 80 },
  ring: { position: 'absolute', width: 220, height: 64, borderRadius: 999, borderWidth: 2, borderColor: brand.gold },
  pill: { minHeight: 64, minWidth: 220, borderRadius: 999, backgroundColor: brand.red, borderWidth: 1, borderColor: brand.redBright, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 26 },
  pillText: { color: brand.cream, fontFamily: fonts.semibold, fontSize: 18 },
});
