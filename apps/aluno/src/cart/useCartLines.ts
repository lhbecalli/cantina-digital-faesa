import { useMemo } from 'react'
import { useMenu } from '@cantina/shared'
import type { CartLine } from '@cantina/shared'
import { useCart } from './cartStore.ts'

/** Linhas do carrinho com os dados atuais do cardápio, mais contagem e total. */
export function useCartLines(): { lines: CartLine[]; count: number; total: number; viaIA: boolean; key: string } {
  const cart = useCart()
  const menu = useMenu()
  return useMemo(() => {
    const lines = cart.lines.flatMap((l) => { const item = menu.find((m) => m.id === l.id); return item ? [{ id: l.id, qty: l.qty, item }] : [] })
    return { lines, count: lines.reduce((a, l) => a + l.qty, 0), total: lines.reduce((a, l) => a + l.qty * l.item.price, 0), viaIA: cart.viaIA, key: cart.key }
  }, [cart, menu])
}
