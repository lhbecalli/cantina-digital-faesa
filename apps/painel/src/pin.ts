const PIN_KEY = 'faesa.painel.pin'
export const readPin = (): string => { try { return sessionStorage.getItem(PIN_KEY) ?? '' } catch { return '' } }
export const savePin = (p: string): void => { try { if (p) sessionStorage.setItem(PIN_KEY, p); else sessionStorage.removeItem(PIN_KEY) } catch { /* ok */ } }
export function signOut(): void { savePin(''); location.reload() }
