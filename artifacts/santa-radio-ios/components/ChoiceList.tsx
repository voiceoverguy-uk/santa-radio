import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Press } from '@/components/ui';
import { brand, fonts } from '@/constants/colors';
import type { Choice } from '@/lib/contracts';

export function ChoiceList({ items, selected, onSelect, label }: { items: Choice[]; selected?: string; onSelect: (c: Choice) => void; label: string }) {
  const [q, setQ] = React.useState('');
  const [limit, setLimit] = React.useState(30);
  const filtered = React.useMemo(() => { const n = q.trim().toLowerCase(); return n ? items.filter(i => i.label.toLowerCase().includes(n)) : items; }, [q, items]);
  return (
    <View>
      {items.length > 8 ? (
        <View style={s.search}>
          <Ionicons name="search" size={18} color={brand.muted} />
          <TextInput value={q} onChangeText={t => { setQ(t); setLimit(30); }} placeholder={'Search ' + label.toLowerCase()} placeholderTextColor="#bcc9bd99" accessibilityLabel={'Search ' + label} style={s.searchInput} autoCorrect={false} />
        </View>
      ) : null}
      {filtered.length === 0 ? <Text style={s.empty}>Nothing matches "{q}". Try a shorter word.</Text> : null}
      <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ gap: 8 }}>
        {filtered.slice(0, limit).map(c => {
          const on = c.id === selected;
          return (
            <Press key={c.id} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={c.label} onPress={() => onSelect(c)} style={[s.opt, on && s.optOn]}>
              <View style={[s.dot, on && s.dotOn]}>{on ? <Ionicons name="checkmark" size={14} color={brand.navyDark} /> : null}</View>
              <Text style={[s.optText, on && { color: brand.goldLight }]}>{c.label}</Text>
            </Press>
          );
        })}
      </View>
      {filtered.length > limit ? (
        <Press accessibilityRole="button" onPress={() => setLimit(l => l + 30)} style={s.more}><Text style={s.moreText}>Show more ({filtered.length - limit} left)</Text></Press>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: brand.goldLine, borderRadius: 14, paddingHorizontal: 14, minHeight: 48, marginBottom: 12, backgroundColor: '#081e17cc' },
  searchInput: { flex: 1, color: brand.cream, fontFamily: fonts.body, fontSize: 16, minHeight: 46 },
  empty: { color: brand.muted, fontFamily: fonts.body, fontSize: 15, marginVertical: 10 },
  opt: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: brand.goldHair, backgroundColor: '#081e1799' },
  optOn: { borderColor: brand.gold, backgroundColor: brand.navy },
  dot: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: brand.goldLine, alignItems: 'center', justifyContent: 'center' },
  dotOn: { backgroundColor: brand.gold, borderColor: brand.gold },
  optText: { flex: 1, color: brand.cream, fontFamily: fonts.body, fontSize: 16, lineHeight: 22 },
  more: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  moreText: { color: brand.goldLight, fontFamily: fonts.semibold, fontSize: 15 },
});
