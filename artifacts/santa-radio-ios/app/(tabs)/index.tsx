import React from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSantaApp } from '@/lib/mobile';
import type { Clip, NameResult } from '@/lib/contracts';
import { Screen, Card, Eyebrow, Title, Body, Button, Field, Notice, Press, GoldRule, Skeleton } from '@/components/ui';
import { Logo } from '@/components/Brand';
import { ClipPlayer } from '@/components/ClipPlayer';
import { brand, fonts } from '@/constants/colors';

const PRIVACY = 'https://www.santaradio.co.uk/privacy-policy';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function FreeMessage() {
  const app = useSantaApp();
  const [adult, setAdult] = React.useState(false);
  const [first, setFirst] = React.useState('');
  const [last, setLast] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [busy, setBusy] = React.useState<'' | 'signup' | 'lookup' | 'create'>('');
  const [err, setErr] = React.useState('');
  const [privacyErr, setPrivacyErr] = React.useState('');
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<NameResult[] | null>(null);
  const [picked, setPicked] = React.useState<NameResult | null>(null);
  const [clip, setClip] = React.useState<Clip | null>(null);
  const [now, setNow] = React.useState(Date.now());
  const busyRef = React.useRef(false);

  React.useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => { clearInterval(t); setResults(null); setPicked(null); setQuery(''); }; }, []);

  const run = async (kind: 'signup' | 'lookup' | 'create', fn: () => Promise<void>) => {
    if (busyRef.current) return; busyRef.current = true; setBusy(kind); setErr('');
    try { await fn(); } catch (e: any) { setErr(e?.message || 'Something went wrong. Please try again.'); }
    finally { busyRef.current = false; setBusy(''); }
  };
  const openPrivacy = async () => { setPrivacyErr(''); try { await Linking.openURL(PRIVACY); } catch { setPrivacyErr('Could not open the privacy notice. Visit santaradio.co.uk/privacy-policy in your browser.'); } };

  const validSignup = adult && first.trim() && last.trim() && EMAIL_RE.test(email.trim());
  const doSignup = () => run('signup', async () => {
    await app.signup({ FIRSTNAME: first.trim(), LASTNAME: last.trim(), EMAIL: email.trim() });
    setFirst(''); setLast(''); setEmail('');
  });
  const doLookup = () => { if (!query.trim()) return; run('lookup', async () => { setPicked(null); setResults(await app.lookup(query.trim())); }); };
  const doCreate = () => { if (!picked) return; run('create', async () => { setClip(await app.createFree(picked)); }); };

  const cooling = app.freeStatus.availableAt > now;
  const unlocked = app.freeStatus.authorized;
  const availableText = new Date(app.freeStatus.availableAt).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' });

  return (
    <Screen>
      <View style={{ alignItems: 'center', marginBottom: 4 }}><Logo width={210} /></View>
      <View style={s.hero}>
        <Image source={require('@/assets/images/brand/north-pole-hero-mobile.webp')} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityIgnoresInvertColors />
        <View style={s.heroShade} />
        <View style={{ padding: 20 }}>
          <Eyebrow>Free Santa message</Eyebrow>
          <Title size={28}>Their name. Santa's voice. A little Christmas magic.</Title>
        </View>
      </View>

      {!app.ready && !app.error ? <Card><Skeleton h={22} w="60%" /><Skeleton h={16} style={{ marginTop: 12 }} /><Skeleton h={50} style={{ marginTop: 16 }} /></Card> : null}
      {app.error ? <Notice message={app.error} onRetry={() => app.refresh().catch(() => {})} /> : null}

      {app.ready && clip ? (
        <Card>
          <Eyebrow>Delivered from the Post Room</Eyebrow>
          <Title size={22}>Santa has said hello to {picked?.name || 'them'}</Title>
          <View style={{ height: 14 }} />
          <ClipPlayer clip={clip} />
          <View style={{ height: 12 }} />
          <Button label="Make another message" variant="ghost" icon="refresh" onPress={() => { setClip(null); setPicked(null); setResults(null); setQuery(''); }} />
        </Card>
      ) : null}

      {app.ready && !clip && cooling ? (
        <Card>
          <View style={s.stampRow}><Ionicons name="time-outline" size={22} color={brand.goldLight} /><Text style={s.stampTitle}>The elves are resting the microphone</Text></View>
          <Body muted>Your next free message is ready from {availableText}. Free messages stay free - just come back then.</Body>
        </Card>
      ) : null}

      {app.ready && !clip && !cooling && !unlocked ? (
        <Card delay={80}>
          <Eyebrow>Step 1 of 2 - for grown-ups</Eyebrow>
          <Title size={22}>A quick hello from a parent or carer</Title>
          <Body muted style={{ marginVertical: 10 }}>Please use your own adult details, not a child's email. This is the same adult signup as the free website maker. Your details go to Santa Radio's mailing-list provider. There is no account or email ownership check; read the privacy notice before continuing.</Body>
          <Press accessibilityRole="checkbox" accessibilityState={{ checked: adult }} accessibilityLabel="I confirm I am 18 or over and am the parent, carer or adult requesting this message" onPress={() => setAdult(a => !a)} style={s.check}>
            <View style={[s.box, adult && s.boxOn]}>{adult ? <Ionicons name="checkmark" size={16} color={brand.navyDark} /> : null}</View>
            <Text style={s.checkText}>I am 18 or over and I am the adult requesting this message.</Text>
          </Press>
          <Field label="Your first name" value={first} onChangeText={setFirst} autoComplete="given-name" textContentType="givenName" />
          <Field label="Your last name" value={last} onChangeText={setLast} autoComplete="family-name" textContentType="familyName" />
          <Field label="Your email address" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" error={email && !EMAIL_RE.test(email.trim()) ? 'Please check this email address.' : undefined} />
          <Press accessibilityRole="link" onPress={openPrivacy} style={{ minHeight: 44, justifyContent: 'center', marginBottom: 8 }}><Text style={s.link}>Read how we use your details (privacy notice)</Text></Press>
          {privacyErr ? <Notice message={privacyErr} /> : null}
          {err ? <Notice message={err} onRetry={validSignup ? doSignup : undefined} /> : null}
          <Button label="Continue to the message desk" icon="arrow-forward" onPress={doSignup} busy={busy === 'signup'} disabled={!validSignup} hint={!adult ? 'Confirm you are 18 or over first' : undefined} />
        </Card>
      ) : null}

      {app.ready && !clip && !cooling && unlocked ? (
        <Card delay={80}>
          <Eyebrow>Step 2 of 2 - the message desk</Eyebrow>
          <Title size={22}>Who should Santa speak to?</Title>
          <Body muted style={{ marginVertical: 10 }}>Search for their first name. Santa only says names he has recorded, so pick the one that sounds right.</Body>
          <Field label="Child's first name" value={query} onChangeText={t => { setQuery(t); }} returnKeyType="search" onSubmitEditing={doLookup} autoCorrect={false} />
          <Button label="Find this name" icon="search" variant="gold" onPress={doLookup} busy={busy === 'lookup'} disabled={!query.trim()} />
          {results && results.length === 0 ? <Notice tone="info" message={'Santa has not recorded "' + query.trim() + '" yet. Try another spelling or a short form of the name.'} /> : null}
          {results && results.length > 0 ? (
            <View accessibilityRole="radiogroup" accessibilityLabel="Matching names" style={{ marginTop: 16, gap: 8 }}>
              {results.map(r => { const on = picked?.id === r.id; return (
                <Press key={r.id} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={r.name + (r.variant ? ', ' + r.variant : '')} onPress={() => setPicked(r)} style={[s.result, on && s.resultOn]}>
                  <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={22} color={on ? brand.gold : brand.muted} />
                  <View style={{ flex: 1 }}><Text style={s.resultName}>{r.name}</Text>{r.variant ? <Text style={s.resultVar}>{r.variant}</Text> : null}</View>
                </Press>); })}
            </View>
          ) : null}
          {err ? <Notice message={err} /> : null}
          {results && results.length > 0 ? <><GoldRule /><Button label={picked ? 'Create message for ' + picked.name : 'Choose a name above'} icon="mic" onPress={doCreate} busy={busy === 'create'} disabled={!picked} /></> : null}
        </Card>
      ) : null}

      <View style={s.footer}>
        <Image source={require('@/assets/images/brand/santa-post-stamp.png')} style={{ width: 64, height: 43 }} contentFit="contain" accessibilityIgnoresInvertColors />
        <Text style={s.footText}>Posted from the North Pole Post Room. Free messages are always free.</Text>
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  hero: { borderRadius: 24, overflow: 'hidden', minHeight: 230, justifyContent: 'flex-end', marginVertical: 14, borderWidth: 1, borderColor: brand.goldHair },
  heroShade: { ...StyleSheet.absoluteFill, backgroundColor: '#081e1799' },
  check: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', minHeight: 44, paddingVertical: 8, marginBottom: 10 },
  box: { width: 26, height: 26, borderRadius: 7, borderWidth: 1.5, borderColor: brand.gold, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  boxOn: { backgroundColor: brand.gold },
  checkText: { flex: 1, color: brand.cream, fontFamily: fonts.medium, fontSize: 15, lineHeight: 22 },
  link: { color: brand.goldLight, fontFamily: fonts.medium, fontSize: 15, textDecorationLine: 'underline' },
  result: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: brand.goldHair },
  resultOn: { borderColor: brand.gold, backgroundColor: brand.navy },
  resultName: { color: brand.cream, fontFamily: fonts.semibold, fontSize: 17 },
  resultVar: { color: brand.muted, fontFamily: fonts.body, fontSize: 14 },
  stampRow: { flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 8 },
  stampTitle: { flex: 1, color: brand.goldLight, fontFamily: fonts.display, fontSize: 18 },
  footer: { flexDirection: 'row', gap: 12, alignItems: 'center', opacity: 0.85, marginTop: 6 },
  footText: { flex: 1, color: brand.muted, fontFamily: fonts.body, fontSize: 13, lineHeight: 19 },
});
