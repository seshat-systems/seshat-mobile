import { View, StyleSheet } from 'react-native';
import { ScrollView as ScreenScroll } from './Scroll';
import { useI18n } from '../lib/i18n';
import { Skeleton } from './Skeleton';
import { RCard } from './ui';

/**
 * The Home placeholder, shaped like the real Home answer: the sentence, the month bar, the Left / Today / Payday panel,
 * the two buttons and a needs card. Shown while Home or the plan loads, so nothing jumps when the answer arrives.
 */
export function HomeSkeletonBody() {
  const { tok, lang } = useI18n();
  const ar = lang === 'ar';
  const row = ar ? 'row-reverse' : 'row';
  const edge = ar ? 'flex-end' : 'flex-start';
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 120 }}>
      <View style={{ gap: 10, alignItems: edge }}>
        <Skeleton width="88%" height={26} radius={8} />
        <Skeleton width="58%" height={26} radius={8} />
        <Skeleton width="72%" height={15} radius={6} style={{ marginTop: 4 }} />
      </View>
      <View style={{ marginTop: 22 }}>
        <Skeleton width="100%" height={12} radius={6} />
        <View style={{ flexDirection: row, justifyContent: 'space-between', marginTop: 10 }}>
          <Skeleton width={120} height={10} />
          <Skeleton width={80} height={10} />
        </View>
      </View>
      <View style={{ flexDirection: row, marginTop: 18, borderRadius: 22, borderWidth: 1, borderColor: tok.border, backgroundColor: tok.surface }}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ flex: 1, flexDirection: 'row' }}>
            {i > 0 ? <View style={{ width: 1, backgroundColor: tok.border }} /> : null}
            <View style={{ flex: 1, paddingVertical: 14, paddingHorizontal: 14, alignItems: edge }}>
              <Skeleton width={42} height={9} />
              <Skeleton width="80%" height={24} radius={6} style={{ marginTop: 10 }} />
              <Skeleton width="60%" height={9} style={{ marginTop: 8 }} />
            </View>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: row, gap: 10, marginTop: 18 }}>
        <Skeleton width={136} height={44} radius={22} />
        <Skeleton width={112} height={44} radius={22} />
      </View>
      <RCard padding={16} style={{ marginTop: 22 }}>
        <View style={{ flexDirection: row, alignItems: 'center', gap: 13 }}>
          <Skeleton width={40} height={40} radius={12} />
          <View style={{ flex: 1, gap: 8, alignItems: edge }}>
            <Skeleton width="70%" height={13} />
            <Skeleton width="45%" height={9} />
          </View>
        </View>
      </RCard>
    </View>
  );
}

/** Home's loading screen: the answer placeholder in a scroll view, the typing field stays real (it is pinned by Home). */
export function HomeSkeleton() {
  return (
    <ScreenScroll showsVerticalScrollIndicator={false} scrollEnabled={false}>
      <HomeSkeletonBody />
    </ScreenScroll>
  );
}

// Loading skeleton — real card shells (glass shields) with placeholders for the
// DATA only, so loading looks like the app, not grey blocks. Mirrors the Bento
// layout: glow hero, income/expense tiles, a category card, recent rows.
export function DashboardSkeleton({ topPad = 0 }: { topPad?: number }) {
  const { tok } = useI18n();
  const SkelRow = ({ last }: { last?: boolean }) => (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 14,
      borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, borderBottomColor: tok.border,
    }}>
      <Skeleton width={40} height={40} radius={12} />
      <View style={{ flex: 1, gap: 7 }}>
        <Skeleton width="65%" height={13} />
        <Skeleton width="38%" height={9} />
      </View>
      <Skeleton width={56} height={14} />
    </View>
  );
  return (
    <ScreenScroll showsVerticalScrollIndicator={false}>
      <View style={{ paddingHorizontal: 16, paddingTop: topPad, gap: 12, paddingBottom: 120 }}>
        <RCard large glow>
          <Skeleton width={96} height={10} />
          <Skeleton width="52%" height={38} radius={8} style={{ marginTop: 16 }} />
          <Skeleton width="100%" height={30} radius={6} style={{ marginTop: 22 }} />
          <Skeleton width={130} height={9} style={{ marginTop: 14 }} />
        </RCard>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {[0, 1].map((i) => (
            <RCard key={i} padding={16} style={{ flex: 1 }}>
              <Skeleton width={64} height={9} />
              <Skeleton width="72%" height={22} radius={6} style={{ marginTop: 12 }} />
              <Skeleton width={52} height={9} style={{ marginTop: 14 }} />
            </RCard>
          ))}
        </View>
        <RCard padding={16}>
          <Skeleton width={84} height={9} />
          <Skeleton width="48%" height={20} radius={6} style={{ marginTop: 12 }} />
          <Skeleton width="100%" height={3} radius={2} style={{ marginTop: 16 }} />
        </RCard>
        <RCard style={{ paddingHorizontal: 18, paddingVertical: 4 }}>
          <SkelRow />
          <SkelRow />
          <SkelRow last />
        </RCard>
        {[0, 1].map((i) => (
          <RCard key={i} padding={16}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Skeleton width={84} height={14} />
              <Skeleton width={52} height={11} />
            </View>
            <Skeleton width="100%" height={8} radius={4} style={{ marginTop: 18 }} />
            <Skeleton width="100%" height={8} radius={4} style={{ marginTop: 16 }} />
          </RCard>
        ))}
      </View>
    </ScreenScroll>
  );
}
