// Tipo de cuerpo calculado por medidas (cm). Sin fotos.

export interface Medidas {
  hombros?: number
  busto?: number
  cintura?: number
  cadera?: number
}

export interface TipoCuerpo {
  nombre: string
  icono: string
  clave: string
  consejo: string
}

const TIPOS: Record<string, TipoCuerpo> = {
  reloj: { clave: 'reloj', nombre: 'Reloj de Arena', icono: '⏳', consejo: 'Marca la cintura: cinturones, cruzados y prendas entalladas.' },
  pera: { clave: 'pera', nombre: 'Triángulo', icono: '🔺', consejo: 'Da volumen arriba: escotes abiertos, hombreras, colores claros arriba.' },
  invertido: { clave: 'invertido', nombre: 'Triángulo Invertido', icono: '🔻', consejo: 'Equilibra abajo: faldas con vuelo, pantalones anchos, cuello en V.' },
  rectangulo: { clave: 'rectangulo', nombre: 'Rectángulo', icono: '▭', consejo: 'Crea curvas: peplum, capas, cinturones y cortes cruzados.' },
  ovalo: { clave: 'ovalo', nombre: 'Óvalo', icono: '⬭', consejo: 'Alarga la silueta: escote en V, capas abiertas, telas con caída.' },
}

export function calcularTipoCuerpo(m: Medidas): TipoCuerpo | null {
  const { busto, cintura, cadera } = m
  const hombros = m.hombros ?? busto
  if (!busto || !cintura || !cadera) return null
  const arriba = Math.max(busto, hombros ?? busto)
  if (cintura >= busto * 0.95 && cintura >= cadera * 0.95) return TIPOS.ovalo
  if (Math.abs(arriba - cadera) / cadera <= 0.05 && cintura <= Math.min(arriba, cadera) * 0.76) return TIPOS.reloj
  if (cadera > arriba * 1.05) return TIPOS.pera
  if (arriba > cadera * 1.05) return TIPOS.invertido
  return TIPOS.rectangulo
}
