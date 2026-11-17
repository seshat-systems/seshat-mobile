import { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Mic, ArrowUp } from 'lucide-react-native';
import { useI18n } from '../lib/i18n';
import { fontBody, fontHead } from '../lib/fonts';
import { fmtNum } from '../lib/privacy';
import type { DashboardData } from './dashboards';

/**
 * The top of Home: one plain sentence that answers "how am I doing this month?", two quick follow-ups, and one input
 * for everything else ("45 coffee", "what can I spend today?"). The sentence is worked out from the dashboard numbers
 * on the phone; the input opens the Seshat chat with the typed words, so the AI does the work.
 * The question-asking chips and the input replace the "+" first step: say it, do not navigate to it.
 */
export function HomeAnswer({ data, currency }: { data: DashboardData; currency: string }) {
  const { tok, lang } = useI18n();
  const router = useRouter();
  const ar = lang === 'ar';
  const [text, setText] = useState('');
  const net = data.current.balance;
  const top = [...(data.categoryBreakdown || [])].sort((a, b) => b.total - a.total)[0];
  const topName = top ? (ar && top.nameAr ? top.nameAr : top.nameEn) : '';
  const spend = data.current.expense.total || 0;
  const share = top && spend > 0 ? Math.round((top.total / spend) * 100) : 0;
  const behind = net < 0;
  const amount = `${fmtNum(Math.abs(net))} ${currency}`;

  const headline = ar
    ? (behind ? `أنت متأخر ${amount} هذا الشهر${topName ? `، وأغلبه في ${topName}` : ''}.` : `أنت متقدّم ${amount} هذا الشهر.`)
    : (behind ? `You're ${amount} behind this month${topName ? `, mostly ${topName}` : ''}.` : `You're ${amount} ahead this month.`);
  const detail = topName && share > 0
    ? (ar ? `${topName} تمثّل ${share}% من مصروفاتك.` : `${topName} is ${share}% of what you spent.`)
    : (ar ? 'سجّل أول مصروف وسأحسب لك الباقي.' : 'Log your first spend and I will work out the rest.');

  const ask = (q: string) => router.push({ pathname: '/seshat/[id]', params: { id: 'new', text: q } } as never);
  const submit = () => { const q = text.trim(); if (!q) return; setText(''); ask(q); };
  const chips = ar
    ? [topName ? `ليش صرفت كل هذا على ${topName}؟` : 'كيف حالي هذا الشهر؟', 'كم أقدر أصرف اليوم؟']
    : [topName ? `Why did I spend so much on ${topName}?` : 'How am I doing this month?', 'What can I spend today?'];
  const chipLabels = ar ? ['اشرح لي السبب', 'كم أصرف اليوم؟'] : ['Show me why', 'What can I spend today?'];

  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 6 }}>
      <Text style={{
        fontFamily: fontHead(lang), fontSize: 27, lineHeight: 34, color: behind ? tok.bone : tok.goldLight,
        textAlign: ar ? 'right' : 'left', letterSpacing: -0.3,
      }}>{headline}</Text>
      <Text style={{
        marginTop: 8, fontFamily: fontBody(lang), fontSize: 16, lineHeight: 24, color: tok.muted,
        textAlign: ar ? 'right' : 'left',
      }}>{detail}</Text>

      <View style={{ flexDirection: ar ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 }}>
        {chips.map((q, i) => (
          <Pressable key={i} onPress={() => ask(q)} accessibilityRole="button"
            style={({ pressed }) => ({
              minHeight: 44, paddingHorizontal: 16, borderRadius: 999, justifyContent: 'center',
              backgroundColor: i === 0 ? tok.gold : tok.surface, borderWidth: i === 0 ? 0 : 1, borderColor: tok.borderHi,
              opacity: pressed ? 0.8 : 1,
            })}>
            <Text style={{ fontFamily: fontBody(lang, 'semibold'), fontSize: 15, color: i === 0 ? '#14110A' : tok.bone }}>{chipLabels[i]}</Text>
          </Pressable>
        ))}
      </View>

      <View style={{
        flexDirection: ar ? 'row-reverse' : 'row', alignItems: 'center', gap: 8, marginTop: 18, minHeight: 56,
        borderRadius: 999, backgroundColor: tok.surface, borderWidth: 1, borderColor: tok.borderHi,
        paddingStart: 20, paddingEnd: 6,
      }}>
        <TextInput
          value={text} onChangeText={setText} onSubmitEditing={submit} returnKeyType="send"
          placeholder={ar ? 'قل لسيشات… «٤٥ قهوة»' : 'Tell Seshat… “45 coffee”'} placeholderTextColor={tok.muted}
          style={{ flex: 1, minHeight: 52, color: tok.bone, fontFamily: fontBody(lang), fontSize: 16, textAlign: ar ? 'right' : 'left' }}
        />
        <Pressable onPress={text.trim() ? submit : () => router.push({ pathname: '/seshat/[id]', params: { id: 'new' } } as never)}
          accessibilityRole="button" accessibilityLabel={text.trim() ? 'Send' : 'Talk to Seshat'}
          style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: tok.gold, alignItems: 'center', justifyContent: 'center' }}>
          {text.trim() ? <ArrowUp size={20} color="#14110A" /> : <Mic size={20} color="#14110A" />}
        </Pressable>
      </View>
    </View>
  );
}
