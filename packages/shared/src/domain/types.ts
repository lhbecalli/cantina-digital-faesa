export type CategoryId = 'lanches' | 'salgados' | 'sucos' | 'bebidas' | 'doces'
export type Tag = 'sem-acucar' | 'vegetariano'
export type OrderStatus = 'aguardando' | 'preparo' | 'pronto' | 'retirado'
export type OrderVia = 'app' | 'ia' | 'sim'

export interface MenuItem {
  id: string
  name: string
  cat: CategoryId
  price: number
  desc: string
  tags: Tag[]
  available: boolean
}

export interface OrderItem { id: string; name: string; price: number; qty: number }

export interface Order {
  id: string // uuid, único entre as duas SPAs
  number: number // sequencial, atribuído pela API (única autoridade)
  customer: string
  items: OrderItem[]
  total: number
  status: OrderStatus
  history: Partial<Record<OrderStatus, number>>
  createdAt: number
  via: OrderVia
  clientRequestId?: string
}

export interface AppNotification { id: string; to: string; number: number; at: number; title: string; text: string }
export interface AutomationLog { id: string; at: number; workflow: string; trigger: string; action: string; detail: string }
export interface Report { id: string; at: number; orders: number; revenue: number; avg: number; top: { name: string; qty: number }[]; trigger: 'manual' | 'cron' }

export interface AppState {
  /** muda a cada início do servidor; permite aceitar um estado "mais antigo" depois de reiniciar */
  epoch: string
  rev: number
  nextNumber: number
  menu: MenuItem[]
  orders: Order[]
  notifications: AppNotification[]
  reports: Report[]
  log: AutomationLog[]
}

export interface OrderLine { id: string; qty: number }
export interface CreateOrderInput { customer?: string; lines: OrderLine[]; via?: OrderVia; clientRequestId?: string }
export interface NewMenuItem { name: string; cat: CategoryId; price: number; desc?: string; tags?: Tag[] }

export class ApiError extends Error {
  code: string
  status: number
  details?: unknown
  constructor(code: string, message: string, status = 400, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.details = details
  }
}

// --- agente (resposta do POST /api/agent/chat) ---
export interface CartLineData { id: string; qty: number }
export interface ToolCall { name: string; args: Record<string, unknown>; result: string }
export interface Combo { ids: string[]; label: string; note: string; price: number }
export type Attachment =
  | { type: 'items'; ids: string[] }
  | { type: 'cart' }
  | { type: 'status'; number: number }
  | { type: 'combos'; combos: Combo[] }
export interface AgentReply { text: string; tools: ToolCall[]; attach: Attachment[]; cart?: { lines: CartLineData[]; viaIA: boolean } }
export interface CartLine { id: string; qty: number; item: MenuItem }
export interface StudentProfile { id: string; name: string }
