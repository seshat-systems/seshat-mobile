import { useEffect, useRef } from 'react';
import { View, Text, Animated } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { useI18n, formatAmount } from '../lib/i18n';
import { fontMono, fontBody } from '../lib/fonts';
import { RAmount } from './ui';
import { GrowBar } from './Motion';
import { useRouter } from 'expo-router';
import { Pressable } from 'react-native';
import { CategoryIconByKey } from './icons';
import { iconKeyForCategory } from '../lib/categoryMap';

/**
 * Visual blocks rendered beneath a Seshat reply (see seshat-api/lib/visualBlocks).
 *
 *  - transactions: the entries this turn logged, as compact cards (icons unified
 *    with the rest of the app via CategoryIconByKey).
 *  - chart: GENERATIVE - Seshat called render_chart, so we draw whatever it asked
 *    for (bars / donut / stat / trend) in the gold-on-void language. The client
 *    is a themed "playground"; the server validated the spec.
 *  - summary: back-compat for older persisted turns (no longer emitted).
 *
 * Kept presentation-only; the web chat renders the same shapes.
 */

export type TxKind = 'income' | 'expense';
export type VisualTransaction = {
  id: string;
  kind: TxKind;
  amount: number;
  currency: string;
  category: string;
  categoryIcon?: string;
  icon?: string;
  description?: string;
  date: string;
};
export type ChartKind = 'bars' | 'donut' | 'stat' | 'trend';
export type ChartPoint = { label: string; value: number };
export type CategorySlice = { category: string; total: number };
export type PlanGroupBlock = { key: 'needs' | 'wants' | 'saving'; spent: number; target: number; status: 'ok' | 'ahead' | 'over' };
export type VisualBlock =
  | { type: 'budgets'; currency: string; rows: Array<{ name: string; nameAr: string; spent: number; cap: number; percent: number; status: 'on-track' | 'near' | 'over' }> }
  | { type: 'goals'; currency: string; rows: Array<{ name: string; nameAr: string; saved: number; target: number; percent: number }> }
  | { type: 'plan'; period: { en: string; ar: string }; currency: string; income: number; accepted?: boolean; split?: { needs: number; wants: number; saving: number }; verdict: 'on_plan' | 'ahead_of_pace' | 'over'; paceFraction: number; groups: PlanGroupBlock[] }
  | { type: 'transactions'; items: VisualTransaction[] }
  | { type: 'chart'; kind: ChartKind; title: string; unit?: string; caption?: string; series: ChartPoint[] }
  | { type: 'summary'; period: string; currency: string; income: number; expense: number; balance: number; topCategories: CategorySlice[] };

const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
function monthLabel(period: string, lang: string): string {
  const [y, m] = period.split('-').map((n) => parseInt(n, 10));
  const names = lang === 'ar' ? MONTHS_AR : MONTHS_EN;
  return `${names[m - 1] ?? ''} ${y || ''}`.trim();
}
const fmt = (n: number) => formatAmount(n, { decimals: 0, short: true });
// Gold-family palette for multi-slice charts (dark-first; reads on the glass).
const SLICE = ['rgba(201,168,76,1)', 'rgba(232,201,122,0.92)', 'rgba(201,168,76,0.6)', 'rgba(232,201,122,0.5)', 'rgba(201,168,76,0.34)', 'rgba(232,201,122,0.28)'];

export function ChatBlocks({ blocks }: { blocks?: VisualBlock[] }) {
  if (!blocks || blocks.length === 0) return null;
  return (
    <FadeIn>
      <View style={{ gap: 8 }}>
        {blocks.map((b, i) => {
          if (b.type === 'plan') return <PlanBlockView key={i} block={b} />;
          if (b.type === 'budgets') return <BudgetsBlockView key={i} block={b} />;
          if (b.type === 'goals') return <GoalsBlockView key={i} block={b} />;
          if (b.type === 'transactions') return <TransactionsBlockView key={i} items={b.items} />;
          if (b.type === 'chart') return <ChartBlockView key={i} block={b} />;
          if (b.type === 'summary') return <SummaryBlockView key={i} block={b} />;
          return null;
        })}
      </View>
    </FadeIn>
  );
}

// Gentle mount reveal - the blocks rise + fade in once typing has finished.
function FadeIn({ children }: { children: React.ReactNode }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 360, useNativeDriver: true }).start();
  }, []);
  return (
    <Animated.View style={{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }}>
      {children}
    </Animated.View>
  );
}

// ── Transactions: compact cards for the entries this turn logged ────────────
function TransactionsBlockView({ items }: { items: VisualTransaction[] }) {
  const { tok, lang } = useI18n();
  const rowDir = lang === 'ar' ? 'row-reverse' : 'row';
  return (
    <View style={{
      backgroundColor: tok.coreBg,
      borderRadius: 14,
      borderWidth: 1, borderColor: tok.shellBorder, borderTopColor: tok.coreSheen,
      overflow: 'hidden',
    }}>
      <View style={{ flexDirection: rowDir, alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingTop: 11, paddingBottom: 9 }}>
        <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: tok.gold }} />
        <Text style={{ fontFamily: fontBody(lang, 'semibold'), fontSize: 15, color: tok.gold }}>
          {lang === 'ar' ? (items.length > 1 ? `سُجّلت ${items.length} معاملات` : 'سُجّلت') : (items.length > 1 ? `Recorded ${items.length} entries` : 'Recorded')}
        </Text>
      </View>
      {items.map((t) => (
        <View key={t.id} style={{ flexDirection: rowDir, alignItems: 'center', gap: 11, paddingHorizontal: 14, paddingVertical: 11, borderTopWidth: 1, borderTopColor: tok.shellBorder }}>
          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: tok.glowShellBg, borderWidth: 1, borderColor: tok.glowShellBorder, alignItems: 'center', justifyContent: 'center' }}>
            <CategoryIconByKey iconKey={iconKeyForCategory({ icon: t.icon, nameEn: t.category })} size={16} color={tok.bone} strokeWidth={1.6} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ fontFamily: fontBody(lang), fontSize: 16, color: tok.bone, textAlign: lang === 'ar' ? 'right' : 'left' }}>
              {t.category}
            </Text>
            <Text numberOfLines={1} style={{ fontFamily: fontBody(lang), fontSize: 14, color: tok.muted, marginTop: 2, textAlign: lang === 'ar' ? 'right' : 'left' }}>
              {t.description ? `${t.description} · ${t.date}` : t.date}
            </Text>
          </View>
          <RAmount value={t.kind === 'expense' ? -t.amount : t.amount} currency={t.currency} size={17} sign decimals={0} weight="medium" />
        </View>
      ))}
    </View>
  );
}

// ── Charts: the generative playground ───────────────────────────────────────
function ChartShell({ title, caption, children }: { title: string; caption?: string; children: React.ReactNode }) {
  const { tok, lang } = useI18n();
  const align: 'right' | 'left' = lang === 'ar' ? 'right' : 'left';
  return (
    <View style={{ backgroundColor: tok.glowShellBg, borderRadius: 22, borderWidth: 1, borderColor: tok.glowShellBorder, borderTopColor: tok.glowCoreSheen, paddingHorizontal: 16, paddingVertical: 16 }}>
      <Text style={{ fontFamily: fontBody(lang, 'semibold'), fontSize: 16, color: tok.gold, textAlign: align }}>
        {title}
      </Text>
      {children}
      {caption ? (
        <Text style={{ fontFamily: fontBody(lang), fontSize: 14, color: tok.muted, marginTop: 12, textAlign: align }}>{caption}</Text>
      ) : null}
    </View>
  );
}

const GROUP_LABEL = {
  needs: { en: 'Needs', ar: 'الاحتياجات' },
  wants: { en: 'Wants', ar: 'الرغبات' },
  saving: { en: 'Saving', ar: 'الادخار' },
} as const;

/** Budgets and goals as cards in the chat: the same rows as the Dashboard sections, with "See all" to the full screen. */
function ProgressCard({ title, to, pill, children }: { title: string; to: string; pill?: { text: string; color: string }; children: React.ReactNode }) {
  const { tok, lang } = useI18n();
  const router = useRouter();
  const ar = lang === 'ar';
  return (
    <View style={{ backgroundColor: tok.glowShellBg, borderRadius: 22, borderWidth: 1, borderColor: tok.glowShellBorder, borderTopColor: tok.glowCoreSheen, padding: 16 }}>
      <View style={{ flexDirection: ar ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <View style={{ flexDirection: ar ? 'row-reverse' : 'row', alignItems: 'center', gap: 10, flex: 1 }}>
          <Text style={{ fontFamily: fontBody(lang, 'semibold'), fontSize: 16, color: tok.gold }}>{title}</Text>
          {pill ? (
            <View style={{ paddingHorizontal: 10, minHeight: 26, borderRadius: 999, justifyContent: 'center', borderWidth: 1, borderColor: pill.color }}>
              <Text style={{ fontFamily: fontBody(lang, 'semibold'), fontSize: 12, color: pill.color }}>{pill.text}</Text>
            </View>
          ) : null}
        </View>
        <Pressable onPress={() => router.push(to as never)} hitSlop={10} accessibilityRole="button" style={{ minHeight: 32, justifyContent: 'center' }}>
          <Text style={{ fontFamily: fontBody(lang, 'semibold'), fontSize: 14, color: tok.gold }}>{ar ? 'عرض الكل ‹' : 'See all ›'}</Text>
        </Pressable>
      </View>
      <View style={{ marginTop: 6 }}>{children}</View>
    </View>
  );
}

function BudgetsBlockView({ block }: { block: Extract<VisualBlock, { type: 'budgets' }> }) {
  const { tok, lang } = useI18n();
  const ar = lang === 'ar';
  const over = block.rows.filter((r) => r.status === 'over').length;
  const n = (v: number) => Math.round(v).toLocaleString('en-US');
  return (
    <ProgressCard title={ar ? 'الميزانيات' : 'Budgets'} to="/budgets"
      pill={over > 0 ? { text: ar ? `${over} فوق السقف` : `${over} over`, color: tok.alertText } : undefined}>
      {block.rows.slice(0, 5).map((r, i) => (
        <View key={i} style={{ marginTop: 12 }}>
          <View style={{ flexDirection: ar ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
            <Text numberOfLines={1} style={{ flex: 1, fontFamily: fontBody(lang, 'medium'), fontSize: 15, color: tok.bone, textAlign: ar ? 'right' : 'left' }}>{ar && r.nameAr ? r.nameAr : r.name}</Text>
            <Text style={{ fontFamily: fontBody(lang), fontSize: 14, color: r.status === 'over' ? tok.alertText : tok.muted, writingDirection: 'ltr' }}>{n(r.spent)} / {n(r.cap)}</Text>
          </View>
          <GrowBar fraction={Math.min(1, r.percent / 100)} color={r.status === 'over' ? tok.alertText : r.status === 'near' ? tok.warnText : tok.gold} track={tok.shellBg} rtl={ar} delay={i * 100} />
        </View>
      ))}
    </ProgressCard>
  );
}

function GoalsBlockView({ block }: { block: Extract<VisualBlock, { type: 'goals' }> }) {
  const { tok, lang } = useI18n();
  const ar = lang === 'ar';
  const n = (v: number) => Math.round(v).toLocaleString('en-US');
  return (
    <ProgressCard title={ar ? 'الأهداف' : 'Goals'} to="/goals">
      {block.rows.slice(0, 5).map((r, i) => (
        <View key={i} style={{ marginTop: 12 }}>
          <View style={{ flexDirection: ar ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
            <Text numberOfLines={1} style={{ flex: 1, fontFamily: fontBody(lang, 'medium'), fontSize: 15, color: tok.bone, textAlign: ar ? 'right' : 'left' }}>{ar && r.nameAr ? r.nameAr : r.name}</Text>
            <Text style={{ fontFamily: fontBody(lang), fontSize: 14, color: tok.muted, writingDirection: 'ltr' }}>{r.percent}% · {n(r.saved)} / {n(r.target)}</Text>
          </View>
          <GrowBar fraction={Math.min(1, r.percent / 100)} color={tok.gold} track={tok.shellBg} rtl={ar} delay={i * 100} />
        </View>
      ))}
    </ProgressCard>
  );
}

/** The monthly plan as one card: where each group stands against its allowance, a tick for where the calendar says you should be. */
export function PlanBlockView({ block }: { block: Extract<VisualBlock, { type: 'plan' }> }) {
  const { tok, lang } = useI18n();
  const ar = lang === 'ar';
  const rowDir = ar ? 'row-reverse' : 'row';
  const align: 'right' | 'left' = ar ? 'right' : 'left';
  const verdict = ({
    on_plan: { en: 'On track', ar: 'على المسار', color: tok.posText },
    ahead_of_pace: { en: 'Ahead of pace', ar: 'أسرع من المعتاد', color: tok.warnText },
    over: { en: 'Over', ar: 'تجاوزت', color: tok.alertText },
  } as const)[block.verdict] ?? { en: '', ar: '', color: tok.muted };
  const n = (v: number) => Math.round(v).toLocaleString('en-US');
  const cur = block.currency;
  return (
    <View style={{ backgroundColor: tok.glowShellBg, borderRadius: 22, borderWidth: 1, borderColor: tok.glowShellBorder, borderTopColor: tok.glowCoreSheen, padding: 16 }}>
      <View style={{ flexDirection: rowDir, justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <Text numberOfLines={1} style={{ flex: 1, fontFamily: fontBody(lang, 'semibold'), fontSize: 16, color: tok.gold, textAlign: align }}>
          {block.accepted ? (ar ? `خطة ${block.period.ar}` : `${block.period.en} plan`) : (ar ? `خطة مقترحة · ${block.period.ar}` : `Suggested split · ${block.period.en}`)} · {n(block.income)} {cur}
        </Text>
        <View style={{ paddingHorizontal: 10, minHeight: 28, borderRadius: 999, justifyContent: 'center', borderWidth: 1, borderColor: verdict.color }}>
          <Text style={{ fontFamily: fontBody(lang, 'semibold'), fontSize: 13, color: verdict.color }}>{ar ? verdict.ar : verdict.en}</Text>
        </View>
      </View>
      <View style={{ marginTop: 14, gap: 14 }}>
        {block.groups.map((g) => {
          const fill = g.target > 0 ? Math.min(1, g.spent / g.target) : 0;
          const color = g.status === 'over' ? tok.alertText : g.status === 'ahead' ? tok.warnText : tok.gold;
          return (
            <View key={g.key}>
              <View style={{ flexDirection: rowDir, justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                <Text style={{ fontFamily: fontBody(lang, 'medium'), fontSize: 15, color: tok.bone }}>{GROUP_LABEL[g.key][ar ? 'ar' : 'en']}</Text>
                <Text style={{ fontFamily: fontBody(lang), fontSize: 14, color: tok.muted, writingDirection: 'ltr' }}>{n(g.spent)} / {n(g.target)}</Text>
              </View>
              <GrowBar fraction={fill} color={color} track={tok.shellBg} rtl={ar} delay={200 + block.groups.indexOf(g) * 120} tick={{ at: block.paceFraction, color: tok.bone }} />
            </View>
          );
        })}
      </View>
      <Text style={{ fontFamily: fontBody(lang), fontSize: 13, color: tok.muted, marginTop: 12, textAlign: align }}>
        {block.accepted
          ? (ar ? 'الخط الأبيض هو أين يجب أن تكون اليوم.' : 'The white tick is where you should be today.')
          : (ar ? `اقتراح تلقائي (${block.split?.needs ?? 50}٪ احتياجات، ${block.split?.wants ?? 30}٪ رغبات، ${block.split?.saving ?? 20}٪ ادخار). لم تعتمده بعد.` : `A suggestion (${block.split?.needs ?? 50}% needs, ${block.split?.wants ?? 30}% wants, ${block.split?.saving ?? 20}% saving). You haven't set it yet. Open it to use or change it.`)}
      </Text>
    </View>
  );
}

function ChartBlockView({ block }: { block: Extract<VisualBlock, { type: 'chart' }> }) {
  const series = (block.series ?? []).filter((p) => p && typeof p.value === 'number');
  if (series.length === 0) return null;
  return (
    <ChartShell title={block.title} caption={block.caption}>
      {block.kind === 'donut' ? <DonutChart series={series} unit={block.unit} />
        : block.kind === 'stat' ? <StatChart series={series} unit={block.unit} />
          : block.kind === 'trend' ? <TrendChart series={series} unit={block.unit} />
            : <BarsChart series={series} unit={block.unit} />}
    </ChartShell>
  );
}

function BarsChart({ series, unit }: { series: ChartPoint[]; unit?: string }) {
  const { tok, lang } = useI18n();
  const max = Math.max(...series.map((p) => Math.abs(p.value)), 1);
  const rowDir = lang === 'ar' ? 'row-reverse' : 'row';
  const align: 'right' | 'left' = lang === 'ar' ? 'right' : 'left';
  return (
    <View style={{ marginTop: 12, gap: 9 }}>
      {series.slice(0, 8).map((p, i) => (
        <View key={i}>
          <View style={{ flexDirection: rowDir, justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
            <Text numberOfLines={1} style={{ flex: 1, fontFamily: fontBody(lang, 'medium'), fontSize: 15, color: tok.bone, textAlign: align }}>{p.label}</Text>
            <Text style={{ fontFamily: fontBody(lang), fontSize: 14, color: tok.muted, marginHorizontal: 8, writingDirection: 'ltr' }}>
              {fmt(p.value)}{unit ? ` ${unit}` : ''}
            </Text>
          </View>
          <GrowBar fraction={Math.max(0.06, Math.abs(p.value) / max)} color={tok.gold} track={tok.shellBg} height={10} rtl={lang === 'ar'} delay={i * 90} />
        </View>
      ))}
    </View>
  );
}

function DonutChart({ series, unit }: { series: ChartPoint[]; unit?: string }) {
  const { tok, lang } = useI18n();
  const pts = series.slice(0, 6);
  const total = pts.reduce((s, p) => s + Math.abs(p.value), 0) || 1;
  const SIZE = 124, TH = 16;
  const R = (SIZE - TH) / 2;
  const C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <View style={{ flexDirection: lang === 'ar' ? 'row-reverse' : 'row', alignItems: 'center', gap: 16, marginTop: 12 }}>
      <View style={{ width: SIZE, height: SIZE }}>
        <Svg width={SIZE} height={SIZE}>
          <G rotation={-90} originX={SIZE / 2} originY={SIZE / 2}>
            <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke={tok.shellBg} strokeWidth={TH} />
            {pts.map((p, i) => {
              const len = (Math.abs(p.value) / total) * C;
              const el = (
                <Circle key={i} cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none"
                  stroke={SLICE[i % SLICE.length]} strokeWidth={TH}
                  strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-acc} />
              );
              acc += len;
              return el;
            })}
          </G>
        </Svg>
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: fontMono('medium'), fontSize: 16, color: tok.bone, writingDirection: 'ltr' }}>{fmt(total)}</Text>
          {unit ? <Text style={{ fontFamily: fontMono('regular'), fontSize: 12, color: tok.muted, marginTop: 1 }}>{unit}</Text> : null}
        </View>
      </View>
      <View style={{ flex: 1, gap: 8 }}>
        {pts.map((p, i) => (
          <View key={i} style={{ flexDirection: lang === 'ar' ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 9, height: 9, borderRadius: 2.5, backgroundColor: SLICE[i % SLICE.length] }} />
            <Text numberOfLines={1} style={{ flex: 1, fontFamily: fontBody(lang), fontSize: 14, color: tok.bone, textAlign: lang === 'ar' ? 'right' : 'left' }}>{p.label}</Text>
            <Text style={{ fontFamily: fontMono('regular'), fontSize: 12, color: tok.muted, writingDirection: 'ltr' }}>{fmt(p.value)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function StatChart({ series, unit }: { series: ChartPoint[]; unit?: string }) {
  const { tok, lang } = useI18n();
  const hero = series[0];
  const rest = series.slice(1, 4);
  const rowDir = lang === 'ar' ? 'row-reverse' : 'row';
  const align: 'right' | 'left' = lang === 'ar' ? 'right' : 'left';
  return (
    <View style={{ marginTop: 9 }}>
      <View style={{ alignItems: lang === 'ar' ? 'flex-end' : 'flex-start' }}>
        <RAmount value={hero.value} currency={unit || 'EGP'} size={32} sign decimals={0} />
      </View>
      <Text style={{ fontFamily: fontMono('regular'), fontSize: 12, letterSpacing: 1.2, color: tok.muted, textTransform: 'uppercase', marginTop: 3, textAlign: align }}>{hero.label}</Text>
      {rest.length > 0 && (
        <View style={{ flexDirection: rowDir, gap: 18, marginTop: 12 }}>
          {rest.map((p, i) => (
            <View key={i}>
              <Text style={{ fontFamily: fontMono('regular'), fontSize: 12, letterSpacing: 1.2, color: tok.muted, textTransform: 'uppercase', textAlign: align }}>{p.label}</Text>
              <Text style={{ fontFamily: fontMono('medium'), fontSize: 16, color: tok.bone, marginTop: 2, textAlign: align, writingDirection: 'ltr' }}>{fmt(p.value)}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function TrendChart({ series, unit }: { series: ChartPoint[]; unit?: string }) {
  const { tok, lang } = useI18n();
  const pts = series.slice(0, 12);
  const max = Math.max(...pts.map((p) => Math.abs(p.value)), 1);
  return (
    <View style={{ marginTop: 12 }}>
      <View style={{ flexDirection: lang === 'ar' ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 4, height: 56 }}>
        {pts.map((p, i) => (
          <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
            <View style={{ width: '72%', maxWidth: 22, height: `${Math.max(4, (Math.abs(p.value) / max) * 100)}%`, backgroundColor: i === pts.length - 1 ? tok.gold : tok.borderHi, borderRadius: 2, opacity: i === pts.length - 1 ? 1 : 0.55 + (i / pts.length) * 0.4 }} />
          </View>
        ))}
      </View>
      <View style={{ flexDirection: lang === 'ar' ? 'row-reverse' : 'row', gap: 4, marginTop: 6 }}>
        {pts.map((p, i) => (
          <Text key={i} numberOfLines={1} style={{ flex: 1, textAlign: 'center', fontFamily: fontMono('regular'), fontSize: 12, color: tok.muted }}>{p.label}</Text>
        ))}
      </View>
    </View>
  );
}

// ── Summary: back-compat renderer for older persisted turns ─────────────────
function SummaryBlockView({ block }: { block: Extract<VisualBlock, { type: 'summary' }> }) {
  const { tok, lang } = useI18n();
  const cats = (block.topCategories ?? []).filter((c) => c.total > 0).slice(0, 5);
  const max = Math.max(1, ...cats.map((c) => c.total));
  const rowDir = lang === 'ar' ? 'row-reverse' : 'row';
  const align: 'right' | 'left' = lang === 'ar' ? 'right' : 'left';
  return (
    <View style={{ backgroundColor: tok.glowShellBg, borderRadius: 14, borderWidth: 1, borderColor: tok.glowShellBorder, borderTopColor: tok.glowCoreSheen, paddingHorizontal: 14, paddingVertical: 13 }}>
      <Text style={{ fontFamily: fontMono('regular'), fontSize: 12, letterSpacing: 1.6, color: tok.gold, textTransform: 'uppercase', textAlign: align }}>
        {monthLabel(block.period, lang)} · {lang === 'ar' ? 'ملخص' : 'Summary'}
      </Text>
      <View style={{ marginTop: 9, alignItems: lang === 'ar' ? 'flex-end' : 'flex-start' }}>
        <RAmount value={block.balance} currency={block.currency} size={30} sign decimals={0} />
      </View>
      <View style={{ flexDirection: rowDir, gap: 18, marginTop: 8 }}>
        <SummaryStat label={lang === 'ar' ? 'الدخل' : 'Income'} value={block.income} color={tok.posText} align={align} />
        <SummaryStat label={lang === 'ar' ? 'المصروف' : 'Spent'} value={block.expense} color={tok.alertText} align={align} />
      </View>
      {cats.length > 0 && (
        <View style={{ marginTop: 13, paddingTop: 13, borderTopWidth: 1, borderTopColor: tok.glowShellBorder, gap: 9 }}>
          {cats.map((c) => (
            <View key={c.category}>
              <View style={{ flexDirection: rowDir, justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                <Text numberOfLines={1} style={{ flex: 1, fontFamily: fontBody(lang), fontSize: 14, color: tok.bone, textAlign: align }}>{c.category}</Text>
                <Text style={{ fontFamily: fontMono('regular'), fontSize: 12, color: tok.muted, marginHorizontal: 8, writingDirection: 'ltr' }}>{fmt(c.total)}</Text>
              </View>
              <View style={{ height: 6, borderRadius: 3, backgroundColor: tok.shellBg, overflow: 'hidden', flexDirection: lang === 'ar' ? 'row-reverse' : 'row' }}>
                <View style={{ width: `${Math.max(6, (c.total / max) * 100)}%`, backgroundColor: tok.gold, borderRadius: 3 }} />
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function SummaryStat({ label, value, color, align }: { label: string; value: number; color: string; align: 'right' | 'left' }) {
  const { tok } = useI18n();
  return (
    <View>
      <Text style={{ fontFamily: fontMono('regular'), fontSize: 12, letterSpacing: 1.2, color: tok.muted, textTransform: 'uppercase', textAlign: align }}>{label}</Text>
      <Text style={{ fontFamily: fontMono('medium'), fontSize: 16, color, marginTop: 2, textAlign: align, writingDirection: 'ltr' }}>{fmt(value)}</Text>
    </View>
  );
}
