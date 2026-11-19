import { useEffect, useState, type ReactNode } from 'react';
import { Modal, View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../lib/i18n';
import { fontBody, fontHead } from '../lib/fonts';
import { radius } from '../lib/theme';
import { RButton, RField } from './ui';
import { useKeyboardHeight } from './useKeyboardHeight';

/** A bottom sheet that asks for one amount (an approval limit, a member's limit, an allowance), with an optional clear. */
export function NumberSheet({
  visible, title, hint, initial, unit, clearLabel, extra, onSave, onClose,
}: {
  visible: boolean; title: string; hint?: string; initial?: number | null; unit?: string; clearLabel?: string;
  extra?: ReactNode; onSave: (value: number | null) => void | Promise<void>; onClose: () => void;
}) {
  const { tok, lang } = useI18n();
  const ar = lang === 'ar';
  const insets = useSafeAreaInsets();
  // A Modal does not shrink for the keyboard on iPhone, so the sheet lifts itself by the keyboard's height; without this
  // the Save button sat behind the keyboard.
  const kbHeight = useKeyboardHeight();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (visible) setText(initial ? String(initial) : ''); }, [visible, initial]);
  const value = Number(text.replace(/[^\d.]/g, ''));
  const run = async (v: number | null) => { setBusy(true); try { await onSave(v); } finally { setBusy(false); } };
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }} onPress={onClose} />
      <View style={{ backgroundColor: tok.void, borderTopLeftRadius: radius.modal, borderTopRightRadius: radius.modal, padding: 20, paddingBottom: (kbHeight > 0 ? 16 : insets.bottom + 16) + kbHeight, borderTopWidth: 1, borderColor: tok.border, gap: 14 }}>
        <Text style={{ fontFamily: fontHead(lang), fontSize: 20, color: tok.bone, textAlign: ar ? 'right' : 'left' }}>{title}</Text>
        {hint ? <Text style={{ fontFamily: fontBody(lang), fontSize: 14, lineHeight: 21, color: tok.muted, textAlign: ar ? 'right' : 'left' }}>{hint}</Text> : null}
        <RField value={text} onChange={setText} keyboardType="numeric" mono ltr placeholder={unit ? `0 ${unit}` : '0'} autoFocus />
        {extra}
        <RButton full onPress={() => run(value > 0 ? value : null)} loading={busy} disabled={busy || (text.trim() !== '' && !(value >= 0))}>{ar ? 'حفظ' : 'Save'}</RButton>
        {clearLabel && initial ? <RButton full variant="ghost" onPress={() => run(null)} disabled={busy}>{clearLabel}</RButton> : null}
      </View>
    </Modal>
  );
}
