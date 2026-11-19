import { useBannerSlot } from '../lib/bannerSlot';
import { View, Text, Pressable, Linking } from 'react-native';
import { Download, X } from 'lucide-react-native';
import { useI18n } from '../lib/i18n';
import { fontBody } from '../lib/fonts';
import { RCard } from './ui';
import { useAndroidUpdate } from '../lib/androidUpdate';

// Android only: a newer APK has been uploaded. Tap to download and install it.
export function UpdateBanner() {
  const { tok, lang } = useI18n();
  const { update, dismiss } = useAndroidUpdate();
  const active = useBannerSlot('update', 60, !!update);
  if (!update || !active) return null;
  const ar = lang === 'ar';
  const notes = ar ? (update.notesAr || update.notes) : update.notes;

  return (
    <Pressable
      onPress={() => { void Linking.openURL(update.url); }}
      style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
    >
      <RCard accent padding={10} style={{ marginHorizontal: 16, marginTop: 4, marginBottom: 8 }}>
        <View style={{ flexDirection: ar ? 'row-reverse' : 'row', alignItems: 'center', gap: 10 }}>
          <View style={{
            width: 30, height: 30, borderRadius: 9, backgroundColor: tok.elevated,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Download size={16} color={tok.gold} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{
              color: tok.bone, fontFamily: fontBody(lang, 'semibold'), fontSize: 14,
              textAlign: ar ? 'right' : 'left',
            }}>
              {ar ? 'يوجد إصدار جديد من سيشات' : 'Get the latest version of Seshat'}
            </Text>
            <Text numberOfLines={2} style={{
              marginTop: 2, color: tok.muted, fontFamily: fontBody(lang), fontSize: 12.5, lineHeight: 17,
              textAlign: ar ? 'right' : 'left',
            }}>
              {notes || (ar ? `الإصدار ${update.versionName} جاهز. اضغط للتحميل والتثبيت.` : `Version ${update.versionName} is ready. Tap to download and install.`)}
            </Text>
          </View>
          <Pressable onPress={dismiss} hitSlop={10} accessibilityLabel={ar ? 'إغلاق' : 'Dismiss'}>
            <X size={15} color={tok.muted} />
          </Pressable>
        </View>
      </RCard>
    </Pressable>
  );
}
