// The forms a new person asked for in onboarding ("what you already have"). They open one after another:
// the tabs layout takes the next one each time the person is back on a tab, so ticking two or more opens all of them.
let queue: string[] = [];

export function queueOnboardingForms(paths: string[]) { queue = [...paths]; }
export function takeNextOnboardingForm(): string | null { return queue.shift() ?? null; }
