// Entrar con Google (Google Identity Services) + carpeta oculta de Drive para la configuración.
// Requiere VITE_GOOGLE_CLIENT_ID (OAuth Client ID tipo "Aplicación web" en Google Cloud).
import { leerAjuste, guardarAjuste } from '../db'

export const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
const SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/drive.appdata',
  'https://www.googleapis.com/auth/drive.file',
].join(' ')
const ARCHIVO_CONFIG = 'miau-config.json'

export interface UsuarioGoogle {
  nombre: string
  email: string
  foto?: string
}

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    google?: any
  }
}

let token: { valor: string; vence: number } | null = null
let cargaScript: Promise<void> | null = null

function cargarGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  cargaScript ??= new Promise((ok, mal) => {
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.onload = () => ok()
    s.onerror = () => mal(new Error('No se pudo cargar Google'))
    document.head.appendChild(s)
  })
  return cargaScript
}

export const googleDisponible = () => Boolean(CLIENT_ID)

/** Abre la ventana de Google. `silencioso` intenta renovar sin mostrar selector. */
export async function obtenerToken(silencioso = false): Promise<string> {
  if (token && token.vence > Date.now() + 60_000) return token.valor
  if (!CLIENT_ID) throw new Error('SIN_CLIENT_ID')
  await cargarGis()
  const pista = await leerAjuste<string>('googleEmail', '')
  return new Promise((ok, mal) => {
    const cliente = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      login_hint: pista || undefined,
      callback: (r: any) => {
        if (r.error) return mal(new Error(r.error))
        token = { valor: r.access_token, vence: Date.now() + Number(r.expires_in) * 1000 }
        ok(r.access_token)
      },
      error_callback: (e: any) => mal(new Error(e?.type ?? 'popup_cerrado')),
    })
    cliente.requestAccessToken({ prompt: silencioso ? '' : 'select_account' })
  })
}

async function g(url: string, init: RequestInit = {}) {
  const t = await obtenerToken(true)
  const r = await fetch(url, { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${t}` } })
  if (!r.ok) throw new Error(`Google ${r.status}`)
  return r
}

export async function entrarConGoogle(): Promise<UsuarioGoogle> {
  await obtenerToken(false)
  const info = await (await g('https://www.googleapis.com/oauth2/v3/userinfo')).json()
  const u: UsuarioGoogle = { nombre: info.given_name ?? info.name ?? '', email: info.email, foto: info.picture }
  await guardarAjuste('googleEmail', u.email)
  await guardarAjuste('googleUsuario', u)
  return u
}

export async function salirDeGoogle() {
  if (token && window.google?.accounts?.oauth2) window.google.accounts.oauth2.revoke(token.valor)
  token = null
  await guardarAjuste('googleUsuario', null)
}

/* ---------- Configuración en carpeta oculta de Drive (appDataFolder) ---------- */

export interface ConfigNube {
  llaveIa?: string
  actualizadoEn: string
}

async function idConfig(): Promise<string | null> {
  const q = encodeURIComponent(`name='${ARCHIVO_CONFIG}'`)
  const r = await g(`https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${q}&fields=files(id)`)
  const { files } = await r.json()
  return files?.[0]?.id ?? null
}

export async function leerConfigNube(): Promise<ConfigNube | null> {
  const id = await idConfig()
  if (!id) return null
  const r = await g(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`)
  return r.json()
}

export async function guardarConfigNube(cambios: Partial<ConfigNube>) {
  const actual = (await leerConfigNube()) ?? { actualizadoEn: '' }
  const datos: ConfigNube = { ...actual, ...cambios, actualizadoEn: new Date().toISOString() }
  const id = await idConfig()
  const cuerpo = new Blob([JSON.stringify(datos)], { type: 'application/json' })
  if (id) {
    await g(`https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=media`, { method: 'PATCH', body: cuerpo })
  } else {
    const form = new FormData()
    form.append('metadata', new Blob([JSON.stringify({ name: ARCHIVO_CONFIG, parents: ['appDataFolder'] })], { type: 'application/json' }))
    form.append('file', cuerpo)
    await g('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', { method: 'POST', body: form })
  }
}
