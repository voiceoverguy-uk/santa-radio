import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import { Press, Notice, Button } from '@/components/ui';
import { brand, fonts } from '@/constants/colors';
import { useRadio } from '@/lib/radio';
import type { Clip } from '@/lib/contracts';

function fmt(s: number) { const t = Math.max(0, Math.floor(s || 0)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); }

export function ClipPlayer({ clip, title = 'Your message from Santa' }: { clip: Clip; title?: string }) {
  const player = useAudioPlayer({ uri: clip.uri });
  const status = useAudioPlayerStatus(player);
  const radio = useRadio();
  const [shareErr, setShareErr] = React.useState('');
  const [playErr, setPlayErr] = React.useState('');
  const [sharing, setSharing] = React.useState(false);
  const playing = status.playing;
  const dur = status.duration || 0;
  const pos = status.currentTime || 0;
  const progress = dur > 0 ? Math.min(1, pos / dur) : 0;

  React.useEffect(() => { if (status.didJustFinish) { player.seekTo(0); } }, [status.didJustFinish]);
  React.useEffect(() => {
    if (status.playbackState === 'error') setPlayErr('The temporary recording could not play. Try again, or save it using the share sheet.');
  }, [status.playbackState]);
  React.useEffect(() => { if (radio.status === 'playing' || radio.status === 'loading') player.pause(); }, [radio.status]);

  const toggle = async () => {
    setPlayErr('');
    try {
      if (playing) { player.pause(); return; }
      radio.pause();
      await setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'doNotMix', shouldPlayInBackground: false });
      player.play();
    } catch { setPlayErr('The recording could not start. It may have expired from this session.'); }
  };
  const share = async () => {
    setShareErr(''); setSharing(true);
    try {
      if (!(await Sharing.isAvailableAsync())) throw new Error('Saving and sharing is not available on this device.');
      await Sharing.shareAsync(clip.uri, { mimeType: 'audio/mpeg', dialogTitle: 'Save or share ' + clip.name, UTI: 'public.mp3' });
    } catch (e: any) { setShareErr(e?.message || 'Could not open the share sheet. Please try again.'); }
    finally { setSharing(false); }
  };

  return (
    <View style={s.wrap}>
      <View style={s.row}>
        <Press accessibilityRole="button" accessibilityLabel={playing ? 'Pause ' + title : 'Play ' + title} onPress={toggle} style={s.play}>
          <Ionicons name={playing ? 'pause' : 'play'} size={30} color={brand.cream} style={!playing ? { marginLeft: 4 } : undefined} />
        </Press>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{title}</Text>
          <Text style={s.name} numberOfLines={1}>{clip.name}</Text>
        </View>
      </View>
      <View style={s.track} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: Math.round(dur), now: Math.round(pos), text: fmt(pos) + ' of ' + fmt(dur) }}>
        <View style={[s.fill, { width: (progress * 100) + '%' as any }]} />
      </View>
      <View style={s.times}><Text style={s.time}>{fmt(pos)}</Text><Text style={s.time}>{status.isLoaded ? fmt(dur) : 'Loading'}</Text></View>
      <Button label="Save or share" icon="share-outline" variant="gold" onPress={share} busy={sharing} hint="Opens the share sheet so you can save the audio file" />
      {shareErr ? <Notice message={shareErr} onRetry={share} /> : null}
      {playErr ? <Notice message={playErr} onRetry={toggle} /> : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { backgroundColor: brand.navyDark, borderRadius: 22, borderWidth: 1, borderColor: brand.gold, padding: 18, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  play: { width: 64, height: 64, borderRadius: 32, backgroundColor: brand.red, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: brand.gold },
  title: { color: brand.goldLight, fontFamily: fonts.display, fontSize: 18 },
  name: { color: brand.muted, fontFamily: fonts.body, fontSize: 14, marginTop: 2 },
  track: { height: 6, borderRadius: 3, backgroundColor: brand.navy, overflow: 'hidden' },
  fill: { height: 6, backgroundColor: brand.gold },
  times: { flexDirection: 'row', justifyContent: 'space-between' },
  time: { color: brand.muted, fontFamily: fonts.medium, fontSize: 13 },
});
