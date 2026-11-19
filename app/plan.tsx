import { View, Text, Pressable, RefreshControl } from 'react-native';
import { ScrollView as ScreenScroll } from '../components/Scroll';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../lib/i18n';
import { fontBody } from '../lib/fonts';
import { PlanScreen } from '../components/PlanShell';
import { PlanBlockView } from '../components/ChatVisuals';
import { usePlan, type PlanData } from '../components/PlanSection';
import { RButton } from '../components/ui';
import { PlanSplitEditor } from '../components/PlanSplitEditor';
import { Skeleton } from '../components/Skeleton';

type Action = Extract<PlanData, { ready: true }>['actions'][number];

/** Your plan for the month, without asking anyone: where needs / wants / saving stand, what that means, and the next steps. */
export default function PlanRoute() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { tok, lang } = useI18n();
  const ar = lang === 'ar';
  const plan = usePlan();
  const align = ar ? 'right' : 'left';
  const ask = (q: string) => router.push({ pathname: '/seshat/[id]', params: { id: 'new', text: q } } as never);
  const n = (v: number | undefined) => Math.round(v ?? 0).toLocaleString('en-US');

  const line = (a: Action): { text: string; ask: string } | null => {
    const cat = ar ? (a.categoryAr || a.category) : a.category;
    if (a.kind === 'cap_category') return {
      text: ar ? `حدّد ${cat} بـ ${n(a.cap)}: يوفّر ${n(a.saves)} هذا الشهر.` : `Cap ${cat} at ${n(a.cap)}: that saves ${n(a.saves)} this month.`,
      ask: ar ? `حدّد ميزانية ${cat} بـ ${n(a.cap)}` : `Set a ${n(a.cap)} budget for ${cat}`,
    };
    if (a.kind === 'set_aside') return {
      text: ar ? `ادّخر ${n(a.amount)} هذا الشهر.` : `Set aside ${n(a.amount)} this month.`,
      ask: ar ? `ادّخر ${n(a.amount)} هذا الشهر` : `Set aside ${n(a.amount)} this month`,
    };
    if (a.kind === 'review_category') return {
      text: ar ? `راجع ${cat}: صرفت ${n(a.spent)}.` : `Review ${cat}: ${n(a.spent)} spent.`,
      ask: ar ? `ليش صرفت كل هذا على ${cat}؟` : `Why did I spend so much on ${cat}?`,
    };
    return null;
  };

  return (
    <PlanScreen title={ar ? 'خطتك' : 'Your plan'} subtitle={ar ? 'كيف يسير شهرك مقابل دخلك' : 'How your month is going against your income'}>
      <ScreenScroll contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 40, paddingTop: 8, gap: 14 }} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={false} tintColor={tok.gold} />}>
        {plan === null ? (
          <><Skeleton width="100%" height={190} radius={22} /><Skeleton width="100%" height={110} radius={22} /></>
        ) : !plan.ready ? (
          <View style={{ padding: 18, borderRadius: 22, backgroundColor: tok.surface, borderWidth: 1, borderColor: tok.border, gap: 12 }}>
            <Text style={{ fontFamily: fontBody(lang, 'semibold'), fontSize: 18, color: tok.bone, textAlign: align }}>
              {plan.reason === 'org' ? (ar ? 'الخطة لحسابك الشخصي' : 'The plan is for your personal profile') : (ar ? 'نحتاج دخلك الشهري' : 'We need your monthly income')}
            </Text>
            <Text style={{ fontFamily: fontBody(lang), fontSize: 15, lineHeight: 23, color: tok.muted, textAlign: align }}>
              {plan.reason === 'org'
                ? (ar ? 'بدّل إلى ملفك الشخصي لترى خطتك.' : 'Switch to your personal profile to see your plan.')
                : (ar ? 'بعد أن تخبر سيشات بدخلك تقسّم الشهر إلى احتياجات ورغبات وادخار وتخبرك أين تقف.' : 'Once Seshat knows what comes in each month it splits the month into needs, wants and saving, and tells you where you stand.')}
            </Text>
            {plan.reason !== 'org' ? <RButton full onPress={() => ask(ar ? 'ساعدني أجهّز شهري' : 'Help me set up my month')}>{ar ? 'جهّز شهري' : 'Set up my month'}</RButton> : null}
          </View>
        ) : (
          <>
            <PlanBlockView block={plan.block} />
            <PlanSplitEditor income={plan.block.income} currency={plan.block.currency} split={plan.split} accepted={plan.accepted} />
            <View style={{ padding: 16, borderRadius: 22, backgroundColor: tok.surface, borderWidth: 1, borderColor: tok.border, gap: 6 }}>
              <Text style={{ fontFamily: fontBody(lang, 'semibold'), fontSize: 17, color: tok.bone, textAlign: align }}>{ar ? plan.verdictText.ar : plan.verdictText.en}</Text>
              {plan.note ? <Text style={{ fontFamily: fontBody(lang), fontSize: 14, lineHeight: 21, color: tok.muted, textAlign: align }}>{plan.note}</Text> : null}
            </View>
            {plan.actions.length > 0 ? (
              <View style={{ padding: 16, borderRadius: 22, backgroundColor: tok.surface, borderWidth: 1, borderColor: tok.border, gap: 4 }}>
                <Text style={{ fontFamily: fontBody(lang, 'semibold'), fontSize: 17, color: tok.bone, textAlign: align, marginBottom: 6 }}>{ar ? 'الخطوات التالية' : 'Next steps'}</Text>
                {plan.actions.map((a, i) => {
                  const l = line(a); if (!l) return null;
                  return (
                    <Pressable key={i} onPress={() => ask(l.ask)} accessibilityRole="button" style={{ minHeight: 52, justifyContent: 'center', borderTopWidth: i === 0 ? 0 : 1, borderTopColor: tok.border, paddingVertical: 8 }}>
                      <Text style={{ fontFamily: fontBody(lang), fontSize: 15, lineHeight: 22, color: tok.bone, textAlign: align }}>{l.text}</Text>
                      <Text style={{ fontFamily: fontBody(lang, 'semibold'), fontSize: 13, color: tok.gold, textAlign: align, marginTop: 2 }}>{ar ? 'اطلب من سيشات ←' : 'Ask Seshat to do it →'}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </>
        )}
      </ScreenScroll>
    </PlanScreen>
  );
}
