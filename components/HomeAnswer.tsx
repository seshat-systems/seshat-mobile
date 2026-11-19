import { HomeSkeletonBody } from './DashboardSkeleton';
import { pressFeel } from './press';
import { useEffect, useState, type ReactNode } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Mic, ArrowUp } from 'lucide-react-native';
import { useI18n, currencyLabel } from '../lib/i18n';
import { useAppData } from '../lib/appData';
import { apiFetch, hasToken } from '../lib/api';
import { fontBody, fontHead, fontMono } from '../lib/fonts';
import { fmtNum } from '../lib/privacy';
import type { DashboardData } from './dashboards';
import { Rise, GrowBar, CountUp } from './Motion';
import type { DailyBudgetInfo } from './MoneySheets';
import { requestAdd } from '../lib/pendingAdd';
import { sendHome, useHomeChat } from '../lib/homeChat';

/**
 * The top of Home: one sentence that says whether you are on track, a bar for where you are against where you should
 * be today, three numbers (left this month, safe to spend today, days to payday), and one input for everything else
 * ("45 coffee", "what can I spend today?"). All of it is worked out on the phone from the daily-budget numbers; the
 * input opens the Seshat chat with the typed words, so the AI does the work.
 * Without an income Seshat cannot plan, so it falls back to the plain "ahead / behind this month" sentence.
 */
export function HomeAnswer({ data, currency, needsCount = 0, onNeeds, after }: {
  data: DashboardData; currency: string; needsCount?: number; onNeeds?: () => void; after?: ReactNode;
}) {
  const { tok, lang } = useI18n();
  const { dataVersion } = useAppData();
  const router = useRouter();
  const ar = lang === 'ar';
  const [plan, setPlan] = useState<DailyBudgetInfo | null>(null);
  useEffect(() => {
    let alive = true;
    hasToken().then((ok) => {
      if (!ok) return;
      apiFetch<{ data: DailyBudgetInfo }>('/me/daily-budget').then((r) => { if (alive) setPlan(r.data); }).catch(() => { if (alive) setPlan((p) => p ?? ({ ready: false, currency: '', savingRate: 0 } as DailyBudgetInfo)); });
    });
    return () => { alive = false; };
  }, [dataVersion]);

  const net = data.current.balance;
  // "mostly Other" tells the person nothing, so a catch-all category is never named as the cause
  const top = [...(data.categoryBreakdown || [])].filter((c) => !/^(other|others|uncategori[sz]ed|أخرى)$/i.test((c.nameEn || '').trim())).sort((a, b) => b.total - a.total)[0];
  const topName = top ? (ar && top.nameAr ? top.nameAr : top.nameEn) : '';
  const spend = data.current.expense.total || 0;
  const share = top && spend > 0 ? Math.round((top.total / spend) * 100) : 0;
  const cur = currencyLabel(currency, lang);
  const amt = (v: number) => `${fmtNum(Math.round(Math.abs(v)))} ${cur}`;

  const ready = !!plan?.ready && plan.spendableMonth != null && plan.spentSoFar != null && plan.daysLeft != null;
  // Where we are in the financial month: day N of M, from the period end the server sends.
  let total = 0;
  let day = 0;
  if (ready && plan!.periodEnd) {
    const end = new Date(plan!.periodEnd);
    const start = new Date(end); start.setMonth(start.getMonth() - 1); start.setDate(start.getDate() + 1);
    total = Math.max(28, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
    day = Math.min(total, Math.max(1, total - (plan!.daysLeft ?? 0) + 1));
  }
  const monthLeft = ready ? (plan!.monthRemaining ?? 0) : 0;
  const todayLeft = ready ? (plan!.leftToday ?? 0) : 0;
  const overMonth = ready && (plan!.overIncome || plan!.overMonth || plan!.relaxed || monthLeft < 0);
  const overToday = ready && !overMonth && todayLeft < 0;
  const behind = ready ? overMonth || overToday : net < 0;

  let headline: string;
  let detail: string;
  if (!ready) {
    const amount = amt(net);
    headline = ar
      ? (net < 0 ? `أنت متأخر ${amount} هذا الشهر${topName ? `، وأغلبه في ${topName}` : ''}.` : `أنت متقدّم ${amount} هذا الشهر.`)
      : (net < 0 ? `You're ${amount} behind this month${topName ? `, mostly ${topName}` : ''}.` : `You're ${amount} ahead this month.`);
    detail = topName && share > 0
      ? (ar ? `${topName} تمثّل ${fmtNum(share)}% من مصروفاتك.` : `${topName} is ${share}% of what you spent.`)
      : (ar ? 'أخبرني بدخلك الشهري لأحسب لك ما تصرفه كل يوم.' : 'Tell me your monthly income and I will work out what you can spend each day.');
  } else if (plan!.overIncome) {
    headline = ar ? 'صرفت دخل هذا الشهر.' : "You've spent this month's income.";
    detail = ar ? 'اكتفِ بالضروريات حتى يبدأ الشهر الجديد.' : 'Stick to essentials until the new month.';
  } else if (overMonth) {
    headline = ar ? `أنت فوق خطتك هذا الشهر${topName ? `، وأغلبه في ${topName}` : ''}.` : `You're over your plan this month${topName ? `, mostly ${topName}` : ''}.`;
    detail = ar ? `اصرف حتى ${amt(plan!.dailyBudget ?? 0)} اليوم لتبقى ضمن دخلك.` : `Spend up to ${amt(plan!.dailyBudget ?? 0)} today to stay within your income.`;
  } else if (overToday) {
    headline = ar ? 'شهرك على المسار، لكنك تجاوزت حد اليوم.' : "You're on track for the month, but past today's limit.";
    detail = ar ? `تجاوزت ${amt(todayLeft)} اليوم.` : `${amt(todayLeft)} over today's limit.`;
  } else {
    headline = ar ? 'أنت على المسار.' : "You're on track.";
    detail = ar ? `${amt(todayLeft)} متبقية لتصرفها اليوم.` : `${amt(todayLeft)} left to spend today.`;
  }

  const fill = ready && plan!.spendableMonth! > 0 ? Math.min(1, plan!.spentSoFar! / plan!.spendableMonth!) : 0;
  const tick = total > 0 ? Math.min(1, day / total) : 0;
  const coach = ready && topName && share >= 25
    ? (ar ? `${topName} تمثّل ${fmtNum(share)}% من مصروفاتك.` : `${topName} is ${share}% of what you spent.`)
    : '';

  const ask = (q: string) => { void sendHome(q, (p) => router.push(p as never)); };
  const why = ar
    ? (topName ? `ليش صرفت كل هذا على ${topName}؟` : 'كيف حالي هذا الشهر؟')
    : (topName ? `Why did I spend so much on ${topName}?` : 'How am I doing this month?');
  const chip = { minHeight: 44, paddingHorizontal: 18, borderRadius: 999, justifyContent: 'center' as const };
  const align = ar ? 'right' : 'left';

  const Stat = ({ label, value, unit, bad, gold }: { label: string; value: number; unit: string; bad?: boolean; gold?: boolean }) => (
    <View style={{ flex: 1, paddingVertical: 14, paddingHorizontal: 14 }}>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ fontFamily: fontMono('medium'), fontSize: 12, letterSpacing: ar ? 0 : 1.2, color: tok.muted, textTransform: ar ? 'none' : 'uppercase', textAlign: align }}>{label}</Text>
      <CountUp value={value} format={(n) => fmtNum(Math.round(n))} delay={300} style={{ marginTop: 6, fontFamily: fontHead(lang), fontSize: 26, lineHeight: 30, color: bad ? tok.alertText : gold ? tok.goldLight : tok.bone, textAlign: align }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} />
      <Text style={{ marginTop: 2, fontFamily: fontBody(lang), fontSize: 13, color: tok.muted, textAlign: align }} numberOfLines={2}>{unit}</Text>
    </View>
  );

  // Until the plan has answered, hold the space instead of showing a sentence that then changes.
  if (plan === null) return <HomeSkeletonBody />;

  return (
    <>
    <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 6 }}>
      <Rise>
      <Text style={{
        fontFamily: fontHead(lang), fontSize: 28, lineHeight: 35, color: behind ? tok.bone : tok.goldLight,
        textAlign: align, letterSpacing: -0.3,
      }}>{headline}</Text>
      <Text style={{
        marginTop: 8, fontFamily: fontBody(lang), fontSize: 17, lineHeight: 25, color: behind && ready ? tok.bone : tok.muted,
        textAlign: align,
      }}>{detail}</Text>
      </Rise>

      {ready && total > 0 ? (
        <Rise delay={120}>
        <View style={{ marginTop: 18 }}>
          <GrowBar fraction={fill} color={overMonth ? tok.alertText : tok.gold} track={tok.elevated} delay={260} rtl={ar} tick={{ at: tick, color: tok.bone }} />
          <View style={{ flexDirection: ar ? 'row-reverse' : 'row', justifyContent: 'space-between', flexWrap: 'wrap', columnGap: 12, marginTop: 8 }}>
            <Text style={{ fontFamily: fontBody(lang), fontSize: 14, color: tok.muted }}>
              {ar ? `صرفت ${fmtNum(Math.round(plan!.spentSoFar!))} من ${fmtNum(Math.round(plan!.spendableMonth!))}` : `Spent ${fmtNum(Math.round(plan!.spentSoFar!))} of ${fmtNum(Math.round(plan!.spendableMonth!))}`}
            </Text>
            <Text style={{ fontFamily: fontBody(lang), fontSize: 14, color: tok.muted }}>
              {ar ? `اليوم ${fmtNum(day)} من ${fmtNum(total)}` : `Day ${day} of ${total}`}
            </Text>
          </View>
        </View>
        </Rise>
      ) : null}

      {ready ? (
        <Rise delay={220}>
        <View style={{ flexDirection: ar ? 'row-reverse' : 'row', marginTop: 16, borderRadius: 22, borderWidth: 1, borderColor: tok.border, backgroundColor: tok.surface }}>
          <Stat label={ar ? 'المتبقي' : 'Left'} value={Math.round(monthLeft)} unit={ar ? `${cur} هذا الشهر` : `${cur} this month`} bad={monthLeft < 0} gold={monthLeft >= 0} />
          <View style={{ width: 1, backgroundColor: tok.border }} />
          <Stat label={ar ? 'اليوم' : 'Today'} value={Math.round(todayLeft)} unit={todayLeft < 0 ? (ar ? `${cur} فوق الحد` : `${cur} over`) : (ar ? `${cur} آمن` : `${cur} safe`)} bad={todayLeft < 0} />
          <View style={{ width: 1, backgroundColor: tok.border }} />
          <Stat label={ar ? 'الراتب' : 'Payday'} value={plan!.daysLeft ?? 0} unit={ar ? 'يوم' : (plan!.daysLeft === 1 ? 'day' : 'days')} />
        </View>
        </Rise>
      ) : null}

      <Rise delay={320}>
      {coach ? (
        <Text style={{ marginTop: 14, fontFamily: fontBody(lang), fontSize: 16, lineHeight: 24, color: tok.muted, textAlign: align }}>{coach}</Text>
      ) : null}

      <View style={{ flexDirection: ar ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 }}>
        <Pressable onPress={() => ask(why)} accessibilityRole="button"
          style={({ pressed }) => ({ ...chip, backgroundColor: tok.gold, ...pressFeel(pressed) })}>
          <Text style={{ fontFamily: fontBody(lang, 'semibold'), fontSize: 15, color: tok.void }}>{ar ? 'اشرح لي السبب' : 'Show me why'}</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/plan' as never)} accessibilityRole="button"
          style={({ pressed }) => ({ ...chip, backgroundColor: tok.surface, borderWidth: 1, borderColor: tok.borderHi, ...pressFeel(pressed) })}>
          <Text style={{ fontFamily: fontBody(lang, 'semibold'), fontSize: 15, color: tok.bone }}>{ar ? 'خطتك' : 'Your plan'}</Text>
        </Pressable>
        {needsCount > 0 && onNeeds ? (
          <Pressable onPress={onNeeds} accessibilityRole="button"
            style={({ pressed }) => ({ ...chip, backgroundColor: tok.surface, borderWidth: 1, borderColor: tok.borderHi, ...pressFeel(pressed) })}>
            <Text style={{ fontFamily: fontBody(lang, 'semibold'), fontSize: 15, color: tok.bone }}>
              {ar ? `${needsCount} تحتاجك ${'←'}` : `${needsCount} need you →`}
            </Text>
          </Pressable>
        ) : null}
      </View>
      </Rise>
    </View>
    {after}
    </>
  );
}

/**
 * Home for someone with nothing recorded yet: Seshat introduces itself instead of an empty "no records" page, says what to
 * type, and offers the first steps. The typing field below (pinned by the Home screen) is the main way in.
 */
export function HomeIntro() {
  const { tok, lang } = useI18n();
  const router = useRouter();
  const ar = lang === 'ar';
  const align = ar ? 'right' : 'left';
  const ask = (q: string) => { void sendHome(q, (p) => router.push(p as never)); };
  const chip = { minHeight: 44, paddingHorizontal: 18, borderRadius: 999, justifyContent: 'center' as const, backgroundColor: tok.surface, borderWidth: 1, borderColor: tok.borderHi };
  const chips: Array<{ label: string; run: () => void; primary?: boolean }> = [
    { label: ar ? 'جهّز شهري' : 'Set up my month', run: () => ask(ar ? 'ساعدني أجهّز شهري' : 'Help me set up my month'), primary: true },
    { label: ar ? 'ماذا تستطيع أن تفعل؟' : 'What can you do?', run: () => ask(ar ? 'ماذا تستطيع أن تفعل؟' : 'What can you do?') },
    { label: ar ? 'امسح إيصالًا' : 'Scan a receipt', run: () => requestAdd('receipt') },
    { label: ar ? 'أضف يدويًا' : 'Add by hand', run: () => requestAdd('manual') },
  ];
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 6 }}>
      <Rise>
        <Text style={{ fontFamily: fontHead(lang), fontSize: 28, lineHeight: 35, color: tok.goldLight, textAlign: align, letterSpacing: -0.3 }}>
          {ar ? 'أهلاً، أنا سيشات.' : "Hi, I'm Seshat."}
        </Text>
        <Text style={{ marginTop: 10, fontFamily: fontBody(lang), fontSize: 17, lineHeight: 26, color: tok.muted, textAlign: align }}>
          {ar
            ? 'أخبرني بما تصرفه وما تكسبه بكلماتك، وأنا أحسب وأخبرك أين تقف.'
            : 'Tell me what you spend and earn in your own words. I keep the count and tell you where you stand.'}
        </Text>
      </Rise>
      <Rise delay={120}>
        <View style={{ marginTop: 18, padding: 16, borderRadius: 22, borderWidth: 1, borderColor: tok.border, backgroundColor: tok.surface, gap: 10 }}>
          <Text style={{ fontFamily: fontMono('medium'), fontSize: 12, letterSpacing: ar ? 0 : 1.2, color: tok.muted, textAlign: align, textTransform: ar ? 'none' : 'uppercase' }}>
            {ar ? 'جرّب أن تكتب' : 'Try typing'}
          </Text>
          {(ar ? ['٤٥ قهوة', 'راتبي ١٢٠٠٠', 'كم أصرف اليوم؟'] : ['45 coffee', 'salary 12000', 'what can I spend today?']).map((ex) => (
            <Text key={ex} style={{ fontFamily: fontBody(lang, 'medium'), fontSize: 17, color: tok.bone, textAlign: align, writingDirection: ar ? 'rtl' : 'ltr' }}>“{ex}”</Text>
          ))}
        </View>
      </Rise>
      <Rise delay={220}>
        <View style={{ flexDirection: ar ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 }}>
          {chips.map((c) => (
            <Pressable key={c.label} onPress={c.run} accessibilityRole="button"
              style={({ pressed }) => ({ ...chip, ...(c.primary ? { backgroundColor: tok.gold, borderColor: tok.gold } : null), ...pressFeel(pressed) })}>
              <Text style={{ fontFamily: fontBody(lang, 'semibold'), fontSize: 15, color: c.primary ? tok.void : tok.bone }}>{c.label}</Text>
            </Pressable>
          ))}
        </View>
      </Rise>
    </View>
  );
}

/**
 * The one place to say anything ("45 coffee", "what can I spend today?"). Home pins it just above the tab bar so it is
 * always visible, however far the page is scrolled. Sending opens the Seshat chat with the words; the mic opens it for voice.
 */
export function HomeInput() {
  const { tok, lang } = useI18n();
  const router = useRouter();
  const ar = lang === 'ar';
  const [text, setText] = useState('');
  // Sent from here, answered on Home (components/HomeReplies); the mic still opens the chat, which is where voice lives.
  const { sending } = useHomeChat();
  const submit = () => {
    const q = text.trim(); if (!q || sending) return; setText('');
    void sendHome(q, (p) => router.push(p as never));
  };
  return (
    <View style={{
      flexDirection: ar ? 'row-reverse' : 'row', alignItems: 'center', gap: 8, minHeight: 56,
      borderRadius: 999, backgroundColor: tok.surface, borderWidth: 1, borderColor: tok.borderHi,
      paddingStart: 20, paddingEnd: 6,
    }}>
      <TextInput
        value={text} onChangeText={setText} onSubmitEditing={submit} returnKeyType="send"
        placeholder={ar ? 'قل لسيشات…' : 'Tell Seshat…'} placeholderTextColor={tok.muted}
        style={{ flex: 1, minHeight: 52, color: tok.bone, fontFamily: fontBody(lang), fontSize: 16, textAlign: ar ? 'right' : 'left' }}
      />
      <Pressable onPress={text.trim() ? submit : () => router.push({ pathname: '/seshat/[id]', params: { id: 'new' } } as never)}
        accessibilityRole="button" accessibilityLabel={text.trim() ? 'Send' : 'Talk to Seshat'}
        style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: tok.gold, alignItems: 'center', justifyContent: 'center' }}>
        {text.trim() ? <ArrowUp size={20} color={tok.void} /> : <Mic size={20} color={tok.void} />}
      </Pressable>
    </View>
  );
}
