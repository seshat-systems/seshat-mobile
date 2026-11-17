import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, FlatList, RefreshControl, Alert } from 'react-native';
// Search + filter chips sit between the header and this list, so it must clip (not slide under them).
import { FlatList as ScreenFlatList } from 'react-native';
import { FrostedHeader } from '../../components/FrostedHeader';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SlidersHorizontal } from 'lucide-react-native';
import { apiFetch, hasToken } from '../../lib/api';
import { useI18n, monthYear, currencyLabel } from '../../lib/i18n';
import { fmtNum } from '../../lib/privacy';
import { useAppData } from '../../lib/appData';
import { fontBody, fontHead } from '../../lib/fonts';
import { RCard, REyebrow, RPill, RHScroll, RAmount, RField, RChip } from '../../components/ui';
import { ScreenScaffold } from '../../components/Screen';
import { RTxRow, RefreshSpinner, type TxRowData } from '../../components/shell';
import { SkeletonRow } from '../../components/Skeleton';
import { EditTransactionSheet, type EditingTx } from '../../components/EditTransactionSheet';
import type { CardSummary } from '../../lib/cards';
import { TxFiltersSheet, EMPTY_FILTERS, type TxFilters } from '../../components/TxFiltersSheet';

/** First day of the current financial month (the month starts on the person's payday, day 1 by default), as YYYY-MM-DD. */
function monthStartISO(startDay: number | null | undefined): string {
  const d = Math.min(Math.max(Math.trunc(Number(startDay) || 1), 1), 31);
  const now = new Date();
  const clamp = (y: number, m: number) => Math.min(d, new Date(y, m + 1, 0).getDate());
  let y = now.getFullYear(); let m = now.getMonth();
  if (now.getDate() < clamp(y, m)) { m -= 1; if (m < 0) { m = 11; y -= 1; } }
  const dd = clamp(y, m);
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

export default function TransactionsScreen() {
  const { tok, lang, t } = useI18n();
  const { dataVersion, categories, projects, bumpVersion, profile } = useAppData();
  const insets = useSafeAreaInsets();
  const [txs, setTxs] = useState<TxRowData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Records open on the current month, like Home, so the total at the top is the month's. "Reset" in the filter sheet shows everything.
  const defaultFrom = monthStartISO(profile?.monthStartDay);
  const [filters, setFilters] = useState<TxFilters>({ ...EMPTY_FILTERS, from: monthStartISO(profile?.monthStartDay) });
  const lastDefault = useRef(defaultFrom);
  useEffect(() => {
    // The profile arrives after the first render: move the default to the person's own month start unless they already chose a range.
    if (lastDefault.current !== defaultFrom) {
      setFilters((f) => (f.from === lastDefault.current && !f.to ? { ...f, from: defaultFrom } : f));
      lastDefault.current = defaultFrom;
    }
  }, [defaultFrom]);
  const rangeIsDefault = filters.from === defaultFrom && !filters.to;
  // Project filter is single-select and lives outside the FiltersSheet for
  // quick switching: null = no filter, 'none' = only untagged tx, else id.
  const [projectFilter, setProjectFilter] = useState<string | 'none' | null>(null);
  // Whenever the workspace switches off an org ledger (projects becomes
  // empty), drop any in-flight project filter so we don't ship a stale id.
  useEffect(() => {
    if (projects.length === 0 && projectFilter !== null) setProjectFilter(null);
  }, [projects.length, projectFilter]);
  // Card filter (single-select): null = all, 'none' = entries without a card, else a card id.
  const [cards, setCards] = useState<CardSummary[]>([]);
  const [cardFilter, setCardFilter] = useState<string | 'none' | null>(null);
  useEffect(() => {
    (async () => {
      if (!(await hasToken())) return;
      try {
        const r = await apiFetch<{ data: CardSummary[] }>('/cards');
        setCards(r.data);
        setCardFilter((cur) => (cur && cur !== 'none' && !r.data.some((c) => c.id === cur) ? null : cur));
      } catch { /* no cards yet */ }
    })();
  }, [dataVersion]);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [query, setQuery] = useState('');
  // Debounce the search box so we fetch once the user pauses, not on every
  // keystroke (which also avoids out-of-order responses).
  const [debouncedQuery, setDebouncedQuery] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(id);
  }, [query]);
  const [editing, setEditing] = useState<EditingTx | null>(null);

  const onRowAction = (tx: TxRowData) => {
    Alert.alert(
      tx.description || (lang === 'ar' ? 'المعاملة' : 'Transaction'),
      lang === 'ar' ? 'ماذا تريد أن تفعل؟' : 'What do you want to do?',
      [
        {
          text: lang === 'ar' ? 'تعديل' : 'Edit',
          onPress: () => setEditing({
            _id: tx._id,
            type: tx.type,
            amount: tx.amount,
            currency: tx.currency,
            description: tx.description,
            date: tx.date,
            categoryId: tx.categoryId as EditingTx['categoryId'],
          }),
        },
        {
          text: lang === 'ar' ? 'حذف' : 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              lang === 'ar' ? 'تأكيد الحذف' : 'Delete this entry?',
              tx.description || '',
              [
                { text: lang === 'ar' ? 'إلغاء' : 'Cancel', style: 'cancel' },
                {
                  text: lang === 'ar' ? 'حذف' : 'Delete',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await apiFetch(`/transactions/${tx._id}`, { method: 'DELETE' });
                      bumpVersion();
                    } catch (e) { console.warn('delete tx', e); }
                  },
                },
              ],
            );
          },
        },
        { text: lang === 'ar' ? 'إلغاء' : 'Cancel', style: 'cancel' },
      ],
    );
  };

  const fetchTxs = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    const has = await hasToken();
    if (!has) return;
    if (mode === 'initial') setLoading(true);
    else setRefreshing(true);
    try {
      const params = new URLSearchParams();
      if (filters.type === 'income' || filters.type === 'expense') params.set('type', filters.type);
      if (filters.categoryIds.length) params.set('categoryIds', filters.categoryIds.join(','));
      if (filters.sources.length) params.set('sources', filters.sources.join(','));
      if (filters.from) params.set('from', filters.from);
      if (filters.to) params.set('to', filters.to);
      if (typeof filters.minAmount === 'number') params.set('minAmount', String(filters.minAmount));
      if (typeof filters.maxAmount === 'number') params.set('maxAmount', String(filters.maxAmount));
      if (projectFilter) params.set('projectId', projectFilter);
      if (cardFilter) params.set('cardId', cardFilter);
      params.set('limit', '100');
      if (debouncedQuery.trim()) params.set('search', debouncedQuery.trim());
      const res = await apiFetch<{ data: TxRowData[] }>(`/transactions?${params.toString()}`);
      setTxs(res.data);
    } catch (err) {
      console.warn('tx fetch failed', err);
    } finally {
      if (mode === 'initial') setLoading(false);
      else setRefreshing(false);
    }
  }, [filters, debouncedQuery, projectFilter, cardFilter]);

  useEffect(() => { fetchTxs('initial'); }, [fetchTxs, dataVersion]);

  // Group by relative day for the section headers (Today / Yesterday / older).
  // Each entry also carries a precomputed dayTotal so the render loop can read
  // it directly instead of calling .reduce() per group on every render pass.
  const groups = useMemo(() => {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const map = new Map<string, TxRowData[]>();
    for (const tx of txs) {
      const d = new Date(tx.date); d.setHours(0, 0, 0, 0);
      const diff = Math.round((now.getTime() - d.getTime()) / 86_400_000);
      let key: string;
      if (diff === 0) key = t('today');
      else if (diff === 1) key = t('yesterday');
      else key = d.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'short' });
      const arr = map.get(key) ?? [];
      arr.push(tx);
      map.set(key, arr);
    }
    return Array.from(map.entries()).map(([day, list]) => ({
      day,
      list,
      dayTotal: list.reduce((s, tx) => s + (tx.type === 'income' ? tx.amount : -tx.amount), 0),
    }));
  }, [txs, lang, t]);

  // What the list adds up to, and the categories worth a one-tap filter (the biggest spending, kept steady while one is chosen).
  const totals = useMemo(() => {
    let spent = 0; let earned = 0;
    for (const tx of txs) { if (tx.type === 'income') earned += tx.amount; else spent += tx.amount; }
    return { spent, earned };
  }, [txs]);
  const [lens, setLens] = useState<Array<{ id: string; name: string; pct: number }>>([]);
  useEffect(() => {
    if (filters.categoryIds.length > 0) return;
    const by = new Map<string, { name: string; total: number }>();
    let all = 0;
    for (const tx of txs) {
      if (tx.type !== 'expense' || !tx.categoryId?._id || tx.categoryId.icon === 'savings') continue;   // money set aside is not a spending category
      all += tx.amount;
      const nm = (lang === 'ar' && tx.categoryId.nameAr) ? tx.categoryId.nameAr : (tx.categoryId.nameEn ?? '');
      const cur = by.get(tx.categoryId._id) ?? { name: nm, total: 0 };
      cur.total += tx.amount; by.set(tx.categoryId._id, cur);
    }
    setLens([...by.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 4)
      .map(([id, v]) => ({ id, name: v.name, pct: all > 0 ? Math.round((v.total / all) * 100) : 0 })));
  }, [txs, filters.categoryIds.length, lang]);

  return (
    <ScreenScaffold>
      <FrostedHeader style={{
        paddingHorizontal: 20, paddingTop: 14, paddingBottom: 8,
        flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
        alignItems: 'center', justifyContent: 'space-between', gap: 12,
      }}>
        <View style={{ flex: 1 }}>
          <Text style={{
            fontFamily: fontHead(lang),
            fontSize: 28, color: tok.bone, letterSpacing: -0.5,
            textAlign: lang === 'ar' ? 'right' : 'left',
          }}>{t('transactions')}</Text>
          {/* The month in one line: what the list adds up to. */}
          <View style={{ marginTop: 6, flexDirection: lang === 'ar' ? 'row-reverse' : 'row', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <Text style={{ fontFamily: fontHead(lang), fontSize: 30, color: filters.type === 'income' ? tok.posText : tok.goldLight }}>
              {fmtNum(Math.round(filters.type === 'income' ? totals.earned : totals.spent))}
            </Text>
            <Text style={{ fontFamily: fontBody(lang), fontSize: 15, color: tok.muted }}>
              {currencyLabel(profile?.currency ?? 'EGP', lang)} {filters.type === 'income' ? (lang === 'ar' ? 'دخل' : 'earned') : (lang === 'ar' ? 'مصروف' : 'spent')}{rangeIsDefault ? (lang === 'ar' ? ' هذا الشهر' : ' this month') : ''} · {txs.length} {t('records')}
            </Text>
          </View>
        </View>
        <RefreshSpinner refreshing={refreshing} />
      </FrostedHeader>

      <View style={{ paddingHorizontal: 16, flex: 1, paddingTop: 12 }}>
        {/* Search + filter */}
        <View style={{
          flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
          gap: 8, marginBottom: 14, alignItems: 'center',
        }}>
          <RField
            value={query}
            onChange={setQuery}
            placeholder={t('search')}
            style={{ flex: 1 }}
          />
          <RPill
            active={hasActiveFilters(filters, rangeIsDefault) || cardFilter !== null}
            onPress={() => setFilterSheetOpen(true)}
            icon={<SlidersHorizontal size={16} color={hasActiveFilters(filters, rangeIsDefault) || cardFilter !== null ? tok.void : tok.muted} />}
            style={{ width: 56, height: 56, minHeight: 56, paddingVertical: 0, paddingHorizontal: 0, gap: 0, justifyContent: 'center' }}
          >
            {''}
          </RPill>
        </View>

        {/* Project filter row - only rendered when the active workspace has
            projects (an org ledger). Single-select: "All", "No project"
            (untagged), then one chip per active project. */}
        {projects.length > 0 ? (
          <RHScroll style={{ marginBottom: 8 }}>
            <RPill active={projectFilter === null} onPress={() => setProjectFilter(null)}>
              {lang === 'ar' ? 'كل المشاريع' : 'All projects'}
            </RPill>
            <RPill active={projectFilter === 'none'} onPress={() => setProjectFilter('none')}>
              {lang === 'ar' ? 'بدون مشروع' : 'No project'}
            </RPill>
            {projects.map((p) => (
              <RPill
                key={p._id}
                active={projectFilter === p._id}
                onPress={() => setProjectFilter(p._id)}
              >
                {p.name}
              </RPill>
            ))}
          </RHScroll>
        ) : null}

        {/* One-tap category filters from this month's biggest spending; account and type live in the filter button. */}
        {lens.length > 0 ? (
          <RHScroll style={{ marginBottom: 10 }}>
            <RPill active={filters.categoryIds.length === 0} onPress={() => setFilters((f) => ({ ...f, categoryIds: [] }))}>{t('all')}</RPill>
            {lens.map((c) => (
              <RPill key={c.id} active={filters.categoryIds.length === 1 && filters.categoryIds[0] === c.id}
                onPress={() => setFilters((f) => ({ ...f, categoryIds: f.categoryIds[0] === c.id && f.categoryIds.length === 1 ? [] : [c.id] }))}>
                {c.name} {c.pct}%
              </RPill>
            ))}
          </RHScroll>
        ) : null}

        {/* Other active filters, each dismissible (the category chips above show the category choice). */}
        {(filters.type !== 'all' || cardFilter !== null || summarizeFilters(filters, categories, lang, rangeIsDefault).some((c) => !c.key.startsWith('cat-'))) ? (
          <RHScroll style={{ marginBottom: 12 }}>
            {filters.type !== 'all' ? (
              <RChip label={filters.type === 'expense' ? t('expense') : t('earned')} onRemove={() => setFilters((f) => ({ ...f, type: 'all' }))} />
            ) : null}
            {cardFilter !== null ? (
              <RChip label={cardFilter === 'none' ? (lang === 'ar' ? 'بدون حساب' : 'No account') : (cards.find((c) => c.id === cardFilter)?.name ?? '')} onRemove={() => setCardFilter(null)} />
            ) : null}
            {summarizeFilters(filters, categories, lang, rangeIsDefault).filter((c) => !c.key.startsWith('cat-')).map((chip) => (
              <RChip key={chip.key} label={chip.label} onRemove={() => setFilters(chip.remove)} />
            ))}
          </RHScroll>
        ) : null}

        {loading ? (
          <RCard padding={18}>
            {Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}
          </RCard>
        ) : txs.length === 0 ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
            <Text style={{
              color: tok.bone, fontFamily: fontBody(lang, 'medium'), fontSize: 17,
              textAlign: 'center', lineHeight: 27,
            }}>{t('noRecords')}</Text>
            <Text style={{
              marginTop: 8, color: tok.muted, fontFamily: fontBody(lang), fontSize: 14,
              textAlign: 'center',
            }}>{t('noRecordsSub')}</Text>
          </View>
        ) : (
          <ScreenFlatList
            data={groups}
            keyExtractor={(g) => g.day}
            showsVerticalScrollIndicator={false}
            // Bottom padding pads the END of scrollable content (clearing the
            // FAB + tab bar): safe-area inset plus tab-bar + FAB clearance.
            contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => fetchTxs('refresh')}
                tintColor={tok.gold}
                colors={[tok.gold]}
                progressBackgroundColor={tok.surface}
              />
            }
            renderItem={({ item: { day, list, dayTotal } }) => (
              <View style={{ marginBottom: 14 }}>
                <View style={{
                  flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
                  justifyContent: 'space-between', alignItems: 'baseline',
                  paddingHorizontal: 4, paddingBottom: 8,
                }}>
                  <REyebrow>{day}</REyebrow>
                  <RAmount value={dayTotal} size={14} weight="regular" currency={list[0]?.currency ?? 'EGP'} sign decimals={0} />
                </View>
                <RCard padding={0} style={{ paddingHorizontal: 18 }}>
                  {list.map((tx, i) => (
                    <RTxRow
                      key={tx._id}
                      tx={tx}
                      last={i === list.length - 1}
                      onLongPress={() => onRowAction(tx)}
                    />
                  ))}
                </RCard>
              </View>
            )}
          />
        )}
      </View>

      <EditTransactionSheet
        visible={!!editing}
        editing={editing}
        categories={categories}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); bumpVersion(); }}
      />

      <TxFiltersSheet
        visible={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        initial={filters}
        categories={categories}
        onApply={(next) => setFilters(next)}
        cards={cards.map((c) => ({ id: c.id, name: c.name }))}
        cardFilter={cardFilter}
        onCardFilter={setCardFilter}
      />
    </ScreenScaffold>
  );
}

/** Returns true when any filter beyond the default type=all is in effect. */
function hasActiveFilters(f: TxFilters, rangeIsDefault = false): boolean {
  return f.type !== 'all'
    || f.categoryIds.length > 0
    || f.sources.length > 0
    || (!rangeIsDefault && (!!f.from || !!f.to))
    || typeof f.minAmount === 'number'
    || typeof f.maxAmount === 'number';
}

/**
 * Turn the filter shape into a flat list of dismissible chips. Type isn't
 * included here - it has its own RPill row above.
 */
function summarizeFilters(
  f: TxFilters,
  categories: { _id: string; nameEn: string; nameAr?: string; emoji?: string }[],
  lang: 'en' | 'ar',
  rangeIsDefault = false,
): Array<{ key: string; label: string; remove: (cur: TxFilters) => TxFilters }> {
  const chips: Array<{ key: string; label: string; remove: (cur: TxFilters) => TxFilters }> = [];

  if ((f.from || f.to) && !rangeIsDefault) {
    // Mirror the range arrow for Arabic (RTL) so it points start->end visually.
    const arrow = lang === 'ar' ? '←' : '→';
    const label = `${f.from ?? '…'} ${arrow} ${f.to ?? '…'}`;
    chips.push({
      key: 'date',
      label,
      remove: (cur) => ({ ...cur, from: undefined, to: undefined }),
    });
  }
  for (const id of f.categoryIds) {
    const cat = categories.find((c) => c._id === id);
    const name = cat ? ((lang === 'ar' && cat.nameAr) ? cat.nameAr : cat.nameEn) : '?';
    chips.push({
      key: `cat-${id}`,
      label: name,
      remove: (cur) => ({ ...cur, categoryIds: cur.categoryIds.filter((x) => x !== id) }),
    });
  }
  const sourceLabel: Record<string, string> = lang === 'ar'
    ? { manual: 'يدوي', seshat: 'سيشات', voice: 'صوت', bot: 'تيليجرام', notification: 'إشعار', 'receipt-ocr': 'إيصال' }
    : { manual: 'manual', seshat: 'seshat', voice: 'voice', bot: 'telegram', notification: 'notification', 'receipt-ocr': 'receipt' };
  for (const s of f.sources) {
    chips.push({
      key: `src-${s}`,
      label: sourceLabel[s] ?? s,
      remove: (cur) => ({ ...cur, sources: cur.sources.filter((x) => x !== s) }),
    });
  }
  if (typeof f.minAmount === 'number' || typeof f.maxAmount === 'number') {
    const label = `${f.minAmount ?? '…'} – ${f.maxAmount ?? '…'}`;
    chips.push({
      key: 'amount',
      label,
      remove: (cur) => ({ ...cur, minAmount: undefined, maxAmount: undefined }),
    });
  }
  return chips;
}
