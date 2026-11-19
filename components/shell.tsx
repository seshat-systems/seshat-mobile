import { SeshatIcon } from './AIMark';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { LiquidBackdrop } from './LiquidBackdrop';
import { cardChipName } from '../lib/cards';
import { isLiquid } from './Glass';
import { View, Text, Pressable, StyleSheet, ViewStyle, Animated, Easing } from 'react-native';
import { FrostedHeader } from './FrostedHeader';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { BarChart3, Bell, Crosshair, LayoutGrid, Mic, Plus, Pencil, Sparkles, Send, Landmark, ScanLine } from 'lucide-react-native';
import { useI18n, formatAmount, currencyLabel, monthYear, greeting } from '../lib/i18n';
import { useNotifications } from '../lib/notifications';
import { fontBody, fontHead, fontMono } from '../lib/fonts';
import { SeshatMark } from './SeshatMark';
import { REyebrow, RAmount } from './ui';
import { useAppData, useInOrg } from '../lib/appData';
import { CategoryIcon, CategoryIconByKey } from './icons';
import { iconKeyForCategory } from '../lib/categoryMap';
import type { CatId } from '../lib/categoryMap';
import { catIdFromName, catLabel } from '../lib/categoryMap';
import { pressFeel, hapticLight } from './press';

// ─────────────────────────────────────────────────────────────
// View switcher — three small icons (Numbers / HUD / Bento)
// ─────────────────────────────────────────────────────────────
export type DashView = 'numbers' | 'hud' | 'bento';

export function RViewSwitcher({ value, onChange }: { value: DashView; onChange: (v: DashView) => void }) {
  const { tok } = useI18n();
  const views: Array<{ id: DashView; Icon: any }> = [
    { id: 'numbers', Icon: BarChart3 },
    { id: 'hud', Icon: Crosshair },
    { id: 'bento', Icon: LayoutGrid },
  ];
  // A compact glass pill — three layout icons sharing one track, the active
  // one lit gold. Replaces the loose naked icons that cluttered the old header.
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 2,
      backgroundColor: tok.shellBg,
      borderWidth: 1, borderColor: tok.shellBorder,
      borderRadius: 999, padding: 3,
    }}>
      {views.map((v) => {
        const a = v.id === value;
        return (
          <Pressable
            key={v.id}
            onPress={() => onChange(v.id)}
            hitSlop={6}
            style={{
              width: 30, height: 28, borderRadius: 999,
              alignItems: 'center', justifyContent: 'center',
              backgroundColor: a ? tok.glowShellBg : 'transparent',
            }}
          >
            <v.Icon size={15} color={a ? tok.goldLight : tok.muted} strokeWidth={a ? 1.9 : 1.5} />
          </Pressable>
        );
      })}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Home header — single compact band: greeting left, view switcher right.
// Workspace context is in the eyebrow. No spinning logo, no extra row.
// ─────────────────────────────────────────────────────────────
export function RHomeHeader({
  userName, title,
}: { userName: string; title?: string; view?: DashView; onViewChange?: (v: DashView) => void; refreshing?: boolean }) {
  const { tok, lang, t } = useI18n();
  const inOrg = useInOrg();
  const { workspaces, activeLedgerId } = useAppData();
  const activeName = workspaces.find((w) => (activeLedgerId ? w.ledgerId === activeLedgerId : w.kind === 'personal'))?.name;
  return (
    <FrostedHeader style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14 }}>
      <View style={{
        flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
        alignItems: 'center', justifyContent: 'space-between', gap: 12,
      }}>
        <View style={{ flexShrink: 1, flex: 1 }}>
          {/* Workspace switching now lives on the swipeable hero card; the
              header is just the greeting + date. */}
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
            style={{
              fontFamily: fontHead(lang),
              fontSize: 24, color: tok.bone,
              letterSpacing: lang === 'ar' ? 0 : -0.5,
              lineHeight: lang === 'ar' ? 34 : 30,
              writingDirection: lang === 'ar' ? 'rtl' : 'ltr',
            }}
          >
            {title ?? greeting(lang, userName)}
          </Text>
          {/* The workspace is switched from Profile; inside an organization or family its name shows here so you always know where you are. */}
          <REyebrow style={{ marginTop: 7, writingDirection: lang === 'ar' ? 'rtl' : 'ltr' }}>
            {inOrg && activeName ? `${activeName} · ${monthYear(lang)}` : monthYear(lang)}
          </REyebrow>
        </View>
        {/* Notifications now live in the tab bar (with the unread badge), so the
            header no longer carries a bell. NotificationBell is still exported
            for any surface that wants an inline entry point. */}
        {/* Workspace / org switcher — tap to switch ledgers. Lives where the
            view switcher used to be; the view now changes by swiping the hero. */}
        <View style={{ flexDirection: lang === 'ar' ? 'row-reverse' : 'row', alignItems: 'center', gap: 10 }}>
          <NotificationBell />
        </View>
      </View>
    </FrostedHeader>
  );
}

// ─────────────────────────────────────────────────────────────
// NotificationBell — header bell with a live unread badge. Taps
// through to the /notifications screen. The badge count is derived
// from useNotifications() so it stays in sync with reads/deletes.
// ─────────────────────────────────────────────────────────────
export function NotificationBell() {
  const { tok, lang } = useI18n();
  const router = useRouter();
  const { unreadCount } = useNotifications();
  const badge = unreadCount > 99 ? '99+' : String(unreadCount);
  return (
    <Pressable
      onPress={() => router.push('/notifications')}
      hitSlop={8}
      accessibilityLabel={
        unreadCount > 0
          ? (lang === 'ar' ? `الإشعارات، ${unreadCount} غير مقروء` : `Notifications, ${unreadCount} unread`)
          : (lang === 'ar' ? 'الإشعارات' : 'Notifications')
      }
      style={({ pressed }) => ({
        width: 44, height: 44, borderRadius: 999,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: pressed ? tok.elevated : tok.shellBg,
        borderWidth: 1, borderColor: tok.shellBorder,
      })}
    >
      <Bell size={20} color={tok.bone} strokeWidth={1.7} />
      {unreadCount > 0 && (
        <View style={{
          position: 'absolute', top: -3,
          ...(lang === 'ar' ? { left: -3 } : { right: -3 }),
          minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 4,
          backgroundColor: tok.gold,
          borderWidth: 1.5, borderColor: tok.void,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Text allowFontScaling={false} style={{
            fontFamily: fontMono('medium'), fontSize: 12, lineHeight: 14,
            color: tok.void, writingDirection: 'ltr',
          }}>{badge}</Text>
        </View>
      )}
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────
// Category chip — icon in a rounded surface tile
// ─────────────────────────────────────────────────────────────
export function RCatChip({
  cat, iconKey, size = 38, dim = false,
}: { cat?: CatId; iconKey?: string; size?: number; dim?: boolean }) {
  const { tok } = useI18n();
  return (
    <View style={{
      width: size, height: size, borderRadius: 10,
      backgroundColor: tok.elevated,
      borderWidth: StyleSheet.hairlineWidth, borderColor: tok.border,
      alignItems: 'center', justifyContent: 'center',
      opacity: dim ? 0.6 : 1,
    }}>
      {iconKey
        ? <CategoryIconByKey iconKey={iconKey} size={size * 0.5} color={tok.bone} />
        : <CategoryIcon cat={cat ?? 'other'} size={size * 0.5} color={tok.bone} />}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Transaction row — used in dashboards and the records list
// ─────────────────────────────────────────────────────────────
export type TxRowData = {
  _id: string;
  type: 'income' | 'expense';
  amount: number;
  currency: string;
  description?: string;
  date: string;
  categoryId?: { _id?: string; nameEn?: string; nameAr?: string; emoji?: string; icon?: string };
  // Origin of the transaction. Renders as a tiny chip on the row when
  // anything other than 'manual'. Lets the user spot AI-created, voice,
  // receipt, or bot-created entries at a glance.
  source?: 'manual' | 'voice' | 'seshat' | 'bot' | 'notification' | 'receipt-ocr';
  /** For a captured bank message: SMS or push notification. */
  captureChannel?: 'sms' | 'push';
  // The card / account used (populated by the API).
  cardId?: { _id?: string; bank?: string | null; last4?: string; label?: string | null; kind?: string } | null;
  // Entered in another currency: the row's amount is already converted; this is what was typed.
  originalAmount?: number;
  originalCurrency?: string;
};

/**
 * Where an entry came from, in words a person uses, with a small icon: typed by hand, Seshat chat, voice, Telegram,
 * a bank SMS or notification, a receipt scan. Every entry carries one, manual included, so nothing is a mystery.
 */
export function sourceInfo(source: TxRowData['source'], channel: TxRowData['captureChannel'], lang: 'en' | 'ar'): { label: string; Icon: typeof Pencil } {
  const ar = lang === 'ar';
  switch (source) {
    case 'seshat': return { label: ar ? 'محادثة سيشات' : 'Seshat chat', Icon: SeshatIcon };
    case 'voice': return { label: ar ? 'بالصوت' : 'Voice', Icon: Mic };
    case 'bot': return { label: ar ? 'تيليجرام' : 'Telegram', Icon: Send };
    case 'notification': return { label: channel === 'push' ? (ar ? 'إشعار البنك' : 'Bank notification') : (ar ? 'رسالة البنك' : 'Bank SMS'), Icon: Landmark };
    case 'receipt-ocr': return { label: ar ? 'مسح إيصال' : 'Receipt scan', Icon: ScanLine };
    default: return { label: ar ? 'أضفته يدوياً' : 'Added by hand', Icon: Pencil };
  }
}

export function RTxRow({
  tx, last, onPress, onLongPress, showDate,
}: {
  tx: TxRowData;
  last?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  /** Show the date as well as the time (lists that are not grouped by day). */
  showDate?: boolean;
}) {
  const { tok, lang } = useI18n();
  const ar = lang === 'ar';
  const iconKey = iconKeyForCategory(tx.categoryId);
  const desc = tx.description || catLabel(tx.categoryId, lang);
  const signed = tx.type === 'income' ? tx.amount : -tx.amount;
  const when = new Date(tx.date);
  const time = when.toLocaleTimeString(ar ? 'ar-EG' : 'en-US', { hour: 'numeric', minute: '2-digit' });
  const timeLabel = showDate ? `${when.toLocaleDateString(ar ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'short' })}, ${time}` : time;
  const src = sourceInfo(tx.source, tx.captureChannel, lang);
  const account = cardChipName(tx.cardId);
  const second = [catLabel(tx.categoryId, lang), account, tx.originalCurrency && tx.originalAmount ? `${tx.originalAmount} ${tx.originalCurrency}` : null].filter(Boolean).join(' · ');
  const align = ar ? 'right' : 'left';

  const content = (
    <View style={{
      flexDirection: ar ? 'row-reverse' : 'row',
      alignItems: 'center', gap: 12, paddingVertical: 14,
      borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
      borderBottomColor: tok.border,
    }}>
      <RCatChip iconKey={iconKey} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ fontFamily: fontBody(lang, 'semibold'), fontSize: 16, color: tok.bone, writingDirection: ar ? 'rtl' : 'ltr', textAlign: align }}>{desc}</Text>
        <Text numberOfLines={1} style={{ marginTop: 2, fontFamily: fontBody(lang), fontSize: 14, color: tok.muted, writingDirection: ar ? 'rtl' : 'ltr', textAlign: align }}>{second}</Text>
        <View style={{ marginTop: 4, flexDirection: ar ? 'row-reverse' : 'row', alignItems: 'center', gap: 5 }}>
          <src.Icon size={13} color={tok.gold} strokeWidth={1.8} />
          <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: fontBody(lang), fontSize: 13, color: tok.muted }}>{src.label} · {timeLabel}</Text>
        </View>
      </View>
      <RAmount value={signed} currency={tx.currency} size={17} sign={signed > 0} decimals={signed % 1 === 0 ? 0 : 2} />
    </View>
  );

  if (!onPress && !onLongPress) return content;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={hapticLight}
      delayLongPress={400}
      style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }, pressFeel(pressed)]}
    >
      {content}
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────
// Floating Add button — gold disc, bottom-corner, always reachable
// ─────────────────────────────────────────────────────────────
/**
 * RFAB - the bottom-right floating add button.
 *
 * Tap (onPress)          -> opens the add-options chooser (manual / receipt)
 * Long-press hold        -> opens Seshat chat AND starts the mic; recording
 *                            runs while finger is down. Releasing the finger
 *                            fires onVoiceRelease with the recorded audio.
 *
 * The long-press path skips the keypad entirely and lets the user just speak
 * to Seshat. Matches the "the game is over" capture promise: the fastest
 * possible path from impulse to logged transaction.
 */
export function RFAB({
  onPress,
  onVoiceStart,
  onVoiceRelease,
  onVoiceCancel,
  bottomOffset = 92,
}: {
  onPress: () => void;
  // Called when the long-press is detected (~280 ms hold). The caller should
  // navigate to the Seshat tab and begin a recording. If absent, long-press
  // falls back to the normal tap.
  onVoiceStart?: () => void;
  // Called when the finger lifts after a long-press recording. The recorder
  // should stop, the audio should be sent to Seshat, and the FAB returns to
  // its idle state.
  onVoiceRelease?: () => void;
  // Called if the press is cancelled (e.g. finger slides off the button)
  // so the caller can abort the recording without sending.
  onVoiceCancel?: () => void;
  bottomOffset?: number;
}) {
  const { tok, lang } = useI18n();
  const side = lang === 'ar' ? { left: 20 } : { right: 20 };

  // recording = true between onLongPress and onPressOut. While recording the
  // FAB doubles in shadow and shows a small pulse ring so the user has a
  // clear visual confirmation the mic is hot.
  const recordingRef = useRef(false);
  // Armed when the finger slides well off the button while recording, so the
  // release cancels instead of sending. (Pressable doesn't emit the raw
  // responder-terminate event, so we track movement via onTouchMove.)
  const cancelArmedRef = useRef(false);
  const [recording, setRecording] = useState(false);

  const handleLongPress = () => {
    if (!onVoiceStart) return;
    recordingRef.current = true;
    cancelArmedRef.current = false;
    setRecording(true);
    onVoiceStart();
  };

  const handlePressOut = () => {
    if (!recordingRef.current) return;
    recordingRef.current = false;
    setRecording(false);
    if (cancelArmedRef.current) onVoiceCancel?.();
    else onVoiceRelease?.();
  };

  return (
    <Pressable
      onPress={() => {
        // Don't fire onPress if the long-press already kicked in.
        if (recordingRef.current) return;
        onPress();
      }}
      onPressIn={() => {
        // Light tick for the short tap only; the long-press voice path has its
        // own medium haptic via handleLongPress / onVoiceStart.
        if (!recordingRef.current) hapticLight();
      }}
      onLongPress={handleLongPress}
      onPressOut={handlePressOut}
      onTouchMove={(e) => {
        if (!recordingRef.current) return;
        const { locationX, locationY } = e.nativeEvent;
        // Finger slid well outside the 56px button -> arm cancel (moving back
        // in disarms it). Release then cancels rather than sending.
        cancelArmedRef.current =
          locationX < -44 || locationX > 100 || locationY < -44 || locationY > 100;
      }}
      delayLongPress={280}
      style={({ pressed }) => ({
        position: 'absolute', bottom: bottomOffset, ...side,
        width: 56, height: 56, borderRadius: 28,
        backgroundColor: recording ? tok.alertText : (isLiquid() ? 'transparent' : tok.gold),
        alignItems: 'center', justifyContent: 'center',
        transform: [{ scale: pressed || recording ? 0.95 : 1 }],
        shadowColor: recording ? tok.alertText : tok.gold,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: recording ? 0.5 : 0.32,
        shadowRadius: recording ? 22 : 16,
        elevation: 8,
        zIndex: 30,
      })}
      accessibilityLabel={recording ? 'Recording, release to send' : 'Add transaction'}
      accessibilityHint={onVoiceStart ? 'Tap to choose, long-press to speak to Seshat' : undefined}
    >
      {!recording && <LiquidBackdrop radius={28} tint={tok.gold} fallback="transparent" />}
      {recording
        ? <Mic size={26} color={tok.void} strokeWidth={2.2} />
        : <Plus size={26} color={tok.void} strokeWidth={2.2} />}
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────
// Recording banner — top-of-screen confirmation while the FAB
// long-press voice capture is hot.
//
// The FAB itself turns red, but the user's finger covers it, so
// there is no visible confirmation the mic is live. This banner
// sits under the status bar with a pulsing red dot, the release
// instruction, and a live waveform so the user can see the clip
// is being captured. It is purely presentational (pointerEvents
// none) — the press lifecycle stays owned by the FAB / layout.
// ─────────────────────────────────────────────────────────────
export function RecordingBanner({ visible }: { visible: boolean }) {
  const { tok, lang } = useI18n();
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const slide = useRef(new Animated.Value(0)).current; // 0 hidden → 1 shown
  const dot = useRef(new Animated.Value(0)).current;

  // Drive the slide-in on show and a slide-out on hide. We keep the node
  // mounted through the exit animation, then unmount once it settles.
  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(slide, {
        toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }).start();
    } else if (mounted) {
      Animated.timing(slide, {
        toValue: 0, duration: 160, easing: Easing.in(Easing.cubic), useNativeDriver: true,
      }).start(({ finished }) => { if (finished) setMounted(false); });
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pulsing red dot loop, only while the banner is on screen.
  useEffect(() => {
    if (!mounted) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(dot, { toValue: 1, duration: 620, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(dot, { toValue: 0, duration: 620, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [mounted]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!mounted) return null;

  const translateY = slide.interpolate({ inputRange: [0, 1], outputRange: [-32, 0] });
  const dotScale = dot.interpolate({ inputRange: [0, 1], outputRange: [1, 1.45] });
  const dotOpacity = dot.interpolate({ inputRange: [0, 1], outputRange: [1, 0.35] });
  const label = lang === 'ar' ? 'جارٍ التسجيل، اترك للإرسال' : 'Recording, release to send';

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute', top: insets.top + 8, left: 0, right: 0,
        alignItems: 'center', zIndex: 50,
        opacity: slide, transform: [{ translateY }],
      }}
    >
      <View style={{
        flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
        alignItems: 'center', gap: 10,
        backgroundColor: tok.alertBg,
        borderWidth: StyleSheet.hairlineWidth, borderColor: tok.alertText,
        paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999,
        shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
      }}>
        <Animated.View style={{
          width: 9, height: 9, borderRadius: 999, backgroundColor: tok.alertText,
          transform: [{ scale: dotScale }], opacity: dotOpacity,
        }} />
        <Text style={{
          fontFamily: fontBody(lang, 'medium'), fontSize: 14, color: tok.bone,
          writingDirection: lang === 'ar' ? 'rtl' : 'ltr',
        }}>{label}</Text>
        <Waveform color={tok.alertText} />
      </View>
    </Animated.View>
  );
}

// Live waveform — five thin bars looping at staggered phases so the strip
// reads as a moving level meter rather than a synced blink.
function Waveform({ color }: { color: string }) {
  const bars = useRef([0, 1, 2, 3, 4].map(() => new Animated.Value(0.4))).current;
  useEffect(() => {
    const loops = bars.map((v, i) => Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 340 + i * 60, delay: i * 70, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(v, { toValue: 0.35, duration: 340 + i * 60, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ])));
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, height: 16 }}>
      {bars.map((v, i) => (
        <Animated.View key={i} style={{
          width: 3, height: 16, borderRadius: 999, backgroundColor: color,
          transform: [{ scaleY: v }],
        }} />
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Section header — eyebrow + optional right action ("See all")
// ─────────────────────────────────────────────────────────────
export function SectionHeader({
  label, action, onActionPress,
}: { label: string; action?: string; onActionPress?: () => void }) {
  const { tok, lang } = useI18n();
  return (
    <View style={{
      flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
      justifyContent: 'space-between', alignItems: 'baseline',
      paddingHorizontal: 4,
    }}>
      <REyebrow>{label}</REyebrow>
      {action && (
        <Pressable onPress={onActionPress} hitSlop={6}>
          <Text style={{
            color: tok.gold, fontFamily: fontMono('regular'), fontSize: 12,
            letterSpacing: 1.4, textTransform: 'uppercase',
          }}>{action} →</Text>
        </Pressable>
      )}
    </View>
  );
}
