import { useState } from 'react'
import { Coffee, Cookie, GlassWater, Utensils } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { CategoryId, MenuItem } from '../domain/types.ts'
import { PHOTO_IDS } from '../domain/photos.ts'

export const CATEGORY_ICON: Record<CategoryId, LucideIcon> = { lanches: Utensils, salgados: Cookie, sucos: GlassWater, bebidas: Coffee, doces: Cookie }
type Size = 'xs' | 'sm' | 'md' | 'lg'
const ICON_SIZE: Record<Size, number> = { xs: 16, sm: 22, md: 22, lg: 32 }

/** Foto do item: quadrada, cover, cantos pequenos, fundo neutro (skeleton) até carregar. Sem foto: ícone da categoria. */
export function Photo({ item, size = 'md' }: { item: Pick<MenuItem, 'id' | 'cat'>; size?: Size }) {
  const [state, setState] = useState<'loading' | 'loaded' | 'error'>('loading')
  const hasPhoto = PHOTO_IDS.has(item.id) && state !== 'error'
  const Icon = CATEGORY_ICON[item.cat] ?? Utensils
  if (!hasPhoto) {
    return <span className={`ph ph-${size} noimg`}><Icon size={ICON_SIZE[size]} aria-hidden="true" /></span>
  }
  return (
    <span className={`ph ph-${size}${state === 'loaded' ? ' loaded' : ''}`}>
      <img src={`${import.meta.env.BASE_URL}img/${item.id}.jpg`} alt="" width={480} height={480} loading="lazy" decoding="async" onLoad={() => setState('loaded')} onError={() => setState('error')} />
    </span>
  )
}
