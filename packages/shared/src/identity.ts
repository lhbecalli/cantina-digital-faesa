import { useSyncExternalStore } from 'react'
import { DEMO_STUDENT_ID } from './domain/constants.ts'

const SID = 'faesa.sid'
const NAME = 'faesa.name'
const listeners = new Set<() => void>()
const memory: Record<string, string> = {}

const get = (k: string): string | null => { try { return localStorage.getItem(k) } catch { return memory[k] ?? null } }
const put = (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { memory[k] = v } }
const uuid = (): string => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : 'a' + Math.random().toString(36).slice(2) + Date.now().toString(36))

/** Id anônimo do aluno, gerado no aparelho. "Meus pedidos", status e notificações seguem este id. */
export function getStudentId(): string {
  let id = get(SID)
  if (!id || !/^[A-Za-z0-9_-]{8,64}$/.test(id)) { id = uuid(); put(SID, id) }
  return id
}
export const getStudentName = (): string => get(NAME) || 'Aluno'

export interface Identity { id: string; name: string }
const read = (): Identity => ({ id: getStudentId(), name: getStudentName() })
let snap = read()

export function setStudentName(name: string): void {
  put(NAME, name.trim().slice(0, 30) || 'Aluno')
  snap = read()
  listeners.forEach((l) => l())
}
/** Troca para a conta de demonstração (pedidos de exemplo do Luiz) e recarrega. */
export function switchToDemoAccount(): void {
  put(SID, DEMO_STUDENT_ID)
  put(NAME, 'Luiz')
  location.reload()
}
export function useStudent(): Identity {
  return useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l) } }, () => snap, () => snap)
}
