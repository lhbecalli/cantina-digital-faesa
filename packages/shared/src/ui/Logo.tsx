import { useState } from 'react'

/** Logo oficial (PNG transparente). `plate` desenha a placa branca usada sobre o azul do header. */
export function Logo({ height = 26, plate = false }: { height?: number; plate?: boolean }) {
  const [failed, setFailed] = useState(false)
  const content = failed ? (
    <span className="logo-fallback" style={{ fontSize: height * 0.8 }}>FAESA</span>
  ) : (
    <img className="logo-img" src={`${import.meta.env.BASE_URL}logo-faesa.png`} alt="FAESA" height={height} style={{ height, width: 'auto' }} onError={() => setFailed(true)} />
  )
  return plate ? <span className="logo-plate">{content}</span> : content
}
