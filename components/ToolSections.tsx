import { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { PlanSection } from './PlanSection';
import { useRouter } from 'expo-router';
import { Users, CreditCard, CalendarClock, ChevronRight } from 'lucide-react-native';
import { apiFetch, hasToken } from '../lib/api';
import { useI18n, currencyLabel } from '../lib/i18n';
import { useAppData, useInOrg, useWorkspace } from '../lib/appData';
import { fontBody, fontMono } from '../lib/fonts';
import { fmtNum } from '../lib/privacy';
import { pressFeel, hapticLight } from './press';
import { GrowBar, Rise } from './Motion';

/**
 * The money tools (budgets, goals, what is coming up) as sections of the Dashboard that show their status, only for the
 * tools you actually use. What is not set up yet is one quiet row of "+ Budget", "+ Goal" chips; the rarely used pages
 * (monthly report, categories, reminders, habits, community) are one small row of links. There is no menu of tools.
 */
type BudgetRow = { _id: string; categoryId: { nameEn?: string; nameAr?: string } | string; amount: number; currency: string; spent?: number; percent?: number; status?: 'on-track' | 'near' | 'over' };
type GoalRow = { _id: string; nameEn: string; nameAr: string; targetAmount: number; savedAmount: number; progressAmount?: number; currency: string };
type TodayRow = { id: string; kind: string; title: string; body: string; screen: string; refId?: string };
type Counts = { savings: number; gam3yas: number; debts: number; cards: number };

export function ToolSections() {
  const router = useRouter();
  const { tok, lang } = useI18n();
  const { dataVersion, profile } = useAppData();
  const inOrg = useInOrg();
  const ws = useWorkspace();
  const ar = lang === 'ar';
  const [budgets, setBudgets] = useState<BudgetRow[] | null>(null);
  const [goals, setGoals] = useState<GoalRow[] | null>(null);
  const [coming, setComing] = useState<TodayRow[]>([]);
  const [counts, setCounts] = useState<Counts | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!(await hasToken())) return;
      const get = <T,>(path: string) => apiFetch<{ data: T }>(path).then((r) => r.data).catch(() => null);
      const [b, g, today, debts, cards, gam3yas, savings] = await Promise.all([
        get<BudgetRow[]>('/budgets'), get<GoalRow[]>('/goals'), get<TodayRow[]>('/me/today'),
        get<Array<{ archivedAt?: string | null }>>('/debts'), get<unknown[]>('/cards'),
        inOrg ? Promise.resolve(null) : get<Array<{ archived?: boolean }>>('/gam3ya'),
        inOrg ? Promise.resolve(null) : get<{ holdings?: unknown[] }>('/savings'),
      ]);
      if (!alive) return;
      setBudgets(b ?? []); setGoals(g ?? []);
      setComing((today ?? []).filter((r) => ['gam3ya_pay', 'gam3ya_payout', 'bill', 'debt'].includes(r.kind)).slice(0, 3));
      setCounts({
        debts: (debts ?? []).filter((d) => !d.archivedAt).length,
        cards: cards?.length ?? 0,
        gam3yas: (gam3yas ?? []).filter((x) => !x.archived).length,
        savings: savings?.holdings?.length ?? 0,
      });
    })();
    return () => { alive = false; };
  }, [dataVersion, inOrg]);

  if (ws.isChild || budgets === null || goals === null || counts === null) return null;
  const cur = currencyLabel(profile?.currency ?? 'EGP', lang);
  const align = ar ? 'right' : 'left';
  const rowDir = ar ? 'row-reverse' : 'row';

  const Section = ({ title, to, children, delay }: { title: string; to?: string; children: React.ReactNode; delay: number }) => (
    <Rise delay={delay} distance={10}>
      <View style={{ marginHorizontal: 16, marginBottom: 12, padding: 16, borderRadius: 22, backgroundColor: tok.surface, borderWidth: 1, borderColor: tok.border }}>
        <View style={{ flexDirection: rowDir, justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontFamily: fontBody(lang, 'semibold'), fontSize: 17, color: tok.bone }}>{title}</Text>
          {to ? (
            <Pressable onPress={() => router.push(to as never)} hitSlop={10} accessibilityRole="button" style={{ minHeight: 32, justifyContent: 'center' }}>
              <Text style={{ fontFamily: fontBody(lang, 'semibold'), fontSize: 14, color: tok.gold }}>{ar ? 'عرض الكل ‹' : 'See all ›'}</Text>
            </Pressable>
          ) : null}
        </View>
        {children}
      </View>
    </Rise>
  );

  const bars = [...budgets].sort((a, c) => (c.percent ?? 0) - (a.percent ?? 0)).slice(0, 2);
  const topGoals = goals.slice(0, 2);
  const unused: Array<{ label: string; to: string }> = [
    ...(budgets.length === 0 ? [{ label: ar ? '+ ميزانية' : '+ Budget', to: '/budgets' }] : []),
    ...(goals.length === 0 ? [{ label: ar ? '+ هدف' : '+ Goal', to: '/goals?new=1' }] : []),
    ...(!inOrg && counts.savings === 0 ? [{ label: ar ? '+ مدخرات' : '+ Savings', to: '/savings/new' }] : []),
    ...(!inOrg && counts.gam3yas === 0 ? [{ label: ar ? '+ جمعية' : '+ Gam3ya', to: '/gam3ya/new' }] : []),
    ...(counts.debts === 0 ? [{ label: ar ? '+ دين' : '+ Debt', to: '/debts' }] : []),
    ...(counts.cards === 0 ? [{ label: ar ? '+ حساب' : '+ Account', to: '/cards' }] : []),
  ];
  const more: Array<{ label: string; to: string }> = [
    { label: ar ? 'التقرير الشهري' : 'Monthly report', to: '/reports/monthly' },
    { label: ar ? 'التصنيفات' : 'Categories', to: '/categories' },
    { label: ar ? 'التذكيرات' : 'Reminders', to: '/reminders' },
    { label: ar ? 'العادات' : 'Habits', to: '/habits' },
    { label: ar ? 'المجتمع' : 'Community', to: '/community' },
  ];
  const Chip = ({ label, to, dashed }: { label: string; to: string; dashed?: boolean }) => (
    <Pressable onPress={() => router.push(to as never)} onPressIn={hapticLight} accessibilityRole="button"
      style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: 16, borderRadius: 999, justifyContent: 'center', borderWidth: 1, borderStyle: dashed ? 'dashed' : 'solid', borderColor: dashed ? tok.gold : tok.borderHi, backgroundColor: 'transparent', ...(pressFeel(pressed) ?? {}) })}>
      <Text style={{ fontFamily: fontBody(lang, 'semibold'), fontSize: 14, color: dashed ? tok.gold : tok.bone }}>{label}</Text>
    </Pressable>
  );
  const goComing = (r: TodayRow) => {
    if (r.screen === 'gam3ya') router.push(`/gam3ya/${r.refId}` as never);
    else if (r.screen === 'debts') router.push('/debts' as never);
    else router.push('/reminders' as never);
  };

  return (
    <View>
      {!inOrg ? <PlanSection /> : null}
      {bars.length > 0 ? (
        <Section title={ar ? 'الميزانيات' : 'Budgets'} to="/budgets" delay={0}>
          {bars.map((b, i) => {
            const name = typeof b.categoryId === 'string' ? '' : (ar && b.categoryId.nameAr ? b.categoryId.nameAr : b.categoryId.nameEn ?? '');
            const pct = Math.min(1, (b.percent ?? 0) / 100);
            return (
              <View key={b._id} style={{ marginTop: 14 }}>
                <View style={{ flexDirection: rowDir, justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                  <Text numberOfLines={1} style={{ flex: 1, fontFamily: fontBody(lang, 'medium'), fontSize: 15, color: tok.bone, textAlign: align }}>{name}</Text>
                  <Text style={{ fontFamily: fontBody(lang), fontSize: 14, color: b.status === 'over' ? tok.alertText : tok.muted, writingDirection: 'ltr' }}>
                    {fmtNum(Math.round(b.spent ?? 0))} / {fmtNum(Math.round(b.amount))} {currencyLabel(b.currency, lang)}
                  </Text>
                </View>
                <GrowBar fraction={pct} color={b.status === 'over' ? tok.alertText : b.status === 'near' ? tok.warnText : tok.gold} track={tok.elevated} rtl={ar} delay={i * 100} />
              </View>
            );
          })}
        </Section>
      ) : null}

      {topGoals.length > 0 ? (
        <Section title={ar ? 'الأهداف' : 'Goals'} to="/goals" delay={80}>
          {topGoals.map((g, i) => {
            const saved = g.progressAmount ?? g.savedAmount;
            const pct = g.targetAmount > 0 ? Math.min(1, saved / g.targetAmount) : 0;
            return (
              <View key={g._id} style={{ marginTop: 14 }}>
                <View style={{ flexDirection: rowDir, justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                  <Text numberOfLines={1} style={{ flex: 1, fontFamily: fontBody(lang, 'medium'), fontSize: 15, color: tok.bone, textAlign: align }}>{ar && g.nameAr ? g.nameAr : g.nameEn}</Text>
                  <Text style={{ fontFamily: fontBody(lang), fontSize: 14, color: tok.muted }}>{fmtNum(Math.round(pct * 100))}% · {fmtNum(Math.round(saved))} / {fmtNum(Math.round(g.targetAmount))}</Text>
                </View>
                <GrowBar fraction={pct} color={tok.gold} track={tok.elevated} rtl={ar} delay={i * 100 + 100} />
              </View>
            );
          })}
        </Section>
      ) : null}

      {coming.length > 0 ? (
        <Section title={ar ? 'قادم' : 'Coming up'} delay={160}>
          {coming.map((r) => (
            <Pressable key={r.id} onPress={() => goComing(r)} accessibilityRole="button"
              style={({ pressed }) => ({ flexDirection: rowDir, alignItems: 'center', gap: 12, paddingVertical: 12, ...(pressFeel(pressed) ?? {}) })}>
              <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: tok.elevated, alignItems: 'center', justifyContent: 'center' }}>
                {r.screen === 'gam3ya' ? <Users size={18} color={tok.gold} /> : r.screen === 'debts' ? <CreditCard size={18} color={tok.gold} /> : <CalendarClock size={18} color={tok.gold} />}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={2} style={{ fontFamily: fontBody(lang, 'medium'), fontSize: 15, color: tok.bone, textAlign: align }}>{r.title}</Text>
                <Text numberOfLines={1} style={{ fontFamily: fontBody(lang), fontSize: 14, color: tok.muted, textAlign: align }}>{r.body}</Text>
              </View>
              <ChevronRight size={16} color={tok.muted} style={{ transform: [{ scaleX: ar ? -1 : 1 }] }} />
            </Pressable>
          ))}
        </Section>
      ) : null}

      {unused.length > 0 ? (
        <View style={{ marginHorizontal: 16, marginBottom: 14 }}>
          <Text style={{ fontFamily: fontMono('medium'), fontSize: 12, letterSpacing: ar ? 0 : 1.4, color: tok.muted, textTransform: ar ? 'none' : 'uppercase', marginBottom: 8, textAlign: align }}>{ar ? 'لم يُعدّ بعد' : 'Not set up yet'}</Text>
          <View style={{ flexDirection: rowDir, flexWrap: 'wrap', gap: 8 }}>{unused.map((u) => <Chip key={u.to} {...u} dashed />)}</View>
        </View>
      ) : null}

      <View style={{ marginHorizontal: 16, marginBottom: 14 }}>
        <Text style={{ fontFamily: fontMono('medium'), fontSize: 12, letterSpacing: ar ? 0 : 1.4, color: tok.muted, textTransform: ar ? 'none' : 'uppercase', marginBottom: 8, textAlign: align }}>{ar ? 'المزيد' : 'More'}</Text>
        <View style={{ flexDirection: rowDir, flexWrap: 'wrap', gap: 8 }}>{more.map((m) => <Chip key={m.to} {...m} />)}</View>
      </View>
    </View>
  );
}
