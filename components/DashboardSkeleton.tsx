import { View, StyleSheet } from 'react-native';
import { ScrollView as ScreenScroll } from './Scroll';
import { useI18n } from '../lib/i18n';
import { Skeleton } from './Skeleton';
import { RCard } from './ui';

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
      </View>
    </ScreenScroll>
  );
}
