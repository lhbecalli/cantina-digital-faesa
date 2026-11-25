import { useSyncExternalStore } from 'react'
import type { AgentReply } from '@cantina/shared'

export interface ChatMessage { id: number; role: 'user' | 'bot'; text: string; reply?: AgentReply }
interface ChatState { messages: ChatMessage[]; typing: boolean }

const WELCOME: ChatMessage = { id: 0, role: 'bot', text: 'Olá. Posso mostrar o cardápio, montar seu pedido, ver o status e sugerir combos.' }

/** Conversa em memória (sobrevive à troca de abas do app, não ao recarregar). */
export function createChatStore() {
  let seq = 1
  let state: ChatState = { messages: [WELCOME], typing: false }
  const listeners = new Set<() => void>()
  const set = (s: ChatState) => { state = s; listeners.forEach((l) => l()) }
  return {
    getSnapshot: () => state,
    subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l) } },
    push(m: Omit<ChatMessage, 'id'>) { set({ ...state, messages: [...state.messages, { ...m, id: seq++ }] }) },
    setTyping(typing: boolean) { set({ ...state, typing }) },
    reset() { seq = 1; set({ messages: [WELCOME], typing: false }) },
  }
}
export type ChatStore = ReturnType<typeof createChatStore>
export const chatStore = createChatStore()

export function useChat(store: ChatStore = chatStore): ChatState {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
}
