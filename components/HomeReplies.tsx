import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { X } from 'lucide-react-native';
import { useI18n } from '../lib/i18n';
import { fontBody } from '../lib/fonts';
import { clearHomeChat, sendHome, undoHome, useHomeChat } from '../lib/homeChat';
import { TypingDots } from './ChatBubble';
import { ChatBlocks } from './ChatVisuals';
import { Rise } from './Motion';
import { pressFeel } from './press';

/**
 * The result of what you told Seshat from Home, shown as part of Home, not as a chat: a line saying what you said, then the
 * answer itself (the cards, or a sentence), the buttons that make sense next (Undo, the suggested replies), and a quiet way
 * into the full conversation for anyone who wants one. Only the latest turn is shown; the rest lives in the chat session.
 */
export function HomeReplies() {
  const { tok, lang } = useI18n();
  const router = useRouter();
  const { turns, sessionId, sending } = useHomeChat();
  const ar = lang === 'ar';
  if (turns.length === 0) return null;
  const t = turns[turns.length - 1];
  const align = ar ? 'right' : 'left';
  const open = (p: string) => router.push(p as never);
  const reply = t.reply;
  const created = (reply?.createdTransactionIds?.length ?? 0) > 0;
  const hasTxCard = !!reply?.blocks?.some((b) => b.type === 'transactions');
  const chip = { minHeight: 44, paddingHorizontal: 18, borderRadius: 999, justifyContent: 'center' as const, backgroundColor: tok.surface, borderWidth: 1, borderColor: tok.borderHi };
  const row = ar ? 'row-reverse' : 'row';
  return (
    <Rise>
      <View style={{ marginHorizontal: 20, marginTop: 8, marginBottom: 14, gap: 12 }}>
        <View style={{ flexDirection: row, alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <Text numberOfLines={1} style={{ flex: 1, fontFamily: fontBody(lang), fontSize: 14, color: tok.muted, textAlign: align }}>“{t.text}”</Text>
          <Pressable onPress={clearHomeChat} hitSlop={12} accessibilityRole="button" accessibilityLabel={ar ? 'إخفاء' : 'Dismiss'} style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
            <X size={18} color={tok.muted} />
          </Pressable>
        </View>

        {!reply && !t.failed ? <View style={{ alignItems: ar ? 'flex-end' : 'flex-start' }}><TypingDots /></View> : null}
        {t.failed ? (
          <Text style={{ fontFamily: fontBody(lang), fontSize: 16, lineHeight: 24, color: tok.alertText, textAlign: align }}>
            {ar ? 'تعذّر الحصول على رد.' : "I couldn't get an answer."}
          </Text>
        ) : null}

        {reply?.blocks && reply.blocks.length > 0 ? <ChatBlocks blocks={reply.blocks} /> : null}
        {reply?.content && !(created && hasTxCard) ? (
          <Text style={{ fontFamily: fontBody(lang), fontSize: 17, lineHeight: 26, color: tok.bone, textAlign: align }}>{reply.content}</Text>
        ) : null}

        {!sending ? (
          <View style={{ flexDirection: row, flexWrap: 'wrap', gap: 8 }}>
            {t.failed ? (
              <Pressable onPress={() => sendHome(t.text, open)} accessibilityRole="button" style={({ pressed }) => ({ ...chip, ...pressFeel(pressed) })}>
                <Text style={{ fontFamily: fontBody(lang, 'semibold'), fontSize: 15, color: tok.bone }}>{ar ? 'حاول مرة أخرى' : 'Try again'}</Text>
              </Pressable>
            ) : null}
            {created ? (
              <Pressable onPress={() => undoHome(t.id)} accessibilityRole="button" style={({ pressed }) => ({ ...chip, ...pressFeel(pressed) })}>
                <Text style={{ fontFamily: fontBody(lang, 'semibold'), fontSize: 15, color: tok.bone }}>{ar ? 'تراجع' : 'Undo'}</Text>
              </Pressable>
            ) : null}
            {(reply?.quickReplies ?? []).map((c, i) => (
              <Pressable key={c} onPress={() => sendHome(c, open)} accessibilityRole="button"
                style={({ pressed }) => ({ ...chip, ...(i === 0 ? { backgroundColor: tok.gold, borderColor: tok.gold } : null), ...pressFeel(pressed) })}>
                <Text style={{ fontFamily: fontBody(lang, 'semibold'), fontSize: 15, color: i === 0 ? '#14110A' : tok.bone }}>{c}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {sessionId && reply && !created ? (
          <Pressable onPress={() => router.push({ pathname: '/seshat/[id]', params: { id: sessionId } } as never)} accessibilityRole="button" hitSlop={8}
            style={{ alignSelf: ar ? 'flex-end' : 'flex-start', minHeight: 36, justifyContent: 'center' }}>
            <Text style={{ fontFamily: fontBody(lang, 'semibold'), fontSize: 14, color: tok.gold }}>{ar ? 'تابع الحديث مع سيشات ←' : 'Ask a follow-up in chat →'}</Text>
          </Pressable>
        ) : null}
      </View>
    </Rise>
  );
}
