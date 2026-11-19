import { takeNextOnboardingForm } from '../../lib/onboardingForms';
import { trackEvent } from '../../lib/track';
import { useOfflineSync, enqueue, isNetworkError } from '../../lib/offlineQueue';
import { useCallback, useEffect, useState } from 'react';
import { fmtNum } from '../../lib/privacy';
import { View, Text, StyleSheet, Platform, type ColorValue, AppState } from 'react-native';
import { Tabs, useSegments, router } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { Home as HomeIcon, List, Sparkles, User, LayoutDashboard } from 'lucide-react-native';
import { useI18n } from '../../lib/i18n';
import { restoreBubble } from '../../lib/bubble';
import { useAppData, useWorkspace, useInOrg } from '../../lib/appData';
import { apiFetch, newIdempotencyKey } from '../../lib/api';
import { fontMono } from '../../lib/fonts';
import * as Haptics from 'expo-haptics';
import { RFAB, RecordingBanner } from '../../components/shell';
import { SuccessPop } from '../../components/Motion';
import { ReleaseNotesGate } from '../../components/ReleaseNotesGate';
import { TermsGate } from '../../components/TermsGate';
import { AddTransactionSheet, type AddTxPayload, type AddTxPrefill } from '../../components/AddTransactionSheet';
import { AddOptionsSheet } from '../../components/AddOptionsSheet';
import { RToast } from '../../components/ui';
import { Tour, hasTourBeenSeen } from '../../components/Tour';
import { useRecorder } from '../../components/useRecorder';
import { onPendingAdd, takePendingAdd } from '../../lib/pendingAdd';

// On iOS we use Expo Router's NativeTabs: the real UITabBar (Liquid Glass on
// iOS 26+, regular blur on 17/18). On Android we keep the JS Tabs from
// expo-router, since the native variant is iOS-tuned and Android's Material 3
// NavigationBar doesn't gain anything from going native here.

export default function TabsLayout() {
  const { tok, lang, t } = useI18n();
  const { categories, projects, profile, bumpVersion, refresh, unreadMaatTotal } = useAppData();

  useEffect(() => { refresh(); }, [refresh]);
  // Bring the floating chat bubble back if it was on (reboot, or the user cleared it).
  useEffect(() => { restoreBubble(lang).catch(() => {}); }, [lang]);
  const segments = useSegments();
  const currentTab = segments[segments.length - 1];
  const ws = useWorkspace();
  const inOrg = useInOrg(); // an organization's Home already is its dashboard, so it has no Dashboard tab
  // Forms the person asked for in onboarding open one after another: take the next whenever they are back on a tab.
  useEffect(() => {
    if (segments[0] !== '(tabs)') return;
    const next = takeNextOnboardingForm();
    if (!next) return;
    setTimeout(() => router.push(next as never), 600);
  }, [segments.join('/')]); // eslint-disable-line react-hooks/exhaustive-deps
  // A viewer cannot add anything, and neither a viewer nor a child can use the chat (it reads and writes the whole workspace).
  // Home has the "Tell Seshat…" input and Seshat's own tab is the chat, so the + button only stays where there is no input.
  const hideFab = currentTab === 'seshat' || currentTab === 'index' || currentTab === 'dashboard' || currentTab === 'profile' || currentTab === '(tabs)' || !ws.canWrite;
  const hideChat = ws.isViewer || ws.isChild;

  const [sheetOpen, setSheetOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [sheetPrefill, setSheetPrefill] = useState<AddTxPrefill | undefined>(undefined);
  const [toast, setToast] = useState<string | null>(null);
  const [pop, setPop] = useState(0);   // bumped each time something was saved: plays the check
  const [tourOpen, setTourOpen] = useState(false);

  // Widget buttons (seshat://add?mode=...) land here via app/add.tsx.
  useEffect(() => {
    const apply = () => {
      const mode = takePendingAdd();
      if (mode === 'manual') { setSheetPrefill(undefined); setSheetOpen(true); }
      else if (mode === 'receipt') { setSheetPrefill({ autoTriggerScan: true, source: 'receipt-ocr' }); setSheetOpen(true); }
    };
    apply();
    return onPendingAdd(apply);
  }, []);

  // FAB long-press → voice flow: recorder lives at the layout level so the
  // mic stays alive across navigation (the user can hold the FAB, release on
  // the Seshat tab, and we still own the recording instance). useRecorder is
  // careful to clean up on unmount, so worst-case the press is cancelled.
  const fabRecorder = useRecorder();

  // Drives the top-of-screen RecordingBanner. The FAB owns its own red
  // visual, but the finger covers it, so this is the only confirmation the
  // user can actually see while holding to record.
  const [voiceRecording, setVoiceRecording] = useState(false);

  // Haptics are guarded: expo-haptics may not be in an older installed
  // binary, and a missing native module would otherwise throw mid-press.
  const haptic = (fn: () => Promise<unknown>) => {
    try { fn().catch(() => {}); } catch { /* native module absent → no-op */ }
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      const seen = await hasTourBeenSeen();
      if (!alive || seen) return;
      setTimeout(() => alive && setTourOpen(true), 900);
    })();
    return () => { alive = false; };
  }, []);

  // One "app opened" per launch, and another when the app returns after a long time away.
  useEffect(() => {
    trackEvent('app_open');
    let away = 0;
    const sub = AppState.addEventListener('change', (s) => { if (s === 'background') away = Date.now(); else if (s === 'active' && away && Date.now() - away > 30 * 60 * 1000) { away = 0; trackEvent('app_open'); } });
    return () => sub.remove();
  }, []);

  // Entries made without a connection wait on the phone and are sent as soon as it is back.
  useOfflineSync(useCallback(() => bumpVersion(), [bumpVersion]));

  const onSave = async (p: AddTxPayload) => {
    const key = newIdempotencyKey();
    try {
      await apiFetch('/transactions', {
        method: 'POST',
        body: JSON.stringify(p),
        idempotencyKey: key,
      });
      bumpVersion();
      const cat = categories.find((c) => c._id === p.categoryId);
      const catName = lang === 'ar' && cat?.nameAr ? cat.nameAr : (cat?.nameEn ?? '');
      const msg = lang === 'ar'
        ? `تم الحفظ. ${fmtNum(p.amount)} ج.م · ${catName}`
        : `Saved. ${fmtNum(p.amount)} ${p.currency} · ${catName}`;
      setToast(msg);
      setPop((n) => n + 1);
      setSheetOpen(false);
      setTimeout(() => setToast(null), 2800);
    } catch (err) {
      if (isNetworkError(err)) {
        await enqueue(key, p);
        setToast(lang === 'ar' ? 'لا اتصال الآن. حُفظ على هاتفك وسيُرسل تلقائياً.' : 'No connection. Saved on your phone and it will send by itself.');
        setSheetOpen(false);
        setTimeout(() => setToast(null), 3400);
        return;
      }
      console.warn('save tx failed', err);
    }
  };

  // Unread count for the notifications tab badge. The hook polls + refreshes,
  // so the badge stays live as notifications land and get read.

  return (
    <View style={{ flex: 1, backgroundColor: tok.void }}>
      {Platform.OS === 'ios' ? (
        <NativeTabs tintColor={tok.gold} iconColor={tok.muted} badgeBackgroundColor={tok.gold} badgeTextColor={tok.void}>
          <NativeTabs.Trigger name="index">
            <NativeTabs.Trigger.Icon sf="house" />
            <NativeTabs.Trigger.Label>{t('home')}</NativeTabs.Trigger.Label>
          </NativeTabs.Trigger>
          <NativeTabs.Trigger name="dashboard" hidden={inOrg}>
            <NativeTabs.Trigger.Icon sf="square.grid.2x2" />
            <NativeTabs.Trigger.Label>{lang === 'ar' ? 'لوحتي' : 'Dashboard'}</NativeTabs.Trigger.Label>
          </NativeTabs.Trigger>
          <NativeTabs.Trigger name="transactions">
            <NativeTabs.Trigger.Icon sf="list.bullet" />
            <NativeTabs.Trigger.Label>{t('transactions')}</NativeTabs.Trigger.Label>
          </NativeTabs.Trigger>
          {/* Alerts are a bell at the top of Home and Dashboard now; the screen stays reachable, just not as a tab. */}
          <NativeTabs.Trigger name="notifications" hidden />
          <NativeTabs.Trigger name="profile">
            <NativeTabs.Trigger.Icon sf="person.crop.circle" />
            <NativeTabs.Trigger.Label>{t('profile')}</NativeTabs.Trigger.Label>
          </NativeTabs.Trigger>
          {/* Seshat is its own round button at the end of the bar (iOS 26 detaches a "search"-role tab from the pill), like the AI in MoneyLoop. */}
          <NativeTabs.Trigger name="seshat" hidden={hideChat} role="search">
            <NativeTabs.Trigger.Icon sf="sparkles" />
            <NativeTabs.Trigger.Label>{t('maat')}</NativeTabs.Trigger.Label>
            {unreadMaatTotal > 0 ? <NativeTabs.Trigger.Badge>{String(unreadMaatTotal)}</NativeTabs.Trigger.Badge> : null}
          </NativeTabs.Trigger>
        </NativeTabs>
      ) : (
        <Tabs
          screenOptions={{
            headerShown: false,
            // Tabs cross-fade instead of cutting (Android; on iPhone the native tab bar does its own).
            animation: 'fade',
            tabBarStyle: {
              backgroundColor: tok.navBg,
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: tok.border,
              height: 70,
              paddingTop: 8,
              paddingBottom: 8,
            },
            tabBarActiveTintColor: tok.gold,
            tabBarBadgeStyle: { backgroundColor: tok.gold, color: tok.void },
            tabBarInactiveTintColor: tok.muted,
          }}
        >
          <Tabs.Screen
            name="index"
            options={{
              title: t('home'),
              tabBarIcon: ({ color }) => <HomeIcon size={22} color={color} strokeWidth={1.5} />,
              tabBarLabel: ({ focused, color }) => <TabLabel focused={focused} color={color}>{t('home')}</TabLabel>,
            }}
          />
          <Tabs.Screen
            name="dashboard"
            options={{
              href: inOrg ? null : undefined,
              title: lang === 'ar' ? 'لوحتي' : 'Dashboard',
              tabBarIcon: ({ color }) => <LayoutDashboard size={22} color={color} strokeWidth={1.5} />,
              tabBarLabel: ({ focused, color }) => (
                <TabLabel focused={focused} color={color}>{lang === 'ar' ? 'لوحتي' : 'Dashboard'}</TabLabel>
              ),
            }}
          />
          <Tabs.Screen
            name="transactions"
            options={{
              title: t('transactions'),
              tabBarIcon: ({ color }) => <List size={22} color={color} strokeWidth={1.5} />,
              tabBarLabel: ({ focused, color }) => <TabLabel focused={focused} color={color}>{t('transactions')}</TabLabel>,
            }}
          />
          {/* Alerts are a bell at the top of Home and Dashboard now; the screen stays reachable, just not as a tab. */}
          <Tabs.Screen name="notifications" options={{ href: null }} />
          <Tabs.Screen
            name="profile"
            options={{
              title: t('profile'),
              tabBarIcon: ({ color }) => <User size={22} color={color} strokeWidth={1.5} />,
              tabBarLabel: ({ focused, color }) => <TabLabel focused={focused} color={color}>{t('profile')}</TabLabel>,
            }}
          />
          <Tabs.Screen
            name="seshat"
            options={{
              href: hideChat ? null : undefined,
              title: t('maat'),
              // Seshat is the round gold button at the end of the bar (on iPhone the system draws it detached from the pill).
              tabBarIcon: ({ focused }) => (
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: focused ? tok.goldLight : tok.gold, alignItems: 'center', justifyContent: 'center', marginTop: -4 }}>
                  <Sparkles size={22} color={tok.void} strokeWidth={1.75} />
                </View>
              ),
              tabBarLabel: ({ focused, color }) => <TabLabel focused={focused} color={color}>{t('maat')}</TabLabel>,
              tabBarBadge: unreadMaatTotal > 0 ? unreadMaatTotal : undefined,
            }}
          />
        </Tabs>
      )}

      {!hideFab && (
        <RFAB
          onPress={() => { setSheetPrefill(undefined); setSheetOpen(true); }}
          onVoiceStart={async () => {
            // Long-press detected → kick off the mic immediately. We do NOT
            // navigate yet so the user keeps holding on the FAB (sliding the
            // finger off cancels). On iOS the permission prompt fires here
            // the very first time; subsequent presses are silent.
            haptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
            setVoiceRecording(true);
            const ok = await fabRecorder.start();
            // Permission denied / mic failed → pull the banner back down.
            if (!ok) setVoiceRecording(false);
          }}
          onVoiceRelease={async () => {
            // Release → stop, transcribe, navigate to Seshat with the
            // transcript as the initial message. The Seshat screen's
            // initialText effect auto-sends it on mount.
            haptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
            setVoiceRecording(false);
            const audio = await fabRecorder.stop();
            if (!audio) return;
            try {
              const res = await apiFetch<{ data: { transcript: string } }>('/voice/transcribe', {
                method: 'POST',
                // The API reads `audio_base64` (the recorder's field is `base64`); sending the raw object made it answer
                // "audio_base64 is required" every time.
                body: JSON.stringify({ audio_base64: audio.base64, format: audio.format, language: lang }),
              });
              const text = res.data.transcript?.trim();
              if (!text) return;
              router.push({
                pathname: '/seshat/[id]',
                params: { id: 'new', text },
              });
            } catch (err) {
              console.warn('[fab voice] transcribe failed', err);
              // Say what went wrong (too short, service busy...) instead of a generic failure.
              setToast(err instanceof Error && err.message ? err.message : (lang === 'ar' ? 'تعذر الإرسال' : 'Could not send'));
              setTimeout(() => setToast(null), 3600);
            }
          }}
          onVoiceCancel={() => {
            // Finger left the button mid-recording → throw the clip away.
            haptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
            setVoiceRecording(false);
            void fabRecorder.cancel();
          }}
        />
      )}

      <RecordingBanner visible={voiceRecording} />

      <RToast visible={!!toast}>{toast ?? ''}</RToast>
      <SuccessPop pop={pop} color={tok.gold} ink={tok.void} />

      <AddOptionsSheet
        visible={optionsOpen}
        onClose={() => setOptionsOpen(false)}
        onPickManual={() => { setSheetPrefill(undefined); setSheetOpen(true); }}
        onPickReceipt={() => {
          setSheetPrefill({ autoTriggerScan: true, source: 'receipt-ocr' });
          setSheetOpen(true);
        }}
      />

      <AddTransactionSheet
        visible={sheetOpen}
        onClose={() => { setSheetOpen(false); setSheetPrefill(undefined); }}
        onSave={onSave}
        categories={categories}
        projects={ws.kind === 'family' || ws.isChild ? [] : projects}
        expenseOnly={ws.isChild}
        defaultCurrency={profile?.currency ?? 'EGP'}
        prefill={sheetPrefill}
      />

      <Tour visible={tourOpen} onClose={() => setTourOpen(false)} />
      <TermsGate />
      <ReleaseNotesGate />
    </View>
  );
}

function TabLabel({ focused, color, children }: { focused: boolean; color: ColorValue; children: string }) {
  const { lang, tok } = useI18n();
  return (
    <Text
      numberOfLines={1}
      allowFontScaling={false}   // a tab bar keeps its size; only content text grows with the system setting
      style={{
        // Crisp color swap instead of an opacity dim (no flicker on switch).
        color: focused ? tok.gold : color,
        fontFamily: fontMono('regular'),
        fontSize: 12,
        letterSpacing: lang === 'ar' ? 0 : 0.4,
        textTransform: 'none',
        marginTop: 4,
      }}
    >{children}</Text>
  );
}
