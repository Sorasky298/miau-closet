// Único punto de contacto con la IA.
// Prototipo: llave de cada usuaria (BYOK). Versión pública: reemplazar este archivo por llamadas a un backend propio.
import { GoogleGenAI } from '@google/genai'
import { leerAjuste, guardarAjuste } from '../db'

export const MODELO_TEXTO_DEFECTO = 'gemini-flash-latest'
export const MODELO_IMAGEN_DEFECTO = 'gemini-2.5-flash-image'

let cliente: GoogleGenAI | null = null
let llaveCliente = ''

export async function obtenerLlave(): Promise<string> {
  return leerAjuste<string>('llaveIa', '')
}

export async function guardarLlave(llave: string) {
  await guardarAjuste('llaveIa', llave.trim())
  cliente = null
}

async function ia(): Promise<GoogleGenAI> {
  const llave = await obtenerLlave()
  if (!llave) throw new Error('SIN_LLAVE')
  if (!cliente || llaveCliente !== llave) {
    cliente = new GoogleGenAI({ apiKey: llave })
    llaveCliente = llave
  }
  return cliente
}

export async function modeloTexto() {
  return leerAjuste<string>('modeloTexto', MODELO_TEXTO_DEFECTO)
}

/** Verifica que la llave funcione con una pregunta mínima. */
export async function probarLlave(llave: string): Promise<{ ok: boolean; error?: string }> {
  const limpia = llave.trim()
  if (!/^AIza[\w-]{30,}$/.test(limpia)) {
    return { ok: false, error: 'Eso no parece una llave de Google (empieza con "AIza…").' }
  }
  try {
    const prueba = new GoogleGenAI({ apiKey: limpia })
    const r = await prueba.models.generateContent({
      model: await modeloTexto(),
      contents: 'Responde solo: ok',
    })
    return r.text ? { ok: true } : { ok: false, error: 'La IA no respondió.' }
  } catch (e) {
    return { ok: false, error: traducirError(e) }
  }
}

export function traducirError(e: unknown): string {
  const m = String((e as Error)?.message ?? e)
  if (m.includes('SIN_LLAVE')) return 'Falta conectar tu IA en Ajustes.'
  if (m.includes('API_KEY_INVALID') || m.includes('API key not valid')) return 'La llave no es válida. Cópiala de nuevo.'
  if (m.includes('429') || m.includes('RESOURCE_EXHAUSTED')) return 'Límite de uso alcanzado. Espera un momento.'
  if (m.includes('403') || m.includes('PERMISSION_DENIED')) return 'Google no dio permiso. Revisa la facturación de tu llave.'
  if (m.includes('Failed to fetch') || m.includes('NetworkError')) return 'Sin conexión a internet.'
  return 'Error de la IA: ' + m.slice(0, 140)
}

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Cola simple: una solicitud a la vez, reintentos con espera creciente ante 429/503. */
let cadena: Promise<unknown> = Promise.resolve()
export function enCola<T>(tarea: () => Promise<T>, reintentos = 4): Promise<T> {
  const ejecutar = async (): Promise<T> => {
    let intento = 0
    for (;;) {
      try {
        return await tarea()
      } catch (e) {
        const m = String((e as Error)?.message ?? e)
        const reintentable = /429|503|RESOURCE_EXHAUSTED|UNAVAILABLE|overloaded/i.test(m)
        if (!reintentable || intento >= reintentos) throw e
        await espera(2000 * 2 ** intento + Math.random() * 500)
        intento++
      }
    }
  }
  const p = cadena.then(ejecutar, ejecutar)
  cadena = p.catch(() => undefined)
  return p
}

/** Pregunta con imágenes opcionales y respuesta JSON. */
export async function preguntarJson<T>(opts: {
  instruccion: string
  texto: string
  imagenes?: Blob[]
}): Promise<T> {
  return enCola(async () => {
    const cliente = await ia()
    const partes: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = []
    for (const img of opts.imagenes ?? []) {
      partes.push({ inlineData: { mimeType: img.type || 'image/jpeg', data: await blobABase64(img) } })
    }
    partes.push({ text: opts.texto })
    const r = await cliente.models.generateContent({
      model: await modeloTexto(),
      contents: [{ role: 'user', parts: partes }],
      config: { systemInstruction: opts.instruccion, responseMimeType: 'application/json' },
    })
    return JSON.parse(r.text ?? '{}') as T
  })
}

export async function blobABase64(b: Blob): Promise<string> {
  const buf = new Uint8Array(await b.arrayBuffer())
  let s = ''
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000))
  return btoa(s)
}
