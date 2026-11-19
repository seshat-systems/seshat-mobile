// The forms a new person asked for in onboarding ("what you already have"). They are the last steps of the onboarding:
// app/index.tsx takes the next one each time the person is back on that screen, and enters the app when none are left.
let queue: string[] = [];

export function queueOnboardingForms(paths: string[]) { queue = [...paths]; }
export function takeNextOnboardingForm(): string | null { return queue.shift() ?? null; }
