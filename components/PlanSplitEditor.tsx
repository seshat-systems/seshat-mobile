import { useState, useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Minus, Plus } from 'lucide-react-native';
import { apiFetch } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { useAppData } from '../lib/appData';
import { fontBody } from '../lib/fonts';
import { RButton } from './ui';

type Split = { needs: number; wants: number; saving: number };
const STEP = 5;

/**
 * Your split: how much of each month's income goes to needs, wants and saving. It starts as Seshat's suggestion (50 / 30 / 20);
 * the plan only becomes yours once you press "Use this plan" or save a change. Saving is whatever is left of the 100%.
 */
export function PlanSplitEditor({ income, currency, split, accepted }: { income: number; currency: string; split: Split; accepted: boolean }) {
  const { tok, lang } = useI18n();
  const { bumpVersion } = useAppData();
  const ar = lang === 'ar';
  const rowDir = ar ? 'row-reverse' : 'row';
  const [needs, setNeeds] = useState(split.needs);
  const [wants, setWants] = useState(split.wants);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => { setNeeds(split.needs); setWants(split.wants); }, [split.needs, split.wants]);
  const saving = 100 - needs - wants;
  const dirty = needs !== split.needs || wants !== split.wants;
  const n = (v: number) => Math.round(v).toLocaleString('en-US');

  const save = async () => {
    setBusy(true); setFailed(false);
    try {
      await apiFetch('/me/plan', { method: 'PUT', body: JSON.stringify({ needs, wants, saving }) });
      bumpVersion();
    } catch { setFailed(true); }
    setBusy(false);
  };

  const rows: Array<{ key: 'needs' | 'wants' | 'saving'; label: string; pct: number; set?: (v: number) => void }> = [
    { key: 'needs', label: ar ? 'احتياجات' : 'Needs', pct: needs, set: setNeeds },
    { key: 'wants', label: ar ? 'رغبات' : 'Wants', pct: wants, set: setWants },
    { key: 'saving', label: ar ? 'ادخار' : 'Saving', pct: saving },
  ];
  const stepBtn = (disabled: boolean, onPress: () => void, icon: 'minus' | 'plus', label: string) => (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} hitSlop={6}
      style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: tok.elevated, borderWidth: 1, borderColor: tok.border, opacity: disabled ? 0.35 : 1 }}>
      {icon === 'minus' ? <Minus size={18} color={tok.bone} /> : <Plus size={18} color={tok.bone} />}
    </Pressable>
  );

  return (
    <View style={{ padding: 16, borderRadius: 22, backgroundColor: tok.surface, borderWidth: 1, borderColor: tok.border, gap: 10 }}>
      <Text style={{ fontFamily: fontBody(lang, 'semibold'), fontSize: 17, color: tok.bone, textAlign: ar ? 'right' : 'left' }}>
        {accepted ? (ar ? 'تقسيمك' : 'Your split') : (ar ? 'اقتراح سيشات' : "Seshat's suggestion")}
      </Text>
      <Text style={{ fontFamily: fontBody(lang), fontSize: 14, lineHeight: 21, color: tok.muted, textAlign: ar ? 'right' : 'left' }}>
        {accepted
          ? (ar ? 'غيّر النسب كما تريد. الادخار هو الباقي.' : 'Change the shares however you like. Saving is what is left.')
          : (ar ? 'هذه نقطة بداية من دخلك. غيّرها إن أردت، ثم اضغط «استخدم هذه الخطة».' : 'A starting point from your income. Change it if you want, then press "Use this plan".')}
      </Text>
      {rows.map((r) => (
        <View key={r.key} style={{ flexDirection: rowDir, alignItems: 'center', gap: 10, minHeight: 52 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fontBody(lang, 'medium'), fontSize: 16, color: tok.bone, textAlign: ar ? 'right' : 'left' }}>{r.label}</Text>
            <Text style={{ fontFamily: fontBody(lang), fontSize: 13, color: tok.muted, textAlign: ar ? 'right' : 'left', writingDirection: 'ltr' }}>{n(income * r.pct / 100)} {currency}</Text>
          </View>
          {r.set ? stepBtn(r.pct <= 0, () => r.set!(r.pct - STEP), 'minus', ar ? 'أقل' : 'Less') : null}
          <Text style={{ width: 52, textAlign: 'center', fontFamily: fontBody(lang, 'semibold'), fontSize: 17, color: tok.bone, writingDirection: 'ltr' }}>{r.pct}%</Text>
          {r.set ? stepBtn(saving < STEP, () => r.set!(r.pct + STEP), 'plus', ar ? 'أكثر' : 'More') : <View style={{ width: 44 }} />}
        </View>
      ))}
      {failed ? <Text style={{ fontFamily: fontBody(lang), fontSize: 14, color: tok.alertText, textAlign: ar ? 'right' : 'left' }}>{ar ? 'تعذّر الحفظ. حاول مرة أخرى.' : "Couldn't save. Try again."}</Text> : null}
      {!accepted || dirty ? (
        <RButton full loading={busy} onPress={save}>{accepted ? (ar ? 'احفظ التغييرات' : 'Save changes') : (ar ? 'استخدم هذه الخطة' : 'Use this plan')}</RButton>
      ) : null}
    </View>
  );
}
