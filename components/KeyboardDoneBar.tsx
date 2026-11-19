import { InputAccessoryView, Keyboard, Platform, Pressable, Text, View } from 'react-native';
import { useI18n } from '../lib/i18n';
import { fontBody } from '../lib/fonts';

import { DONE_BAR_ID } from '../lib/doneBar';

/** Number pads have no Return key on iPhone, so a field using one had no way to close its keyboard. */

/** Mounted once at the root. Any numeric field (see lib/fontCap) shows it above the keyboard. iOS only. */
export function KeyboardDoneBar() {
  const { tok, lang } = useI18n();
  if (Platform.OS !== 'ios') return null;
  return (
    <InputAccessoryView nativeID={DONE_BAR_ID}>
      <View style={{
        flexDirection: lang === 'ar' ? 'row' : 'row-reverse', alignItems: 'center', paddingHorizontal: 8, height: 48,
        backgroundColor: tok.surface, borderTopWidth: 1, borderTopColor: tok.border,
      }}>
        <Pressable onPress={() => Keyboard.dismiss()} accessibilityRole="button" hitSlop={8} style={{ minHeight: 44, paddingHorizontal: 16, justifyContent: 'center' }}>
          <Text style={{ fontFamily: fontBody(lang, 'semibold'), fontSize: 17, color: tok.gold }}>{lang === 'ar' ? 'تم' : 'Done'}</Text>
        </Pressable>
      </View>
    </InputAccessoryView>
  );
}
