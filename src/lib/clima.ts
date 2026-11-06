// Clima y ciudades con Open-Meteo (gratis, sin llave)

export interface Ciudad {
  nombre: string
  pais: string
  lat: number
  lon: number
}

export interface ClimaDia {
  fecha: string
  max: number
  min: number
  codigo: number
  lluvia: number
}

export interface Clima {
  actual: { temp: number; codigo: number }
  dias: ClimaDia[]
}

export async function buscarCiudades(q: string): Promise<Ciudad[]> {
  if (q.trim().length < 2) return []
  const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=es&format=json`)
  const d = await r.json()
  return (d.results ?? []).map((x: { name: string; country?: string; admin1?: string; latitude: number; longitude: number }) => ({
    nombre: x.name + (x.admin1 && x.admin1 !== x.name ? `, ${x.admin1}` : ''),
    pais: x.country ?? '',
    lat: x.latitude,
    lon: x.longitude,
  }))
}

const cache = new Map<string, { t: number; c: Clima }>()

export async function obtenerClima(lat: number, lon: number): Promise<Clima> {
  const k = `${lat.toFixed(2)},${lon.toFixed(2)}`
  const c = cache.get(k)
  if (c && Date.now() - c.t < 30 * 60_000) return c.c
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max` +
    `&timezone=auto&forecast_days=16`
  const d = await (await fetch(url)).json()
  const clima: Clima = {
    actual: { temp: Math.round(d.current.temperature_2m), codigo: d.current.weather_code },
    dias: d.daily.time.map((f: string, i: number) => ({
      fecha: f,
      max: Math.round(d.daily.temperature_2m_max[i]),
      min: Math.round(d.daily.temperature_2m_min[i]),
      codigo: d.daily.weather_code[i],
      lluvia: d.daily.precipitation_probability_max[i] ?? 0,
    })),
  }
  cache.set(k, { t: Date.now(), c: clima })
  return clima
}

export function describirClima(codigo: number): { icono: string; texto: string } {
  if (codigo === 0) return { icono: '☀️', texto: 'Despejado' }
  if (codigo <= 2) return { icono: '🌤️', texto: 'Poco Nublado' }
  if (codigo === 3) return { icono: '☁️', texto: 'Nublado' }
  if (codigo <= 48) return { icono: '🌫️', texto: 'Neblina' }
  if (codigo <= 57) return { icono: '🌦️', texto: 'Llovizna' }
  if (codigo <= 67) return { icono: '🌧️', texto: 'Lluvia' }
  if (codigo <= 77) return { icono: '❄️', texto: 'Nieve' }
  if (codigo <= 82) return { icono: '🌧️', texto: 'Chubascos' }
  if (codigo <= 86) return { icono: '🌨️', texto: 'Nevadas' }
  return { icono: '⛈️', texto: 'Tormenta' }
}

export function resumenClima(c: { max: number; min: number; codigo: number; lluvia?: number }) {
  const d = describirClima(c.codigo)
  return `${d.texto}, entre ${c.min}°C y ${c.max}°C${c.lluvia ? `, ${c.lluvia}% de lluvia` : ''}`
}
