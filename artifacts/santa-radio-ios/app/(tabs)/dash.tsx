import React from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Screen, Eyebrow, Title, Body, Button, Notice, Press, GoldRule } from '@/components/ui';
import { brand } from '@/constants/colors';

const APP_STORE_URL = 'https://itunes.apple.com/gb/app/santa-dash-from-santa-guy/id1057048397';

export default function Dash() {
  const [err, setErr] = React.useState('');
  const open = async () => { setErr(''); try { await Linking.openURL(APP_STORE_URL); } catch { setErr('Could not open the App Store. Search for Santa Dash in the App Store instead.'); } };
  return (
    <Screen>
      <Eyebrow>A festive rooftop adventure</Eyebrow>
      <Title size={30}>Santa Dash{'\n'}Back to the Grotto</Title>
      <Body muted style={{ marginTop: 10 }}>Race across snowy rooftops with Santa collecting Golden Mince Pies!</Body>
      <Press accessibilityRole="link" accessibilityLabel="Santa Dash, Back to the Grotto: Santa leaps across snowy rooftops to collect mince pies. View on the App Store" onPress={open} style={s.art}>
        <Image source={require('@/assets/images/brand/santa-dash-back-to-the-grotto.webp')} style={{ width: '100%', aspectRatio: 1600 / 554 }} contentFit="cover" />
      </Press>
      <Press accessibilityRole="link" accessibilityLabel="Wobbly Bob in Santa Dash. View on the App Store" onPress={open} style={s.art}>
        <Image source={require('@/assets/images/brand/santa-dash-wobbly-bob.webp')} style={{ width: '100%', aspectRatio: 1600 / 555 }} contentFit="cover" />
      </Press>
      <GoldRule />
      <Button label="Download Santa Dash for iPhone and iPad" icon="logo-apple" onPress={open} hint="Opens the App Store" />
      {err ? <Notice message={err} onRetry={open} /> : null}
    </Screen>
  );
}

const s = StyleSheet.create({ art: { borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: brand.goldLine, marginTop: 18 } });
