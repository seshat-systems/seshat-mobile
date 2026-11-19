import { useSyncExternalStore } from 'react';
import { apiFetch } from './api';
import { emitDataChanged } from './dataEvents';
import type { Message } from '../components/ChatBubble';
import type { VisualBlock } from '../components/ChatVisuals';

/**
 * What you say to Seshat from Home is answered on Home: your words, Seshat's reply (cards and all) and its quick replies
 * stay in a small thread at the top of the screen. The conversation is a normal chat session on the server, so
 * "Continue in chat" simply opens that session. This module holds the thread; Home draws it (components/HomeReplies).
 */
export type HomeTurn = { id: string; text: string; reply?: Message; failed?: boolean };
type State = { turns: HomeTurn[]; sessionId: string; sending: boolean };

let state: State = { turns: [], sessionId: '', sending: false };
const subs = new Set<() => void>();
const set = (patch: Partial<State>) => { state = { ...state, ...patch }; subs.forEach((f) => f()); };
const patchTurn = (id: string, patch: Partial<HomeTurn>) =>
  set({ turns: state.turns.map((t) => (t.id === id ? { ...t, ...patch } : t)) });

export function useHomeChat(): State {
  return useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => state, () => state);
}

export function clearHomeChat() { set({ turns: [], sessionId: '', sending: false }); }

type ChatReply = {
  reply: string; sessionId: string; createdTransactionIds?: string[]; mutated?: boolean;
  visualBlocks?: VisualBlock[]; quickReplies?: string[]; activity?: Message['activity']; action?: { open?: string };
};

/** Sends one message from Home. `open` is called when Seshat's reply asks the app to open a screen (a setup form). */
export async function sendHome(text: string, open?: (path: string) => void): Promise<void> {
  const q = text.trim();
  if (!q || state.sending) return;
  const id = `h${Date.now()}`;
  // Only the last few turns stay on Home, the rest are in the chat session.
  set({ turns: [...state.turns.slice(-2), { id, text: q }], sending: true });
  try {
    const res = await apiFetch<{ data: ChatReply }>('/chat', {
      method: 'POST',
      body: JSON.stringify({ message: q, sessionId: state.sessionId || undefined, persona: 'seshat' }),
    });
    const d = res.data;
    set({ sessionId: d.sessionId || state.sessionId });
    if (d.mutated || (d.createdTransactionIds?.length ?? 0) > 0) emitDataChanged(); // Home's numbers move with the new record
    patchTurn(id, {
      reply: {
        id: `${id}r`, role: 'assistant', content: d.reply, typing: false,
        createdTransactionIds: d.createdTransactionIds, blocks: d.visualBlocks,
        quickReplies: d.quickReplies?.length ? d.quickReplies : undefined, activity: d.activity,
      } as Message,
    });
    if (d.action?.open && open) setTimeout(() => open(d.action!.open!), 900);
  } catch {
    patchTurn(id, { failed: true });
  } finally {
    set({ sending: false });
  }
}

/** Takes back what a Home turn recorded (the transactions it created), then says so on the turn. */
export async function undoHome(turnId: string): Promise<void> {
  const turn = state.turns.find((t) => t.id === turnId);
  const ids = turn?.reply?.createdTransactionIds ?? [];
  if (!turn || !turn.reply || ids.length === 0) return;
  try {
    await Promise.all(ids.map((tid) => apiFetch(`/transactions/${tid}`, { method: 'DELETE' })));
    emitDataChanged();
    patchTurn(turnId, { reply: { ...turn.reply, content: ids.length > 1 ? 'Removed those entries.' : 'Removed.', createdTransactionIds: undefined, blocks: undefined, quickReplies: undefined } as Message });
  } catch { /* the record stays; the Undo button is still there to try again */ }
}
