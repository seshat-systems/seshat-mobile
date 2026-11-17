import { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Wallet, Target, Banknote, Users, CreditCard, Landmark, FileText, CalendarClock, Tags, BellRing, MessagesSquare,
} from 'lucide-react-native';
import { apiFetch, hasToken } from '../lib/api';
import { useI18n, currencyLabel } from '../lib/i18n';
import { useAppData, useInOrg, useWorkspace } from '../lib/appData';
import { fontBody } from '../lib/fonts';
import { fmtNum } from '../lib/privacy';
import { pressFeel, hapticLight } from './press';
import { Rise } from './Motion';

/**
 * The money tools (budgets, goals, savings, gam3yas, debts, accounts, reports, reminders and the rest) as tiles with a live
 * number each, in one place: the Dashboard's "Manage" view. They used to be twenty rows in Profile.
 */
type Live = { budgets?: number; goals?: { n: number; top?: string; pct?: number }; savings?: { value: number; cur: string }; gam3yas?: number; debts?: number; cards?: number };

export function ManageGrid() {
  const router = useRouter();
  const { tok, lang } = useI18n();
  const { dataVersion, profile } = useAppData();
  const inOrg = useInOrg();
  const ws = useWorkspace();
  const ar = lang === 'ar';
  const [live, setLive] = useState<Live>({});

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!(await hasToken())) return;
      const get = <T,>(path: string) => apiFetch<{ data: T }>(path).then((r) => r.data).catch(() => null);
      const [budgets, goals, debts, cards, gam3yas, savings] = await Promise.all([
        get<unknown[]>('/budgets'),
        get<Array<{ nameEn: string; nameAr: string; targetAmount: number; savedAmount: number; progressAmount?: number }>>('/goals'),
        get<Array<{ totalAmount: number; paidAmount: number; archivedAt?: string | null }>>('/debts'),
        get<unknown[]>('/cards'),
        inOrg ? Promise.resolve(null) : get<Array<{ archived?: boolean }>>('/gam3ya'),
        inOrg ? Promise.resolve(null) : get<{ currency: string; value: number }>('/savings'),
      ]);
      if (!alive) return;
      const top = goals?.[0];
      const saved = top ? (top.progressAmount ?? top.savedAmount) : 0;
      setLive({
        budgets: budgets?.length,
        goals: goals ? { n: goals.length, top: top ? (ar && top.nameAr ? top.nameAr : top.nameEn) : undefined, pct: top && top.targetAmount > 0 ? Math.round((saved / top.targetAmount) * 100) : undefined } : undefined,
        debts: debts?.filter((d) => !d.archivedAt && d.totalAmount - d.paidAmount > 0).length,
        cards: cards?.length,
        gam3yas: gam3yas?.filter((g) => !g.archived).length,
        savings: savings ? { value: savings.value, cur: savings.currency } : undefined,
      });
    })();
    return () => { alive = false; };
  }, [dataVersion, inOrg, ar]);

  // A child sees none of the household's money tools; they stay with the adults.
  if (ws.isChild) return null;
  const cur = currencyLabel(profile?.currency ?? 'EGP', lang);
  const none = (en: string, arT: string) => (ar ? arT : en);
  const tiles: Array<{ key: string; Icon: typeof Wallet; title: string; hint: string; to: string; hide?: boolean }> = [
    { key: 'budgets', Icon: Wallet, to: '/budgets', title: ar ? 'الميزانيات' : 'Budgets',
      hint: live.budgets != null ? (ar ? `${fmtNum(live.budgets)} سقف` : `${live.budgets} ${live.budgets === 1 ? 'cap' : 'caps'}`) : none('A cap per category', 'سقف لكل فئة') },
    { key: 'goals', Icon: Target, to: '/goals', title: ar ? 'الأهداف' : 'Goals',
      hint: live.goals && live.goals.n > 0 ? `${live.goals.top ?? ''}${live.goals.pct != null ? ` ${fmtNum(live.goals.pct)}%` : ''}`.trim() : none('What you save toward', 'ما تدّخر له') },
    { key: 'savings', Icon: Banknote, to: '/savings', title: ar ? 'المدخرات' : 'Savings', hide: inOrg,
      hint: live.savings ? `${fmtNum(Math.round(live.savings.value))} ${currencyLabel(live.savings.cur, lang)}` : none('Gold, currency and more', 'ذهب وعملات وغيرها') },
    { key: 'gam3yas', Icon: Users, to: '/gam3ya', title: ar ? 'الجمعيات' : 'Gam3yas', hide: inOrg,
      hint: live.gam3yas != null ? (ar ? `${fmtNum(live.gam3yas)} نشطة` : `${live.gam3yas} active`) : none('What you pay and collect', 'ما تدفعه وتقبضه') },
    { key: 'debts', Icon: CreditCard, to: '/debts', title: ar ? 'الديون' : 'Debts',
      hint: live.debts != null ? (live.debts > 0 ? (ar ? `${fmtNum(live.debts)} مفتوحة` : `${live.debts} open`) : none('None open', 'لا شيء مفتوح')) : none('What you still owe', 'ما تدين به') },
    { key: 'cards', Icon: Landmark, to: '/cards', title: ar ? 'حساباتي' : 'Accounts',
      hint: live.cards != null ? (ar ? `${fmtNum(live.cards)} حساب` : `${live.cards} ${live.cards === 1 ? 'account' : 'accounts'}`) : none('Bank, wallet, cash', 'بنك ومحفظة وكاش') },
    { key: 'report', Icon: FileText, to: '/reports/monthly', title: ar ? 'التقرير الشهري' : 'Monthly report', hint: none('Your month, explained', 'شهرك مشروحاً') },
    { key: 'reminders', Icon: CalendarClock, to: '/reminders', title: ar ? 'التذكيرات' : 'Reminders', hint: none('Bills and due dates', 'الفواتير والمواعيد') },
    { key: 'categories', Icon: Tags, to: '/categories', title: ar ? 'التصنيفات' : 'Categories', hint: none('Defaults and your own', 'افتراضية ومخصصة') },
    { key: 'habits', Icon: BellRing, to: '/habits', title: ar ? 'العادات' : 'Habits', hint: none('Patterns Seshat noticed', 'أنماط رصدتها سيشات') },
    { key: 'community', Icon: MessagesSquare, to: '/community', title: ar ? 'المجتمع' : 'Community', hint: none('Ask and answer', 'اسأل وأجب') },
  ];
  const shown = tiles.filter((x) => !x.hide);
  return (
    <View style={{ paddingHorizontal: 16, flexDirection: ar ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 10 }}>
      {shown.map((x, i) => (
        <Rise key={x.key} delay={i * 40} distance={10} style={{ width: '48.5%' }}>
          <Pressable
            onPress={() => router.push(x.to as never)}
            onPressIn={hapticLight}
            accessibilityRole="button"
            style={({ pressed }) => ({
              minHeight: 104, padding: 14, borderRadius: 20, backgroundColor: tok.surface, borderWidth: 1, borderColor: tok.border,
              ...(pressFeel(pressed) ?? {}),
            })}
          >
            <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: tok.elevated, alignItems: 'center', justifyContent: 'center' }}>
              <x.Icon size={18} color={tok.gold} strokeWidth={1.7} />
            </View>
            <Text numberOfLines={1} style={{ marginTop: 10, fontFamily: fontBody(lang, 'semibold'), fontSize: 16, color: tok.bone, textAlign: ar ? 'right' : 'left' }}>{x.title}</Text>
            <Text numberOfLines={2} style={{ marginTop: 2, fontFamily: fontBody(lang), fontSize: 14, color: tok.muted, textAlign: ar ? 'right' : 'left' }}>{x.hint}</Text>
          </Pressable>
        </Rise>
      ))}
    </View>
  );
}
