import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { X } from 'lucide-react-native';
import { useI18n } from '../lib/i18n';
import { fontBody, fontMono } from '../lib/fonts';
import { clearHomeChat, sendHome, useHomeChat } from '../lib/homeChat';
import { ChatBubble, TypingDots } from './ChatBubble';
import { Rise } from './Motion';
import { pressFeel } from './press';

/** Seshat's answers to what you said from Home, shown on Home: your words, the reply with its cards, quick replies, and a way into the full chat. */
export function HomeReplies() {
  const { tok, lang } = useI18n();
  const router = useRouter();
  const { turns, sessionId, sending } = useHomeChat();
  const ar = lang === 'ar';
  if (turns.length === 0) return null;
  const last = turns[turns.length - 1];
  const open = (p: string) => router.push(p as never);
  const chip = { minHeight: 44, paddingHorizontal: 18, borderRadius: 999, justifyContent: 'center' as const, backgroundColor: tok.surface, borderWidth: 1, borderColor: tok.borderHi };
  return (
    <Rise>
      <View style={{ marginHorizontal: 16, marginTop: 6, marginBottom: 10, padding: 14, borderRadius: 22, borderWidth: 1, borderColor: tok.glowShellBorder, backgroundColor: tok.glowShellBg, gap: 12 }}>
        <View style={{ flexDirection: ar ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontFamily: fontMono('medium'), fontSize: 12, letterSpacing: ar ? 0 : 1.4, color: tok.gold, textTransform: ar ? 'none' : 'uppercase' }}>
            {ar ? 'سيشات' : 'Seshat'}
          </Text>
          <Pressable onPress={clearHomeChat} hitSlop={12} accessibilityRole="button" accessibilityLabel={ar ? 'إخفاء' : 'Dismiss'} style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
            <X size={18} color={tok.muted} />
          </Pressable>
        </View>
        {turns.map((t) => (
          <View key={t.id} style={{ gap: 8 }}>
            <View style={{ alignSelf: ar ? 'flex-start' : 'flex-end', maxWidth: '85%', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, backgroundColor: tok.gold }}>
              <Text style={{ fontFamily: fontBody(lang), fontSize: 15, color: '#14110A', textAlign: ar ? 'right' : 'left' }}>{t.text}</Text>
            </View>
            {t.reply
              ? <ChatBubble message={t.reply} onSkipTyping={() => {}} />
              : t.failed
                ? <Text style={{ fontFamily: fontBody(lang), fontSize: 15, color: tok.alertText, textAlign: ar ? 'right' : 'left' }}>
                  {ar ? 'تعذّر الحصول على رد. حاول مرة أخرى.' : "I couldn't get an answer. Please try again."}
                </Text>
                : <TypingDots />}
          </View>
        ))}
        {!sending && last.failed ? (
          <View style={{ flexDirection: ar ? 'row-reverse' : 'row' }}>
            <Pressable onPress={() => sendHome(last.text, open)} accessibilityRole="button" style={({ pressed }) => ({ ...chip, ...pressFeel(pressed) })}>
              <Text style={{ fontFamily: fontBody(lang, 'semibold'), fontSize: 15, color: tok.bone }}>{ar ? 'حاول مرة أخرى' : 'Try again'}</Text>
            </Pressable>
          </View>
        ) : null}
        {!sending && last.reply?.quickReplies?.length ? (
          <View style={{ flexDirection: ar ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 8 }}>
            {last.reply.quickReplies.map((c, i) => (
              <Pressable key={c} onPress={() => sendHome(c, open)} accessibilityRole="button"
                style={({ pressed }) => ({ ...chip, ...(i === 0 ? { backgroundColor: tok.gold, borderColor: tok.gold } : null), ...pressFeel(pressed) })}>
                <Text style={{ fontFamily: fontBody(lang, 'semibold'), fontSize: 15, color: i === 0 ? '#14110A' : tok.bone }}>{c}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {sessionId ? (
          <Pressable onPress={() => router.push({ pathname: '/seshat/[id]', params: { id: sessionId } } as never)} accessibilityRole="button" hitSlop={8}
            style={{ alignSelf: ar ? 'flex-start' : 'flex-end', minHeight: 36, justifyContent: 'center' }}>
            <Text style={{ fontFamily: fontBody(lang, 'semibold'), fontSize: 14, color: tok.gold }}>{ar ? 'تابع في المحادثة ←' : 'Continue in chat →'}</Text>
          </Pressable>
        ) : null}
      </View>
    </Rise>
  );
}
