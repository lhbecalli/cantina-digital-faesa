import { useState } from 'react'
import { Bell, BellOff, Smartphone } from 'lucide-react'
import { usePush } from './push.ts'

const DISMISS = 'faesa.pushPromptDismissed'
const dismissed = (): boolean => { try { return localStorage.getItem(DISMISS) === '1' } catch { return false } }

/** Aviso discreto (mostrado no ticket, depois do primeiro pedido): "Receber aviso quando ficar pronto". Nunca insiste. */
export function PushPrompt() {
  const { state, enable } = usePush()
  const [hidden, setHidden] = useState(dismissed)
  if (hidden || state !== 'default') return null
  return (
    <div className="push-prompt" role="region" aria-label="Avisos do pedido">
      <Bell size={20} aria-hidden="true" />
      <p>Quer ser avisado no celular quando o pedido ficar pronto?</p>
      <button type="button" className="btn btn-primary btn-sm" onClick={() => void enable()}>Ativar</button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => { try { localStorage.setItem(DISMISS, '1') } catch { /* ok */ } setHidden(true) }}>Agora não</button>
    </div>
  )
}

/** Seção do Perfil com todos os estados do push. */
export function PushSettings() {
  const { state, enable, disable } = usePush()
  const text: Record<string, string> = {
    enabled: 'Ativado neste aparelho. Avisamos quando o pedido ficar pronto, mesmo com a tela bloqueada.',
    default: 'Receba um aviso no celular quando o pedido ficar pronto.',
    denied: 'Bloqueado no navegador. Para ativar, libere as notificações deste site nas configurações do navegador e volte aqui.',
    unsupported: 'Este navegador não suporta avisos push. Você continua vendo o aviso dentro do app.',
    'needs-install': 'No iPhone, instale o app: toque em Compartilhar e em "Adicionar à Tela de Início", abra por lá e ative aqui.',
    insecure: 'Avisos push exigem conexão segura (HTTPS). Neste endereço, o aviso aparece só dentro do app.',
    unavailable: 'O servidor ainda não está configurado para enviar avisos push. O aviso aparece dentro do app.',
    busy: 'Aguarde…',
  }
  return (
    <div className="push-settings">
      <div className="push-row">{state === 'enabled' ? <Bell size={20} aria-hidden="true" /> : state === 'needs-install' ? <Smartphone size={20} aria-hidden="true" /> : <BellOff size={20} aria-hidden="true" />}<p>{text[state]}</p></div>
      {state === 'default' && <button type="button" className="btn btn-primary btn-block" onClick={() => void enable()}>Ativar avisos</button>}
      {state === 'enabled' && <button type="button" className="btn btn-ghost btn-block" onClick={() => void disable()}>Desativar avisos</button>}
    </div>
  )
}
