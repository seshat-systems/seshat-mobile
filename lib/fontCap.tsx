import { createElement } from 'react';

/**
 * Very large system text sizes (Android "Display size", iOS Dynamic Type at the biggest steps) can double every line and
 * break layouts. React Native has no app-wide setting for the ceiling, so Text and TextInput are wrapped once, here, with
 * a default `maxFontSizeMultiplier`. Text still grows (up to 1.3 times) for people who need it; a screen that needs more or
 * less can pass its own value. Import this file once, before anything renders.
 */
export const MAX_FONT_SCALE = 1.3;

function cap<P extends object>(Orig: React.ComponentType<P>): React.ComponentType<P> {
  const Capped = (props: P) => createElement(Orig as never, { maxFontSizeMultiplier: MAX_FONT_SCALE, ...props } as never);
  Capped.displayName = `Capped(${(Orig as { displayName?: string }).displayName ?? 'Text'})`;
  return Capped as unknown as React.ComponentType<P>;
}

let done = false;
export function installFontCap() {
  if (done) return;
  done = true;
  // The real module object (an `import * as` copy would not reach the other files).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const rn = require('react-native') as Record<string, unknown>;
  const text = rn.Text;
  const input = rn.TextInput;
  try {
    Object.defineProperty(rn, 'Text', { configurable: true, enumerable: true, get: () => CappedText });
    Object.defineProperty(rn, 'TextInput', { configurable: true, enumerable: true, get: () => CappedInput });
  } catch { /* if the module is frozen the cap is skipped and text simply scales fully */ }
  const CappedText = cap(text as never);
  const CappedInput = cap(input as never);
}
