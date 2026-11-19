import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, RefreshControl, KeyboardAvoidingView, Platform, Pressable, Keyboard } from 'react-native';
import { ScrollView as ScreenScroll } from '../../components/Scroll';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiFetch, hasToken, isSessionError } from '../../lib/api';
import { useI18n } from '../../lib/i18n';
import { useAppData, useInOrg, useWorkspace } from '../../lib/appData';
import { ChildHome } from '../../components/ChildHome';
import { fontBody } from '../../lib/fonts';
import { RHomeHeader } from '../../components/shell';
import { ScreenAtmosphere } from '../../components/ScreenAtmosphere';
import { DashboardBody, type DashboardData } from '../../components/dashboards';
import { HomeSkeleton } from '../../components/DashboardSkeleton';
import {
  SalaryCheckInSheet, fetchSalaryCheckIn, type CheckInStatus,
} from '../../components/SalaryCheckInBanner';
import { CapturePromptLine } from '../../components/CaptureShortcutBanner';
import { UpdateBanner } from '../../components/UpdateBanner';
import { WidgetsAnnouncement } from '../../components/WidgetsAnnouncement';
import { TodayCard, AccountsOverview, TodayNeeds } from '../../components/HomeMoney';
import { HomeAnswer, HomeInput, HomeIntro } from '../../components/HomeAnswer';
import { HomeReplies } from '../../components/HomeReplies';
import { useHomeChat } from '../../lib/homeChat';
import { useRouter } from 'expo-router';


/** A child in a family workspace gets their own small Home; everyone else the full one. */
export default function HomeScreen() {
  const ws = useWorkspace();
  return ws.isChild ? <ChildHome /> : <FullHome />;
}

function FullHome() {
  const router = useRouter();
  const { tok, lang, t } = useI18n();
  const { profile, dataVersion, refresh, bumpVersion } = useAppData();
  const inOrg = useInOrg();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<DashboardData | null>(null);
  const scrollRef = useRef<{ scrollTo: (o: { y: number; animated?: boolean }) => void } | null>(null);
  const { turns: homeTurns } = useHomeChat();
  // A new question or answer goes to the top, where the thread is drawn.
  useEffect(() => { if (homeTurns.length > 0) scrollRef.current?.scrollTo({ y: 0, animated: true }); }, [homeTurns.length]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // Monthly salary confirmation: server tells us once per month whether the
  // user owes a check-in for the current month. We keep the result here so
  // the banner only renders when it actually applies.
  const [checkIn, setCheckIn] = useState<CheckInStatus>({ needed: false });
  const [checkInOpen, setCheckInOpen] = useState(false);

  // Re-fetch dashboard + profile/categories. Used by both initial load and
  // pull-to-refresh, so the "refreshing" spinner shows in both.
  const fetchDashboard = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    const has = await hasToken();
    if (!has) { router.replace('/'); return; }
    if (mode === 'initial') setLoading(true);
    else setRefreshing(true);
    try {
      const res = await apiFetch<{ data: DashboardData }>('/dashboard');
      setData(res.data);
      setFailed(false);
      if (mode === 'refresh') await refresh(); // also pull /me + /categories
    } catch (err) {
      console.warn('dashboard fetch failed', err);
      // A rejected sign-in is not a connection problem: go to the sign-in screen rather than saying we cannot reach Seshat.
      if (isSessionError(err)) router.replace('/');
      else setFailed(true);
    } finally {
      if (mode === 'initial') setLoading(false);
      else setRefreshing(false);
    }
  }, [router, refresh]);

  // Fetch dashboard on mount and when a tx was added (dataVersion bumps).
  useEffect(() => { fetchDashboard('initial'); }, [dataVersion, fetchDashboard]);

  // Salary check-in state: refreshed whenever the data version bumps (so
  // confirming the check-in itself hides the banner without a re-mount).
  useEffect(() => {
    (async () => setCheckIn(await fetchSalaryCheckIn()))();
  }, [dataVersion]);

  // In Arabic, greet with the user's Arabic name when they've set one; fall
  // back to their display name, then a friendly default.
  const userName =
    (lang === 'ar' ? (profile?.displayNameAr || profile?.displayName) : profile?.displayName)
    || (lang === 'ar' ? 'ليلى' : 'there');
  const currency = profile?.currency ?? 'EGP';
  // On iPhone the tab bar is the system's, floating over the bottom of the screen (about 74pt tall plus its gap, which is
  // 58pt above the home-indicator inset, with room to spare). The typing field has to sit above it, not behind it.
  // While the keyboard is up it covers the tab bar, so the field drops down onto the keyboard's edge.
  const [kbOpen, setKbOpen] = useState(false);
  useEffect(() => {
    const a = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKbOpen(true));
    const b = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKbOpen(false));
    return () => { a.remove(); b.remove(); };
  }, []);
  const inputBottom = Platform.OS === 'ios' && !kbOpen ? insets.bottom + 58 : 10;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: tok.void }}>
      <ScreenAtmosphere />

      {/* Transparent header in normal flow, matching the other screens: the
          dashboard scrolls in its own area below it, so there's no glass band
          and the gold atmosphere shows straight through the top. */}
      <View style={{ flex: 1, paddingTop: insets.top }}>
        <RHomeHeader userName={userName} />

        {(() => {
          // SetupPrompt surfaces any still-missing required data (registry-
          // driven, e.g. month-start). Salary is collected in onboarding and
          // edited in Profile, so the only salary prompt here is the monthly
          // check-in (server-gated; fires once the period rolls over and a
          // salary baseline exists).
          const needs = !inOrg ? (
            <TodayNeeds
              extra={[
                ...(checkIn.needed ? [{
                  id: 'salary',
                  title: lang === 'ar' ? 'هل استلمت راتبك؟' : 'Did you get paid this month?',
                  body: lang === 'ar' ? 'سجّل الراتب وأنهِ الشهر، أو تخطى.' : "Log it to close the month, or skip if you didn't.",
                  onPress: () => setCheckInOpen(true),
                }] : []),
              ]}
            />
          ) : null;
          // Announcements sit at the very top, one at a time (the highest priority shows): a new version, then the bank prompt, then news.
          const notices = (
            <>
              <UpdateBanner />
              {!inOrg ? <CapturePromptLine /> : null}
              <WidgetsAnnouncement />
            </>
          );
          const refreshCtl = (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchDashboard('refresh')}
              tintColor={tok.gold}
              colors={[tok.gold]}
              progressBackgroundColor={tok.surface}
            />
          );
          if (loading) return <HomeSkeleton />;
          if (failed && !data) {
            return (
              <ScreenScroll contentContainerStyle={{ flexGrow: 1 }} refreshControl={refreshCtl}>
                <OfflineCard onRetry={() => fetchDashboard('initial')} />
              </ScreenScroll>
            );
          }
          const isEmpty = !data || (data.current.income.count === 0 && data.current.expense.count === 0);
          return (
            <ScreenScroll
              ref={scrollRef as never}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingTop: 6, paddingBottom: !inOrg ? inputBottom + 56 + 40 : insets.bottom + 100, flexGrow: 1 }}
              refreshControl={refreshCtl}
            >
              {notices}
              {!inOrg ? <HomeReplies /> : null}
              {isEmpty && !inOrg ? (
                <HomeIntro />
              ) : isEmpty ? (
                <View style={{ flex: 1, minHeight: 400 }}><EmptyState /></View>
              ) : inOrg ? (
                <>
                  <TodayCard data={data!} currency={currency} />
                  <AccountsOverview currency={currency} />
                  <DashboardBody data={data!} currency={currency} />
                </>
              ) : (
                <>
                  <HomeAnswer data={data!} currency={currency} after={needs} />
                </>
              )}
            </ScreenScroll>
          );
        })()}
        {/* The typing field stays on top of the tab bar, always visible. */}
        {!inOrg && !(failed && !data) ? (
          <View style={{ position: 'absolute', left: 16, right: 16, bottom: inputBottom }}>
            <HomeInput />
          </View>
        ) : null}
      </View>

      <SalaryCheckInSheet
        visible={checkInOpen}
        onClose={() => setCheckInOpen(false)}
        status={checkIn}
        onDone={() => { bumpVersion(); }}
      />
    </KeyboardAvoidingView>
  );
}

/** The server did not answer: say so plainly instead of a skeleton that never ends or a false "no records". */
function OfflineCard({ onRetry }: { onRetry: () => void }) {
  const { tok, lang } = useI18n();
  const ar = lang === 'ar';
  return (
    <View style={{ flex: 1, minHeight: 400, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
      <Text style={{ color: tok.bone, fontFamily: fontBody(lang, 'medium'), fontSize: 19, textAlign: 'center', lineHeight: 29 }}>
        {ar ? 'تعذّر الوصول إلى سيشات' : "Can't reach Seshat right now"}
      </Text>
      <Text style={{ marginTop: 10, color: tok.muted, fontFamily: fontBody(lang), fontSize: 16, textAlign: 'center', lineHeight: 25 }}>
        {ar ? 'بياناتك بأمان. تحقق من اتصالك ثم حاول مرة أخرى.' : 'Your data is safe. Check your connection and try again.'}
      </Text>
      <Pressable onPress={onRetry} accessibilityRole="button" style={{ marginTop: 22, height: 48, paddingHorizontal: 28, borderRadius: 24, backgroundColor: tok.goldSolid, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: tok.onGold, fontFamily: fontBody(lang, 'medium'), fontSize: 16 }}>{ar ? 'حاول مرة أخرى' : 'Try again'}</Text>
      </Pressable>
    </View>
  );
}

function EmptyState() {
  const { tok, lang, t } = useI18n();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
      <Text style={{
        color: tok.bone, fontFamily: fontBody(lang, 'medium'), fontSize: 19,
        textAlign: 'center', lineHeight: 29,
      }}>{t('noRecords')}</Text>
      <Text style={{
        marginTop: 10, color: tok.muted, fontFamily: fontBody(lang), fontSize: 16,
        textAlign: 'center', lineHeight: 25,
      }}>{t('noRecordsSub')}</Text>
    </View>
  );
}
