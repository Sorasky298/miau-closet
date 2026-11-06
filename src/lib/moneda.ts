// Moneda referencial para mostrar costos aproximados (el cobro real lo hace Google en la moneda de su cuenta).
import { useEffect, useState } from 'react'
import { leerAjuste, guardarAjuste } from '../db'

export type Moneda = 'EUR' | 'PEN' | 'USD'

export const MONEDAS: { codigo: Moneda; simbolo: string; nombre: string; bandera: string }[] = [
  { codigo: 'EUR', simbolo: '€', nombre: 'Euro', bandera: '🇪🇺' },
  { codigo: 'PEN', simbolo: 'S/', nombre: 'Sol', bandera: '🇵🇪' },
  { codigo: 'USD', simbolo: 'US$', nombre: 'Dólar', bandera: '🇺🇸' },
]

// Respaldo si no hay internet (aprox.)
const TASAS_RESPALDO: Record<Moneda, number> = { USD: 1, EUR: 0.87, PEN: 3.4 }

function monedaPorDefecto(): Moneda {
  const zona = Intl.DateTimeFormat().resolvedOptions().timeZone ?? ''
  if (zona === 'America/Lima') return 'PEN'
  if (zona.startsWith('Europe/')) return 'EUR'
  return 'USD'
}

async function tasas(): Promise<Record<Moneda, number>> {
  const hoy = new Date().toISOString().slice(0, 10)
  const cache = await leerAjuste<{ fecha: string; t: Record<Moneda, number> } | null>('tasas', null)
  if (cache?.fecha === hoy) return cache.t
  try {
    const d = await (await fetch('https://open.er-api.com/v6/latest/USD')).json()
    const t = { USD: 1, EUR: Number(d.rates?.EUR) || TASAS_RESPALDO.EUR, PEN: Number(d.rates?.PEN) || TASAS_RESPALDO.PEN }
    await guardarAjuste('tasas', { fecha: hoy, t })
    return t
  } catch {
    return cache?.t ?? TASAS_RESPALDO
  }
}

export async function leerMoneda(): Promise<Moneda> {
  return leerAjuste<Moneda>('moneda', monedaPorDefecto())
}

export async function fijarMoneda(m: Moneda) {
  await guardarAjuste('moneda', m)
  oyentes.forEach((o) => o())
}

const oyentes = new Set<() => void>()

/** Formatea un monto en USD a la moneda elegida: "≈ €0,04". */
export function useMoneda() {
  const [m, setM] = useState<Moneda>(monedaPorDefecto())
  const [t, setT] = useState(TASAS_RESPALDO)
  useEffect(() => {
    const cargar = () => leerMoneda().then(setM)
    cargar()
    tasas().then(setT)
    oyentes.add(cargar)
    return () => void oyentes.delete(cargar)
  }, [])
  const info = MONEDAS.find((x) => x.codigo === m)!
  const formato = (usd: number) => {
    const v = usd * t[m]
    return `${info.simbolo}${v.toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }
  return { moneda: m, formato }
}
