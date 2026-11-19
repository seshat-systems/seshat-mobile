import { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { apiFetch, hasToken } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { useAppData } from '../lib/appData';
import { fontBody } from '../lib/fonts';
import { Rise } from './Motion';
import { PlanBlockView, type VisualBlock } from './ChatVisuals';

export type PlanData =
  | { ready: true; verdictText: { en: string; ar: string }; closing: { en: string; ar: string } | null; note: string;
      actions: Array<{ kind: 'cap_category' | 'set_aside' | 'review_category'; category?: string; categoryAr?: string; spent?: number; cap?: number; saves?: number; amount?: number }>;
      block: Extract<VisualBlock, { type: 'plan' }> }
  | { ready: false; reason?: string };

/** The monthly plan, fetched without the chat. Shared by the Plan screen and the Dashboard section. */
export function usePlan(): PlanData | null {
  const { dataVersion } = useAppData();
  const [plan, setPlan] = useState<PlanData | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!(await hasToken())) return;
      apiFetch<{ data: PlanData }>('/me/plan').then((r) => { if (alive) setPlan(r.data); }).catch(() => { if (alive) setPlan({ ready: false }); });
    })();
    return () => { alive = false; };
  }, [dataVersion]);
  return plan;
}

/** Dashboard: the plan card up top (tap for the full Plan screen), or a prompt to add income so Seshat can build it. */
export function PlanSection() {
  const router = useRouter();
  const { tok, lang } = useI18n();
  const ar = lang === 'ar';
  const plan = usePlan();
  if (!plan || (!plan.ready && plan.reason === 'org')) return null;
  const go = () => router.push('/plan' as never);
  return (
    <Rise distance={10}>
      <Pressable onPress={go} accessibilityRole="button" style={{ marginHorizontal: 16, marginBottom: 12 }}>
        {plan.ready ? (
          <PlanBlockView block={plan.block} />
        ) : (
          <View style={{ padding: 16, borderRadius: 22, backgroundColor: tok.surface, borderWidth: 1, borderColor: tok.border, gap: 6 }}>
            <Text style={{ fontFamily: fontBody(lang, 'semibold'), fontSize: 17, color: tok.bone, textAlign: ar ? 'right' : 'left' }}>{ar ? 'خطتك الشهرية' : 'Your monthly plan'}</Text>
            <Text style={{ fontFamily: fontBody(lang), fontSize: 15, lineHeight: 22, color: tok.muted, textAlign: ar ? 'right' : 'left' }}>
              {ar ? 'أخبر سيشات بدخلك الشهري وستبني لك خطة: احتياجات ورغبات وادخار.' : 'Tell Seshat your monthly income and it builds your plan: needs, wants and saving.'}
            </Text>
            <Text style={{ fontFamily: fontBody(lang, 'semibold'), fontSize: 14, color: tok.gold, textAlign: ar ? 'right' : 'left' }}>{ar ? 'ابدأ ←' : 'Get started →'}</Text>
          </View>
        )}
      </Pressable>
    </Rise>
  );
}
