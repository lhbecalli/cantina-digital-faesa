import type { AgentReply, AppState, CartLineData, CreateOrderInput, MenuItem, NewMenuItem, Order, OrderStatus, Report, StudentProfile } from '../domain/types.ts'

export type ConnectionStatus = 'loading' | 'online' | 'reconnecting' | 'offline'

export interface PushSub { endpoint: string; keys: { p256dh: string; auth: string } }

/** Comandos do aluno (X-Student-Id) e do painel (X-Admin-Pin) sobre a API FastAPI. */
export interface Commands {
  // aluno
  createOrder(input: CreateOrderInput): Promise<Order>
  rename(name: string): Promise<StudentProfile>
  chat(message: string, cart: CartLineData[], viaIA: boolean): Promise<AgentReply>
  pushConfig(): Promise<{ enabled: boolean; publicKey: string | null }>
  pushSubscribe(sub: PushSub): Promise<void>
  pushUnsubscribe(endpoint: string): Promise<void>
  // painel
  confirmPayment(number: number): Promise<Order>
  updateStatus(number: number, to: OrderStatus): Promise<Order>
  setAvailability(id: string, available: boolean): Promise<MenuItem>
  setPrice(id: string, price: number): Promise<MenuItem>
  addMenuItem(item: NewMenuItem): Promise<MenuItem>
  fireReport(): Promise<Report>
  receiveStudentOrder(): Promise<Order>
  reset(): Promise<void>
}

export interface Transport {
  load(): Promise<AppState>
  /** Abre o canal em tempo real (WebSocket, com polling de reserva). Devolve a função que o fecha. */
  connect(onState: (s: AppState) => void, onStatus: (s: ConnectionStatus) => void): () => void
  commands: (apply: (s: AppState) => void) => Commands
}
