import { pressFeel } from './press';
import { useBannerSlot } from '../lib/bannerSlot';
import { useEffect, useState } from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Zap, X } from 'lucide-react-native';
import { useI18n } from '../lib/i18n';
import { fontBody, fontMono } from '../lib/fonts';
import { RCard } from './ui';
import { useAccountCurrency } from '../lib/captureKeywords';
import { getPermissionStatus } from '../lib/androidNotificationListener';

import { secureGet, secureSet } from '../lib/secure';
// Home-screen prompt to set up automatic bank capture (existing accounts included — the
// onboarding scene only reaches new sign-ups). iPhone: install the bank-SMS Shortcut.
// Android: allow notification access, which nothing else asks for. Gone for good once they
// open the setup guide or dismiss it; on Android also once the access is granted.
const KEY = Platform.OS === 'ios' ? 'capture_shortcut_prompt' : 'capture_android_prompt';

export function CaptureShortcutBanner() {
  const { tok, lang } = useI18n();
  const router = useRouter();
  const currency = useAccountCurrency();
  const [show, setShow] = useState(false);

  useEffect(() => {
    secureGet(KEY)
      .then(async (v) => {
        if (v) return;
        if (Platform.OS === 'ios') { setShow(true); return; }
        const status = await getPermissionStatus();
        if (status !== 'authorized' && status !== 'unavailable') setShow(true);
      })
      .catch(() => {});
  }, []);

  const active = useBannerSlot('capture', 50, show);
  if (!show || !active) return null;
  const close = () => { setShow(false); secureSet(KEY, 'done').catch(() => {}); };
  const ar = lang === 'ar';

  return (
    <Pressable
      onPress={() => { close(); router.push(Platform.OS === 'ios' ? '/capture-setup-ios' : '/capture-setup-android'); }}
      style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
    >
      <RCard accent padding={14} style={{ marginHorizontal: 16, marginTop: 6, marginBottom: 12 }}>
        <View style={{ flexDirection: ar ? 'row-reverse' : 'row', alignItems: 'center', gap: 12 }}>
          <View style={{
            width: 36, height: 36, borderRadius: 10, backgroundColor: tok.elevated,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Zap size={18} color={tok.gold} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{
              color: tok.bone, fontFamily: fontBody(lang, 'semibold'), fontSize: 16,
              textAlign: ar ? 'right' : 'left',
            }}>
              {Platform.OS === 'ios'
                ? (ar ? 'سجّل معاملات البنك تلقائياً' : 'Log bank transactions automatically')
                : (ar ? 'سجّل إشعارات البنوك تلقائياً' : 'Log bank notifications automatically')}
            </Text>
            <Text style={{
              marginTop: 3, color: tok.muted, fontFamily: fontBody(lang), fontSize: 14,
              textAlign: ar ? 'right' : 'left',
            }}>
              {Platform.OS === 'ios'
                ? (ar ? `أتمتة واحدة على "${currency}" تكفي. جهّزها في دقيقة.` : `One automation on "${currency}" does it. Set it up in a minute.`)
                : (ar ? 'اسمح لسيشات بقراءة الإشعارات مرة واحدة، وتسجّل كل تنبيه بنكي.' : 'Allow notification access once and Seshat records every bank alert.')}
            </Text>
          </View>
          <Pressable onPress={close} hitSlop={10} accessibilityLabel={ar ? 'إغلاق' : 'Dismiss'}>
            <X size={16} color={tok.muted} />
          </Pressable>
          <Text style={{ color: tok.gold, fontFamily: fontMono('regular'), fontSize: 16 }}>{ar ? '←' : '→'}</Text>
        </View>
      </RCard>
    </Pressable>
  );
}

const LATER_KEY = 'capture_prompt_later';
const LATER_DAYS = 3;

/**
 * The same prompt as a line from Seshat at the top of Home: "Want me to log your bank alerts automatically?".
 * Yes opens the setup guide (and is never shown again); Later hides it for a few days instead of for good.
 */
export function CapturePromptLine() {
  const { tok, lang } = useI18n();
  const router = useRouter();
  const [show, setShow] = useState(false);
  useEffect(() => {
    (async () => {
      if (await secureGet(KEY)) return;
      const later = Number(await secureGet(LATER_KEY));
      if (later && Date.now() < later) return;
      if (Platform.OS === 'ios') { setShow(true); return; }
      const status = await getPermissionStatus();
      if (status !== 'authorized' && status !== 'unavailable') setShow(true);
    })().catch(() => {});
  }, []);
  const active = useBannerSlot('capture', 50, show);
  if (!show || !active) return null;
  const ar = lang === 'ar';
  const allow = () => { setShow(false); secureSet(KEY, 'done').catch(() => {}); router.push(Platform.OS === 'ios' ? '/capture-setup-ios' : '/capture-setup-android'); };
  const later = () => { setShow(false); secureSet(LATER_KEY, String(Date.now() + LATER_DAYS * 86400000)).catch(() => {}); };
  return (
    <View style={{ marginHorizontal: 20, marginTop: 6, marginBottom: 14, padding: 16, borderRadius: 22, backgroundColor: tok.surface, borderWidth: 1, borderColor: tok.borderHi }}>
      <View style={{ flexDirection: ar ? 'row-reverse' : 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <Zap size={14} color={tok.gold} />
        <Text style={{ fontFamily: fontMono('medium'), fontSize: 12, letterSpacing: ar ? 0 : 1.4, color: tok.gold, textTransform: ar ? 'none' : 'uppercase' }}>
          {ar ? 'سيشات · أمر واحد أولاً' : 'Seshat · one thing first'}
        </Text>
      </View>
      <Text style={{ fontFamily: fontBody(lang, 'medium'), fontSize: 17, lineHeight: 25, color: tok.bone, textAlign: ar ? 'right' : 'left' }}>
        {Platform.OS === 'ios'
          ? (ar ? 'هل أسجّل معاملات بنكك تلقائياً؟' : 'Want me to log your bank transactions automatically?')
          : (ar ? 'هل أسجّل إشعارات بنكك تلقائياً؟' : 'Want me to log your bank alerts automatically?')}
      </Text>
      <View style={{ flexDirection: ar ? 'row-reverse' : 'row', gap: 10, marginTop: 12 }}>
        <Pressable onPress={allow} accessibilityRole="button"
          style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: 18, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: tok.goldSolid, ...pressFeel(pressed) })}>
          <Text style={{ fontFamily: fontBody(lang, 'semibold'), fontSize: 15, color: tok.onGold }}>{ar ? 'نعم، فعّل' : 'Yes, set it up'}</Text>
        </Pressable>
        <Pressable onPress={later} accessibilityRole="button"
          style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: 18, borderRadius: 999, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: tok.borderHi, ...pressFeel(pressed) })}>
          <Text style={{ fontFamily: fontBody(lang, 'semibold'), fontSize: 15, color: tok.bone }}>{ar ? 'لاحقاً' : 'Later'}</Text>
        </Pressable>
      </View>
    </View>
  );
}
