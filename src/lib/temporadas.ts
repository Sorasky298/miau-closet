import type { Temporada } from '../db'

export const TEMPORADAS: Temporada[] = ['Primavera', 'Verano', 'Otoño', 'Invierno']

export const ICONO_TEMPORADA: Record<Temporada, string> = {
  Primavera: '🌸',
  Verano: '☀️',
  Otoño: '🍂',
  Invierno: '❄️',
}

const NORTE: Temporada[] = ['Invierno', 'Invierno', 'Primavera', 'Primavera', 'Primavera', 'Verano', 'Verano', 'Verano', 'Otoño', 'Otoño', 'Otoño', 'Invierno']
const OPUESTA: Record<Temporada, Temporada> = { Invierno: 'Verano', Verano: 'Invierno', Primavera: 'Otoño', Otoño: 'Primavera' }

export function temporadaActual(hemisferio: 'Norte' | 'Sur', fecha = new Date()): Temporada {
  const t = NORTE[fecha.getMonth()]
  return hemisferio === 'Norte' ? t : OPUESTA[t]
}

export function siguienteTemporada(t: Temporada): Temporada {
  return TEMPORADAS[(TEMPORADAS.indexOf(t) + 1) % 4]
}

export function mesesDe(t: Temporada, hemisferio: 'Norte' | 'Sur'): string {
  const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  const idx = meses.map((_, i) => i).filter((i) => temporadaActual(hemisferio, new Date(2026, i, 15)) === t)
  if (t === (hemisferio === 'Norte' ? 'Invierno' : 'Verano')) return 'Dic – Feb'
  return `${meses[idx[0]]} – ${meses[idx[idx.length - 1]]}`
}
