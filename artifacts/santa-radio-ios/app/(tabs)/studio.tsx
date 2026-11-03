import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import { useSantaApp } from '@/lib/mobile';
import type { Catalogue, Choice, Clip, NameResult, StudioChoices } from '@/lib/contracts';
import { Screen, Card, Eyebrow, Title, Body, Button, Field, Notice, Press, GoldRule, Skeleton, useEntering } from '@/components/ui';
import { ChoiceList } from '@/components/ChoiceList';
import { ClipPlayer } from '@/components/ClipPlayer';
const AView: any = Animated.View;
import { brand, fonts } from '@/constants/colors';

type Cat = 'age' | 'activity' | 'achievement' | 'treat' | 'place';
const STAGES: { key: Cat; label: string; prompt: string }[] = [
  { key: 'age', label: 'Age', prompt: 'How old are they?' },
  { key: 'activity', label: 'Activity', prompt: 'What have they been busy doing?' },
  { key: 'achievement', label: 'Achievement', prompt: 'What should Santa be proud of?' },
  { key: 'treat', label: 'Treat', prompt: 'Which treat should Santa mention?' },
  { key: 'place', label: 'Place', prompt: 'Where do they live?' },
];

export default function Studio() {
  const app = useSantaApp();
  const [completed, setCompleted] = React.useState<{ clip: Clip; name: string } | null>(null);
  const [busy, setBusy] = React.useState('');
  const [err, setErr] = React.useState('');
  const lock = React.useRef(false);
  const run = async (k: string, fn: () => Promise<void>) => {
    if (lock.current) return; lock.current = true; setBusy(k); setErr('');
    try { await fn(); } catch (e: any) { setErr(e?.message || 'Something went wrong. Please try again.'); }
    finally { lock.current = false; setBusy(''); }
  };
  const ent = app.entitlement;
  const open = ent.verified && (ent.permanent || ent.credits > 0);

  return (
    <Screen>
      <View style={s.head}>
        <Image source={require('@/assets/images/brand/santa-studio-headphones.webp')} style={s.headImg} contentFit="cover" accessibilityIgnoresInvertColors />
        <View style={{ flex: 1 }}><Eyebrow>Santa Studio</Eyebrow><Title size={26}>A message made just for them</Title></View>
      </View>
      <Body muted style={{ marginBottom: 16 }}>Choose their name, age, adventures and treats, and Santa records a longer personal message in the studio.</Body>
      {!app.ready && !app.error ? <Card><Skeleton h={22} w="50%" /><Skeleton h={60} style={{ marginTop: 14 }} /><Skeleton h={60} style={{ marginTop: 10 }} /></Card> : null}
      {app.error ? <Notice message={app.error} onRetry={() => app.refresh().catch(() => {})} /> : null}
      {completed ? <Card>
        <Eyebrow>Fresh from the studio</Eyebrow>
        <Title size={22}>Santa's message for {completed.name}</Title>
        <View style={{ height: 14 }} />
        <ClipPlayer clip={completed.clip} title="Santa Studio message" />
        <Button label="Start a new studio message" variant="ghost" onPress={() => { setCompleted(null); app.refresh().catch(() => {}); }} />
      </Card> : app.ready ? (open ? <StudioForm onComplete={(clip, name) => setCompleted({ clip, name })} /> : <Offer busy={busy} err={err} run={run} />) : null}
    </Screen>
  );
}

function Offer({ busy, err, run }: { busy: string; err: string; run: (k: string, fn: () => Promise<void>) => void }) {
  const app = useSantaApp();
  const ent = app.entitlement;
  const opts = [
    { kind: 'permanent' as const, title: 'Studio for every Christmas', note: 'Permanent Studio access. Restore on another iPhone using the same Apple Account. Service and fair-use limits still apply.', planned: '£24.99', price: app.prices.permanent, icon: 'infinite' as const },
    { kind: 'single' as const, title: 'One studio message', note: 'One successfully completed personalised message. Failed generation does not use your message.', planned: '£4.99', price: app.prices.single, icon: 'mic' as const },
  ];
  return (
    <>
      {!ent.verified ? <Notice tone="info" message="We could not confirm your Studio access with the North Pole yet." onRetry={() => run('refresh', app.refresh)} retryLabel="Check again" /> : null}
      {ent.verified && !ent.permanent && ent.credits === 0 ? <Notice tone="info" message="You have no studio messages left. Choose an option below, or restore an earlier purchase." /> : null}
      {opts.map((o, i) => (
        <Card key={o.kind} delay={i * 90} style={o.kind === 'permanent' ? { borderColor: brand.gold } : undefined}>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 6 }}>
            <View style={s.offerIcon}><Ionicons name={o.icon} size={22} color={brand.goldLight} /></View>
            <Text style={s.offerTitle}>{o.title}</Text>
          </View>
          <Body muted>{o.note}</Body>
          <Text style={s.price} accessibilityLabel={o.price ? 'Price ' + o.price : 'Planned UK price ' + o.planned}>{o.price || o.planned}</Text>
          {!o.price ? <Text style={s.planned}>Planned UK price. Not yet available in the App Store.</Text> : null}
          <Button label={o.price ? 'Buy for ' + o.price : 'Not yet available'} onPress={() => run(o.kind, () => app.purchase(o.kind))} busy={busy === o.kind} disabled={!o.price || !!busy} variant={o.kind === 'permanent' ? 'red' : 'gold'} />
        </Card>
      ))}
      {err ? <Notice message={err} onRetry={() => run('refresh', app.refresh)} retryLabel="Check my access again" /> : null}
      {busy === 'refresh' ? <Notice tone="info" message="Checking your access with the North Pole..." /> : null}
      <Button label="Restore purchases" variant="ghost" icon="refresh-circle-outline" onPress={() => run('restore', app.restore)} busy={busy === 'restore'} />
      <Body muted style={{ fontSize: 13, textAlign: 'center', marginTop: 8 }}>Access unlocks only after the North Pole confirms your purchase.</Body>
    </>
  );
}

type Step = 'name' | Cat | 'talent' | 'region' | 'review';

function StudioForm({ onComplete }: { onComplete: (clip: Clip, name: string) => void }) {
  const app = useSantaApp();
  const [cat, setCat] = React.useState<Catalogue | null>(null);
  const [loadErr, setLoadErr] = React.useState('');
  const [step, setStep] = React.useState<Step>('name');
  const [q, setQ] = React.useState('');
  const [names, setNames] = React.useState<NameResult[] | null>(null);
  const [name, setName] = React.useState<NameResult | null>(null);
  const [sel, setSel] = React.useState<Partial<Record<Cat, Choice>>>({});
  const [talent, setTalent] = React.useState<{ skip: true } | { category: 'sports' | 'funny'; choice: Choice } | null>(null);
  const [talentCat, setTalentCat] = React.useState<'sports' | 'funny'>('sports');
  const [region, setRegion] = React.useState<Choice | null | undefined>(undefined);
  const [busy, setBusy] = React.useState('');
  const [err, setErr] = React.useState('');
  const lock = React.useRef(false);
  const entering = useEntering();

  const load = React.useCallback(async () => { setLoadErr(''); try { setCat(await app.loadCatalogue()); } catch (e: any) { setLoadErr(e?.message || 'Could not open the studio catalogue.'); } }, []);
  React.useEffect(() => { load(); return () => { setNames(null); setName(null); setQ(''); }; }, [load]);

  const run = async (k: string, fn: () => Promise<void>) => {
    if (lock.current) return; lock.current = true; setBusy(k); setErr('');
    try { await fn(); } catch (e: any) { setErr(e?.message || 'Something went wrong. Please try again.'); }
    finally { lock.current = false; setBusy(''); }
  };

  const regionGroups = React.useMemo(() => {
    if (!cat || !sel.place) return [] as Choice[];
    return Object.values(cat.regionalGroups).filter(g => g.parentId === sel.place!.id).flatMap(g => g.records);
  }, [cat, sel.place]);
  const order: Step[] = ['name', 'age', 'activity', 'achievement', 'treat', 'place', 'talent', ...(regionGroups.length ? ['region' as Step] : []), 'review'];
  const idx = order.indexOf(step);
  const [returnToReview, setReturnToReview] = React.useState(false);
  const next = () => { if (returnToReview) { setReturnToReview(false); setStep('review'); } else setStep(order[idx + 1]); };
  const edit = (st: Step) => { setReturnToReview(true); setStep(st); };

  if (loadErr) return <Notice message={loadErr} onRetry={load} />;
  if (!cat) return <Card><Skeleton h={20} w="40%" /><Skeleton h={50} style={{ marginTop: 12 }} /><Skeleton h={50} style={{ marginTop: 8 }} /><Skeleton h={50} style={{ marginTop: 8 }} /></Card>;

  const credits = app.entitlement.permanent ? 'Unlimited studio messages' : app.entitlement.credits + ' studio message' + (app.entitlement.credits === 1 ? '' : 's') + ' left';
  const pct = (idx + 1) / order.length;

  const review = () => {
    const rows: { k: Step; label: string; v: string }[] = [
      { k: 'name', label: 'Name', v: name?.name + (name?.variant ? ' (' + name.variant + ')' : '') },
      ...STAGES.map(st => ({ k: st.key as Step, label: st.label, v: sel[st.key]?.label || '' })),
      { k: 'talent', label: 'Talent', v: !talent || 'skip' in talent ? 'Skipped' : talent.choice.label },
      ...(regionGroups.length ? [{ k: 'region' as Step, label: 'Region', v: region ? region.label : 'Not included' }] : []),
    ];
    const create = () => run('create', async () => {
      const choices: StudioChoices = {
        name: name!.id, age: sel.age!.id, activity: sel.activity!.id, achievement: sel.achievement!.id, treat: sel.treat!.id, place: sel.place!.id,
        talent: !talent || 'skip' in talent ? { skip: true } : { category: talent.category, id: talent.choice.id },
        ...(region ? { region: region.id } : {}),
      };
      const result = await app.createStudio(choices, name!.name);
      onComplete(result, name!.name);
    });
    return (
      <>
        <Title size={22}>Check Santa's script</Title>
        <Body muted style={{ marginVertical: 8 }}>Tap any line to change it before Santa records.</Body>
        {rows.map(r => (
          <Press key={r.k} accessibilityRole="button" accessibilityLabel={r.label + ': ' + r.v + '. Edit'} onPress={() => edit(r.k)} style={s.reviewRow}>
            <Text style={s.reviewLabel}>{r.label}</Text>
            <Text style={s.reviewVal}>{r.v}</Text>
            <Ionicons name="create-outline" size={18} color={brand.goldLight} />
          </Press>
        ))}
        {err ? <Notice message={err} /> : null}
        <GoldRule />
        <Button label="Record Santa's message" icon="mic" onPress={create} busy={busy === 'create'} />
      </>
    );
  };

  return (
    <>
      <View style={s.creditRow}><Ionicons name="ribbon-outline" size={16} color={brand.gold} /><Text style={s.credit}>{credits}</Text></View>
      <View style={s.prog} accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: order.length, now: idx + 1, text: 'Step ' + (idx + 1) + ' of ' + order.length }}>
        <View style={[s.progFill, { width: (pct * 100) + '%' as any }]} />
      </View>
      <AView key={step} entering={entering} style={s.stage}>
        {idx > 0 && step !== 'review' ? (
          <Press accessibilityRole="button" accessibilityLabel="Back to previous step" onPress={() => { setReturnToReview(false); setStep(order[idx - 1]); }} style={s.back}>
            <Ionicons name="chevron-back" size={18} color={brand.goldLight} /><Text style={s.backText}>Back</Text>
          </Press>
        ) : null}
        <Text style={s.stepCount}>Step {idx + 1} of {order.length}</Text>

        {step === 'name' ? (
          <>
            <Title size={22}>Whose message is this?</Title>
            <View style={{ height: 12 }} />
            <Field label="First name" value={q} onChangeText={setQ} returnKeyType="search" autoCorrect={false} onSubmitEditing={() => q.trim() && run('lookup', async () => setNames(await app.lookup(q.trim(), true)))} />
            <Button label="Find this name" variant="gold" icon="search" disabled={!q.trim()} busy={busy === 'lookup'} onPress={() => run('lookup', async () => setNames(await app.lookup(q.trim(), true)))} />
            {names && names.length === 0 ? <Notice tone="info" message="Santa has not recorded that name yet. Try another spelling." /> : null}
            {names && names.length > 0 ? (
              <View style={{ marginTop: 12 }}>
                <ChoiceList label="Matching names" items={names.map(n => ({ id: n.id, label: n.name + (n.variant ? ' - ' + n.variant : '') }))} selected={name?.id} onSelect={c => setName(names.find(n => n.id === c.id) || null)} />
              </View>
            ) : null}
            {err ? <Notice message={err} /> : null}
            <View style={{ height: 14 }} /><Button label="Next" icon="arrow-forward" disabled={!name} onPress={next} />
          </>
        ) : null}

        {STAGES.map(st => step === st.key ? (
          <React.Fragment key={st.key}>
            <Title size={22}>{st.prompt}</Title>
            <View style={{ height: 12 }} />
            <ChoiceList label={st.label} items={cat.categories[st.key] || []} selected={sel[st.key]?.id} onSelect={c => { setSel(p => ({ ...p, [st.key]: c })); if (st.key === 'place') setRegion(undefined); }} />
            <View style={{ height: 14 }} /><Button label="Next" icon="arrow-forward" disabled={!sel[st.key]} onPress={next} />
          </React.Fragment>
        ) : null)}

        {step === 'talent' ? (
          <>
            <Title size={22}>A special talent? (optional)</Title>
            <View style={s.seg} accessibilityRole="tablist">
              {(['sports', 'funny'] as const).map(c => (
                <Press key={c} accessibilityRole="tab" accessibilityState={{ selected: talentCat === c }} onPress={() => setTalentCat(c)} style={[s.segBtn, talentCat === c && s.segOn]}>
                  <Text style={[s.segText, talentCat === c && { color: brand.navyDark }]}>{c === 'sports' ? 'Sports' : 'Funny'}</Text>
                </Press>
              ))}
            </View>
            <ChoiceList label={talentCat === 'sports' ? 'Sports talents' : 'Funny talents'} items={cat.categories[talentCat] || []} selected={talent && !('skip' in talent) ? talent.choice.id : undefined} onSelect={c => setTalent({ category: talentCat, choice: c })} />
            <View style={{ height: 14 }} />
            <Button label="Next" icon="arrow-forward" disabled={!talent} onPress={next} />
            <View style={{ height: 8 }} />
            <Button label="Skip the talent" variant="ghost" onPress={() => { setTalent({ skip: true }); next(); }} />
          </>
        ) : null}

        {step === 'region' ? (
          <>
            <Title size={22}>Which part of {sel.place?.label}? (optional)</Title>
            <View style={{ height: 12 }} />
            <ChoiceList label="Region" items={regionGroups} selected={region?.id} onSelect={setRegion} />
            <View style={{ height: 14 }} />
            <Button label="Next" icon="arrow-forward" disabled={!region} onPress={next} />
            <View style={{ height: 8 }} />
            <Button label="Leave out the region" variant="ghost" onPress={() => { setRegion(null); next(); }} />
          </>
        ) : null}

        {step === 'review' ? review() : null}
      </AView>
    </>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', gap: 14, alignItems: 'center', marginBottom: 12 },
  headImg: { width: 76, height: 76, borderRadius: 38, borderWidth: 1.5, borderColor: brand.gold },
  offerIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: brand.navy, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: brand.goldLine },
  offerTitle: { flex: 1, color: brand.cream, fontFamily: fonts.display, fontSize: 19 },
  price: { color: brand.goldLight, fontFamily: fonts.display, fontSize: 32, marginTop: 12 },
  planned: { color: brand.muted, fontFamily: fonts.body, fontSize: 13, marginBottom: 12 },
  creditRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  credit: { color: brand.goldLight, fontFamily: fonts.medium, fontSize: 14 },
  prog: { height: 4, borderRadius: 2, backgroundColor: brand.navy, overflow: 'hidden', marginBottom: 14 },
  progFill: { height: 4, backgroundColor: brand.gold },
  stage: { backgroundColor: '#123326e6', borderRadius: 22, borderWidth: 1, borderColor: brand.goldHair, padding: 20 },
  back: { flexDirection: 'row', alignItems: 'center', minHeight: 44, alignSelf: 'flex-start', paddingRight: 12 },
  backText: { color: brand.goldLight, fontFamily: fonts.medium, fontSize: 15 },
  stepCount: { color: brand.gold, fontFamily: fonts.semibold, fontSize: 12, letterSpacing: 2, marginBottom: 6 },
  seg: { flexDirection: 'row', gap: 8, marginVertical: 14 },
  segBtn: { flex: 1, minHeight: 44, borderRadius: 999, borderWidth: 1, borderColor: brand.goldLine, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: brand.gold, borderColor: brand.gold },
  segText: { color: brand.cream, fontFamily: fonts.semibold, fontSize: 15 },
  reviewRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: brand.goldLine, flexWrap: 'wrap' },
  reviewLabel: { width: 100, color: brand.muted, fontFamily: fonts.medium, fontSize: 14 },
  reviewVal: { flex: 1, minWidth: 140, color: brand.cream, fontFamily: fonts.semibold, fontSize: 16 },
});
