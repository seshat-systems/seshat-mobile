import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Animated, Easing, Alert, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, X, Pin, Plus } from 'lucide-react-native';
import { hasToken } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { fontBody, fontHead, fontMono } from '../lib/fonts';
import { PERSONAS, type Persona } from '../lib/persona';
import { listSessions, renameSession, setSessionPinned, deleteSession, groupSessions, type SessionSummary, type SessionGroupKey } from '../lib/chatSessions';
import { AIAvatar } from './AIMark';
import { pressFeel } from './press';

const GROUP_LABEL: Record<SessionGroupKey, { en: string; ar: string }> = {
  pinned: { en: 'Pinned', ar: 'المثبّتة' }, today: { en: 'Today', ar: 'اليوم' },
  week: { en: 'Previous 7 days', ar: 'آخر ٧ أيام' }, older: { en: 'Older', ar: 'أقدم' },
};

/**
 * Conversation history: a panel that slides in from the side when the history button in the chat header is tapped (a
 * button only, no swipe gesture). New conversation (Seshat or Maat), search, and every past conversation, with pin,
 * rename and delete on a long press. Home commands are not listed here unless they were continued in the chat.
 */
export function ChatHistoryPanel({ visible, onClose, onSelect, onNew, activeId }: {
  visible: boolean; onClose: () => void; onSelect: (id: string) => void; onNew: (p: Persona) => void; activeId: string | null;
}) {
  const { tok, lang } = useI18n();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const ar = lang === 'ar';
  const panelW = Math.min(360, Math.round(width * 0.86));
  const slide = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (visible) setMounted(true);
    Animated.timing(slide, { toValue: visible ? 1 : 0, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true })
      .start(({ finished }) => { if (finished && !visible) setMounted(false); });
  }, [visible, slide]);
  useEffect(() => { const t = setTimeout(() => setQuery(input.trim()), 250); return () => clearTimeout(t); }, [input]);

  const load = useCallback(async () => {
    if (!(await hasToken())) return;
    setLoading(true);
    try { setSessions(await listSessions(undefined, query)); } catch { /* keep the last list */ } finally { setLoading(false); }
  }, [query]);
  useEffect(() => { if (visible) void load(); }, [visible, load]);

  const act = (s: SessionSummary) => {
    Alert.alert(s.title, undefined, [
      { text: s.pinned ? (ar ? 'إلغاء التثبيت' : 'Unpin') : (ar ? 'تثبيت' : 'Pin'), onPress: async () => { await setSessionPinned(s.id, !s.pinned).catch(() => {}); void load(); } },
      { text: ar ? 'إعادة تسمية' : 'Rename', onPress: () => { setRenaming(s.id); setDraft(s.title); } },
      { text: ar ? 'حذف' : 'Delete', style: 'destructive', onPress: () => {
        Alert.alert(ar ? 'حذف المحادثة؟' : 'Delete this conversation?', undefined, [
          { text: ar ? 'إلغاء' : 'Cancel', style: 'cancel' },
          { text: ar ? 'حذف' : 'Delete', style: 'destructive', onPress: async () => { await deleteSession(s.id).catch(() => {}); if (s.id === activeId) onNew('seshat'); void load(); } },
        ]);
      } },
      { text: ar ? 'إلغاء' : 'Cancel', style: 'cancel' },
    ]);
  };
  const submitRename = async () => {
    const id = renaming; const title = draft.trim(); setRenaming(null);
    if (id && title) { await renameSession(id, title).catch(() => {}); void load(); }
  };

  if (!mounted) return null;
  const tx = slide.interpolate({ inputRange: [0, 1], outputRange: [ar ? panelW : -panelW, 0] });
  const groups = groupSessions(sessions);
  const startBtn = (persona: Persona, label: string, sub: string, primary: boolean) => (
    <Pressable onPress={() => { onNew(persona); onClose(); }} accessibilityRole="button"
      style={({ pressed }) => ({
        flexDirection: ar ? 'row-reverse' : 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 18, minHeight: 60,
        backgroundColor: primary ? tok.glowShellBg : tok.surface, borderWidth: 1, borderColor: primary ? tok.glowShellBorder : tok.border, ...pressFeel(pressed),
      })}>
      <AIAvatar size={38} persona={persona} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fontBody(lang, 'semibold'), fontSize: 16, color: tok.bone, textAlign: ar ? 'right' : 'left' }}>{label}</Text>
        <Text style={{ fontFamily: fontBody(lang), fontSize: 13, color: tok.muted, textAlign: ar ? 'right' : 'left' }}>{sub}</Text>
      </View>
      <Plus size={18} color={tok.gold} />
    </Pressable>
  );
  return (
    <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, zIndex: 50, flexDirection: ar ? 'row-reverse' : 'row' }} pointerEvents="box-none">
      <Animated.View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)', opacity: slide }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel={ar ? 'إغلاق' : 'Close'} />
      </Animated.View>
      <Animated.View style={{ width: panelW, backgroundColor: tok.void, borderColor: tok.border, [ar ? 'borderLeftWidth' : 'borderRightWidth']: 1, paddingTop: insets.top + 10, transform: [{ translateX: tx }] }}>
        <View style={{ flexDirection: ar ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 12 }}>
          <Text style={{ fontFamily: fontHead(lang), fontSize: 22, color: tok.bone }}>{ar ? 'المحادثات' : 'Conversations'}</Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel={ar ? 'إغلاق' : 'Close'} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
            <X size={22} color={tok.muted} />
          </Pressable>
        </View>
        <View style={{ paddingHorizontal: 16, gap: 8 }}>
          {startBtn('seshat', ar ? 'محادثة جديدة مع سيشات' : 'New chat with Seshat', ar ? 'تنفّذ لك' : 'Does things for you', true)}
          {startBtn('maat', ar ? 'تحليل جديد مع ماعت' : 'New analysis with Maat', ar ? 'تقرأ فقط ولا تغيّر' : 'Reads only, changes nothing', false)}
        </View>
        <View style={{ margin: 16, marginBottom: 8, flexDirection: ar ? 'row-reverse' : 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingHorizontal: 14, borderRadius: 14, backgroundColor: tok.surface, borderWidth: 1, borderColor: tok.border }}>
          <Search size={17} color={tok.muted} />
          <TextInput value={input} onChangeText={setInput} placeholder={ar ? 'بحث' : 'Search'} placeholderTextColor={tok.muted}
            style={{ flex: 1, minHeight: 42, color: tok.bone, fontFamily: fontBody(lang), fontSize: 15, textAlign: ar ? 'right' : 'left' }} />
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 90 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {loading && sessions.length === 0 ? <Text style={{ color: tok.muted, fontFamily: fontBody(lang), paddingVertical: 20 }}>{ar ? 'جارٍ التحميل…' : 'Loading…'}</Text> : null}
          {!loading && sessions.length === 0 ? (
            <Text style={{ color: tok.muted, fontFamily: fontBody(lang), fontSize: 15, lineHeight: 22, paddingVertical: 20, textAlign: ar ? 'right' : 'left' }}>
              {query ? (ar ? 'لا نتائج.' : 'No matches.') : (ar ? 'لا محادثات بعد. ابدأ واحدة من الأعلى.' : 'No conversations yet. Start one above.')}
            </Text>
          ) : null}
          {groups.map((g) => (
            <View key={g.key} style={{ marginTop: 10 }}>
              <Text style={{ fontFamily: fontMono('medium'), fontSize: 11, letterSpacing: ar ? 0 : 1.2, color: tok.muted, textTransform: ar ? 'none' : 'uppercase', textAlign: ar ? 'right' : 'left', marginBottom: 6 }}>{GROUP_LABEL[g.key][ar ? 'ar' : 'en']}</Text>
              {g.items.map((s) => (
                <Pressable key={s.id} onPress={() => { onSelect(s.id); onClose(); }} onLongPress={() => act(s)} delayLongPress={350} accessibilityRole="button"
                  style={({ pressed }) => ({
                    flexDirection: ar ? 'row-reverse' : 'row', alignItems: 'center', gap: 10, minHeight: 56, paddingVertical: 8, paddingHorizontal: 8, borderRadius: 14,
                    backgroundColor: s.id === activeId ? tok.glowShellBg : 'transparent', ...pressFeel(pressed),
                  })}>
                  <AIAvatar size={30} persona={s.persona === 'maat' ? 'maat' : 'seshat'} />
                  <View style={{ flex: 1 }}>
                    {renaming === s.id ? (
                      <TextInput value={draft} onChangeText={setDraft} onSubmitEditing={submitRename} onBlur={submitRename} autoFocus returnKeyType="done"
                        style={{ color: tok.bone, fontFamily: fontBody(lang, 'medium'), fontSize: 15, padding: 0, textAlign: ar ? 'right' : 'left' }} />
                    ) : (
                      <Text numberOfLines={1} style={{ fontFamily: fontBody(lang, 'medium'), fontSize: 15, color: tok.bone, textAlign: ar ? 'right' : 'left' }}>{s.title}</Text>
                    )}
                    {s.preview ? <Text numberOfLines={1} style={{ fontFamily: fontBody(lang), fontSize: 13, color: tok.muted, textAlign: ar ? 'right' : 'left' }}>{s.preview}</Text>
                      : <Text style={{ fontFamily: fontBody(lang), fontSize: 12, color: tok.muted, textAlign: ar ? 'right' : 'left' }}>{PERSONAS[s.persona === 'maat' ? 'maat' : 'seshat'].name[lang]}</Text>}
                  </View>
                  {s.pinned ? <Pin size={14} color={tok.gold} /> : null}
                </Pressable>
              ))}
            </View>
          ))}
        </ScrollView>
      </Animated.View>
    </View>
  );
}
