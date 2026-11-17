import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, AccessibilityInfo, Easing, Text, type TextProps, type ViewStyle, type StyleProp } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Check } from 'lucide-react-native';
import { DURATION, EASE } from '../lib/motion';

/**
 * The few motions the app uses, in one place so they all move the same way: things rise and settle in (Rise), bars fill
 * to their value (GrowBar), numbers count up to theirs (CountUp). All are short, play once, and are skipped entirely when
 * the phone's "reduce motion" setting is on.
 */

let reduce = false;
let asked = false;
function ensureReduceMotion() {
  if (asked) return;
  asked = true;
  AccessibilityInfo.isReduceMotionEnabled().then((v) => { reduce = v; }).catch(() => {});
  AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => { reduce = v; });
}
ensureReduceMotion();

const out = Easing.bezier(...EASE.out);

/** Fades in while rising a few points, once, after `delay` ms. */
export function Rise({ children, delay = 0, distance = 14, style, instant = false }: { children: ReactNode; delay?: number; distance?: number; style?: StyleProp<ViewStyle>; instant?: boolean }) {
  const v = useRef(new Animated.Value(reduce || instant ? 1 : 0)).current;
  useEffect(() => {
    if (reduce || instant) { v.setValue(1); return; }
    const a = Animated.timing(v, { toValue: 1, duration: DURATION.base + 80, delay, easing: out, useNativeDriver: true });
    a.start();
    return () => a.stop();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}

/** A progress bar whose fill grows from empty to `fraction` (0..1) the first time it shows, then follows later changes. */
export function GrowBar({
  fraction, color, height = 12, track, delay = 0, rtl = false, tick,
}: {
  fraction: number; color: string; height?: number; track: string; delay?: number; rtl?: boolean;
  /** Where the calendar says you should be (0..1): a thin tick across the bar. */
  tick?: { at: number; color: string };
}) {
  const f = Math.max(0, Math.min(1, fraction || 0));
  const v = useRef(new Animated.Value(reduce ? f : 0)).current;
  useEffect(() => {
    if (reduce) { v.setValue(f); return; }
    const a = Animated.timing(v, { toValue: f, duration: DURATION.slow + 200, delay, easing: out, useNativeDriver: false });
    a.start();
    return () => a.stop();
  }, [f]); // eslint-disable-line react-hooks/exhaustive-deps
  const side = rtl ? 'right' : 'left';
  return (
    <Animated.View style={{ height, borderRadius: height / 2, backgroundColor: track, justifyContent: 'center' }}>
      <Animated.View style={{
        width: v.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
        minWidth: f > 0 ? 3 : 0, height, borderRadius: height / 2, backgroundColor: color, alignSelf: rtl ? 'flex-end' : 'flex-start',
      }} />
      {tick ? (
        <Rise delay={delay + 400} distance={0} style={{ position: 'absolute', top: -(Math.round(height / 3)), [side]: `${Math.round(tick.at * 100)}%`, width: 2, height: height + Math.round((height / 3) * 2), borderRadius: 1, backgroundColor: tick.color }}>
          <Animated.View />
        </Rise>
      ) : null}
    </Animated.View>
  );
}

/** A number that counts up from zero to `value` the first time it shows. `format` turns the running value into text. */
export function CountUp({ value, format, delay = 0, ...text }: { value: number; format: (n: number) => string; delay?: number } & TextProps) {
  const [shown, setShown] = useState(reduce ? value : 0);
  const first = useRef(true);
  const v = useRef(new Animated.Value(reduce ? value : 0)).current;
  useEffect(() => {
    if (reduce) { setShown(value); return; }
    const id = v.addListener(({ value: n }) => setShown(n));
    const a = Animated.timing(v, { toValue: value, duration: first.current ? DURATION.slow + 300 : DURATION.base, delay: first.current ? delay : 0, easing: out, useNativeDriver: false });
    first.current = false;
    a.start(({ finished }) => { if (finished) setShown(value); });
    return () => { a.stop(); v.removeListener(id); };
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  return <Text {...text}>{format(shown)}</Text>;
}

/**
 * A gold check that pops in the middle of the screen, then fades: the moment something was saved. Bump `pop` (any new
 * number) to play it; a success haptic goes with it. Skipped with reduce motion (the haptic still plays).
 */
export function SuccessPop({ pop, color, ink }: { pop: number; color: string; ink: string }) {
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!pop) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    if (reduce) return;
    scale.setValue(0.4); opacity.setValue(1);
    const a = Animated.sequence([
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 160, useNativeDriver: true }),
      Animated.delay(420),
      Animated.timing(opacity, { toValue: 0, duration: DURATION.base, useNativeDriver: true }),
    ]);
    a.start();
    return () => a.stop();
  }, [pop]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!pop) return null;
  return (
    <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center', opacity, zIndex: 300 }}>
      <Animated.View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: color, alignItems: 'center', justifyContent: 'center', transform: [{ scale }] }}>
        <Check size={44} color={ink} strokeWidth={3} />
      </Animated.View>
    </Animated.View>
  );
}
