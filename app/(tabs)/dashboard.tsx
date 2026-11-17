import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, RefreshControl } from 'react-native';
import { fontBody } from '../../lib/fonts';
import { ScrollView as ScreenScroll } from '../../components/Scroll';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { apiFetch, hasToken } from '../../lib/api';
import { useI18n } from '../../lib/i18n';
import { useAppData, useInOrg } from '../../lib/appData';
import { RHomeHeader } from '../../components/shell';
import { ScreenAtmosphere } from '../../components/ScreenAtmosphere';
import { DashboardBody, type DashboardData } from '../../components/dashboards';
import { DashboardSkeleton } from '../../components/DashboardSkeleton';
import { ManageGrid } from '../../components/ManageGrid';
import { TodayCard, AccountsOverview, DailyBudgetCard, NetWorthCard } from '../../components/HomeMoney';

/**
 * The Dashboard tab: everything that used to sit under the answer on Home, in one place for when you want the detail
 * (today's net, today's budget, what you own, the month, the categories). Home itself is just the answer.
 */
export default function DashboardScreen() {
  const router = useRouter();
  const { tok, lang } = useI18n();
  const { profile, dataVersion, refresh } = useAppData();
  const inOrg = useInOrg();
  const insets = useSafeAreaInsets();
  const [view, setView] = useState<'overview' | 'manage'>('overview');
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (!(await hasToken())) { router.replace('/'); return; }
    if (mode === 'initial') setLoading(true); else setRefreshing(true);
    try {
      const res = await apiFetch<{ data: DashboardData }>('/dashboard');
      setData(res.data);
      if (mode === 'refresh') await refresh();
    } catch (err) {
      console.warn('dashboard fetch failed', err);
    } finally {
      if (mode === 'initial') setLoading(false); else setRefreshing(false);
    }
  }, [router, refresh]);
  useEffect(() => { load('initial'); }, [dataVersion, load]);

  const currency = profile?.currency ?? 'EGP';
  return (
    <View style={{ flex: 1, backgroundColor: tok.void }}>
      <ScreenAtmosphere />
      <View style={{ flex: 1, paddingTop: insets.top }}>
        <RHomeHeader userName="" title={lang === 'ar' ? 'لوحتي' : 'Dashboard'} />
        {/* Overview is the numbers; Manage holds the money tools (budgets, goals, savings, debts ...) as tiles. */}
        {!inOrg ? (
          <View style={{ marginHorizontal: 16, marginTop: 4, marginBottom: 10, flexDirection: lang === 'ar' ? 'row-reverse' : 'row', padding: 4, borderRadius: 999, backgroundColor: tok.surface, borderWidth: 1, borderColor: tok.border }}>
            {(['overview', 'manage'] as const).map((v) => (
              <Pressable key={v} onPress={() => setView(v)} accessibilityRole="button"
                style={{ flex: 1, minHeight: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: view === v ? tok.gold : 'transparent' }}>
                <Text style={{ fontFamily: fontBody(lang, 'semibold'), fontSize: 15, color: view === v ? '#14110A' : tok.muted }}>
                  {v === 'overview' ? (lang === 'ar' ? 'نظرة عامة' : 'Overview') : (lang === 'ar' ? 'إدارة' : 'Manage')}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {view === 'manage' && !inOrg ? (
          <ScreenScroll showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 2, paddingBottom: insets.bottom + 100 }}>
            <ManageGrid />
          </ScreenScroll>
        ) : loading || !data ? <DashboardSkeleton topPad={6} /> : (
          <ScreenScroll
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingTop: 6, paddingBottom: insets.bottom + 100, flexGrow: 1 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load('refresh')} tintColor={tok.gold} colors={[tok.gold]} progressBackgroundColor={tok.surface} />}
          >
            <TodayCard data={data} currency={currency} />
            {!inOrg && <DailyBudgetCard />}
            {inOrg ? <AccountsOverview currency={currency} /> : <NetWorthCard />}
            <DashboardBody data={data} currency={currency} />
          </ScreenScroll>
        )}
      </View>
    </View>
  );
}
