import { createElement } from 'react';
import { Platform } from 'react-native';
import { DONE_BAR_ID } from './doneBar';

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

const NUMERIC = new Set(['number-pad', 'decimal-pad', 'numeric', 'phone-pad']);

/**
 * TextInput gets the same font cap plus two defaults that keep a keyboard from trapping people: a single-line field's
 * Return key reads "Done" and closes it, and a numeric keyboard (no Return key on iPhone) gets a Done bar above it.
 * A field that sets its own returnKeyType / inputAccessoryViewID keeps it.
 */
function capInput(Orig: React.ComponentType<never>): React.ComponentType<Record<string, unknown>> {
  const CappedInput = (props: Record<string, unknown>) => {
    const defaults: Record<string, unknown> = { maxFontSizeMultiplier: MAX_FONT_SCALE };
    if (!props.multiline) defaults.returnKeyType = 'done';
    if (Platform.OS === 'ios' && NUMERIC.has(String(props.keyboardType))) defaults.inputAccessoryViewID = DONE_BAR_ID;
    return createElement(Orig as never, { ...defaults, ...props } as never);
  };
  CappedInput.displayName = 'Capped(TextInput)';
  return CappedInput as unknown as React.ComponentType<Record<string, unknown>>;
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
  const CappedInput = capInput(input as never);
}
