import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useI18n } from '../lib/i18n';

/**
 * The identity of Seshat AI (Ledger, Hours, the bot): the Seven Stars S, simplified for small sizes (a thicker line and
 * bigger stars than the logo, which is too fine under about 40pt). Filled is Seshat, who does things; hollow is Maat, who
 * only reads. While the AI is working, `thinking` dims the line and lights the seven stars one after another.
 */
const LINE = 'M619 282 L442 251 L380 420 L512 512 L644 604 L582 773 L405 742';
// The seven stars in drawing order along the S: x, y, radius (logo radii, scaled up for the simplified mark).
const STARS: Array<[number, number, number]> = [[619, 282, 26], [442, 251, 32], [380, 420, 29], [512, 512, 38], [644, 604, 29], [582, 773, 32], [405, 742, 26]];
const K = 1.45;

export type AIPersona = 'seshat' | 'maat';

export function AIMark({ size = 24, persona = 'seshat', thinking = false, color }: { size?: number; persona?: AIPersona; thinking?: boolean; color?: string }) {
  const { tok } = useI18n();
  const ink = color ?? tok.gold;
  const [lit, setLit] = useState(-1);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!thinking) { setLit(-1); return; }
    setLit(0);
    timer.current = setInterval(() => setLit((l) => (l >= STARS.length + 1 ? 0 : l + 1)), 170);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [thinking]);
  const hollow = persona === 'maat';
  return (
    <Svg width={size * 0.613} height={size} viewBox="320 200 380 620" style={{ overflow: 'visible' }}>
      <Path d={LINE} fill="none" stroke={ink} strokeWidth={hollow ? 28 : 46} strokeLinejoin="round" strokeLinecap="round" opacity={thinking ? 0.45 : 1} />
      {STARS.map(([x, y, r], i) => hollow
        ? <Circle key={i} cx={x} cy={y} r={r * K * 0.78} fill="none" stroke={ink} strokeWidth={Math.max(14, r * K * 0.42)} opacity={thinking && i > lit ? 0.3 : 1} />
        : <Circle key={i} cx={x} cy={y} r={r * K} fill={ink} opacity={thinking && i > lit ? 0.28 : 1} />)}
    </Svg>
  );
}

/** The mark on a round gold disc (Android tab button, chat avatar). Maat's disc is dark with a gold hollow S. */
export function AIAvatar({ size = 40, persona = 'seshat', thinking = false }: { size?: number; persona?: AIPersona; thinking?: boolean }) {
  const { tok } = useI18n();
  const maat = persona === 'maat';
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center',
      backgroundColor: maat ? tok.elevated : tok.gold, borderWidth: maat ? 1 : 0, borderColor: tok.borderHi,
    }}>
      <AIMark size={size * 0.54} persona={persona} thinking={thinking} color={maat ? tok.gold : tok.void} />
    </View>
  );
}

/** The mark in the shape of a lucide icon component, for places that take one (typed loosely on purpose). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const SeshatIcon: any = function SeshatIcon({ size = 18, color }: { size?: number | string; color?: string }) {
  return <AIMark size={typeof size === 'number' ? size : Number(size) || 18} color={color} />;
};
