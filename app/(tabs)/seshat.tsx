import { useState } from 'react';
import { View, Platform } from 'react-native';
import { ChatThread } from '../../components/ChatThread';
import { ChatHistoryPanel } from '../../components/ChatHistoryPanel';
import type { Persona } from '../../lib/persona';

/**
 * The Seshat conversation: the round button at the end of the tab bar opens it. It is a real conversation (not the Home
 * commands): it starts a new chat, you choose Seshat or Maat for it, and the history button in the header opens the list of
 * past conversations in a panel from the side (button only, no swipe).
 */
export default function SeshatTab() {
  const [sessionId, setSessionId] = useState<string | null>(null); // the conversation the history opened (null = a new one)
  const [activeId, setActiveId] = useState<string | null>(null); // whatever is on screen now, for the panel's highlight
  const [persona, setPersona] = useState<Persona>('seshat');
  const [nonce, setNonce] = useState(0); // a new value remounts the thread: a different conversation, or a fresh one
  const [panel, setPanel] = useState(false);
  const openNew = (p: Persona) => { setSessionId(null); setActiveId(null); setPersona(p); setNonce((n) => n + 1); };
  const openSession = (id: string) => { setSessionId(id); setActiveId(id); setNonce((n) => n + 1); };
  return (
    <View style={{ flex: 1 }}>
      <ChatThread
        key={`${sessionId ?? 'new'}-${nonce}`}
        sessionId={sessionId ?? 'new'}
        persona={sessionId ? undefined : persona}
        leading="history"
        onHistory={() => setPanel(true)}
        onBack={() => setPanel(true)}
        // iPhone's tab bar floats over the screen and the inset already includes it: only a small gap above it.
        bottomInset={Platform.OS === 'ios' ? 10 : 0}
        onSessionChange={setActiveId}
      />
      <ChatHistoryPanel visible={panel} onClose={() => setPanel(false)} onSelect={openSession} onNew={openNew} activeId={activeId} />
    </View>
  );
}
