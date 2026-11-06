// Sincronización entre dispositivos vía carpeta oculta de Google Drive + respaldo .zip
import JSZip from 'jszip'
import { db, leerAjuste, guardarAjuste, ahora, type Prenda, type Outfit, type Perfil } from '../db'
import { g } from './google'

type Tabla = 'prendas' | 'outfits' | 'perfil'
interface Borrado {
  id: string
  tabla: Tabla
  fecha: string
}

const CAMPOS_BLOB: Record<Tabla, string[]> = {
  prendas: ['fotoOriginal', 'fotoRecorte', 'fotoCatalogo'],
  outfits: ['imagenProbador'],
  perfil: ['fotoCuerpo'],
}

type Registro = Record<string, unknown> & { id: string; actualizadoEn: string }

interface Manifiesto {
  version: 1
  actualizadoEn: string
  prendas: Registro[]
  outfits: Registro[]
  perfil: Registro[]
  borrados: Borrado[]
  imagenes: Record<string, { id: string; firma: string }>
}

const NOMBRE_MANIFIESTO = 'miau-manifest.json'
const API = 'https://www.googleapis.com/drive/v3/files'
const SUBIR = 'https://www.googleapis.com/upload/drive/v3/files'

/* ---------- Borrados (para que no reaparezcan en otro dispositivo) ---------- */

export async function registrarBorrado(tabla: Tabla, id: string) {
  const l = await leerAjuste<Borrado[]>('borrados', [])
  l.push({ tabla, id, fecha: ahora() })
  await guardarAjuste('borrados', l)
}

/* ---------- Utilidades de registros ---------- */

function separar(tabla: Tabla, r: Registro) {
  const datos: Registro = { ...r }
  const blobs: Record<string, Blob> = {}
  for (const c of CAMPOS_BLOB[tabla]) {
    if (r[c] instanceof Blob) blobs[c] = r[c] as Blob
    delete datos[c]
  }
  return { datos, blobs }
}

const firma = (b: Blob) => `${b.size}-${b.type}`
const clave = (tabla: Tabla, id: string, campo: string) => `${tabla}-${id}-${campo}`

async function todos(): Promise<Record<Tabla, Registro[]>> {
  return {
    prendas: (await db.prendas.toArray()) as unknown as Registro[],
    outfits: (await db.outfits.toArray()) as unknown as Registro[],
    perfil: (await db.perfil.toArray()) as unknown as Registro[],
  }
}

async function poner(tabla: Tabla, r: Registro) {
  if (tabla === 'prendas') await db.prendas.put(r as unknown as Prenda)
  else if (tabla === 'outfits') await db.outfits.put(r as unknown as Outfit)
  else await db.perfil.put(r as unknown as Perfil)
}

async function quitar(tabla: Tabla, id: string) {
  if (tabla === 'prendas') await db.prendas.delete(id)
  else if (tabla === 'outfits') await db.outfits.delete(id)
}

/* ---------- Drive ---------- */

async function buscarManifiesto(): Promise<{ id: string; m: Manifiesto } | null> {
  const q = encodeURIComponent(`name='${NOMBRE_MANIFIESTO}'`)
  const { files } = await (await g(`${API}?spaces=appDataFolder&q=${q}&fields=files(id)`)).json()
  const id = files?.[0]?.id
  if (!id) return null
  return { id, m: await (await g(`${API}/${id}?alt=media`)).json() }
}

async function crearArchivo(nombre: string, cuerpo: Blob): Promise<string> {
  const form = new FormData()
  form.append('metadata', new Blob([JSON.stringify({ name: nombre, parents: ['appDataFolder'] })], { type: 'application/json' }))
  form.append('file', cuerpo)
  const r = await (await g(`${SUBIR}?uploadType=multipart&fields=id`, { method: 'POST', body: form })).json()
  return r.id
}

async function actualizarArchivo(id: string, cuerpo: Blob) {
  await g(`${SUBIR}/${id}?uploadType=media`, { method: 'PATCH', body: cuerpo })
}

const bajar = async (id: string) => (await g(`${API}/${id}?alt=media`)).blob()

/* ---------- Sincronizar ---------- */

export interface ResultadoSync {
  bajadas: number
  subidas: number
}

let enCurso: Promise<ResultadoSync> | null = null

export function sincronizar(alAvanzar?: (texto: string) => void): Promise<ResultadoSync> {
  enCurso ??= ejecutarSync(alAvanzar).finally(() => (enCurso = null))
  return enCurso
}

async function ejecutarSync(avance = (_: string) => {}): Promise<ResultadoSync> {
  avance('Leyendo tu Drive…')
  const remoto = await buscarManifiesto()
  const m: Manifiesto = remoto?.m ?? { version: 1, actualizadoEn: '', prendas: [], outfits: [], perfil: [], borrados: [], imagenes: {} }

  // 1. Borrados de ambos lados
  const borradosLocal = await leerAjuste<Borrado[]>('borrados', [])
  const borrados = [...m.borrados, ...borradosLocal].filter((b, i, l) => l.findIndex((x) => x.id === b.id) === i)
  const borradoIds = new Set(borrados.map((b) => b.id))
  for (const b of borrados) await quitar(b.tabla, b.id)

  // 2. Bajar lo que es más nuevo en la nube
  let bajadas = 0
  const local = await todos()
  for (const tabla of ['prendas', 'outfits', 'perfil'] as Tabla[]) {
    const porId = new Map(local[tabla].map((r) => [r.id, r]))
    for (const rem of m[tabla]) {
      if (borradoIds.has(rem.id)) continue
      const loc = porId.get(rem.id)
      if (loc && loc.actualizadoEn >= rem.actualizadoEn) continue
      const nuevo: Registro = { ...rem }
      for (const campo of CAMPOS_BLOB[tabla]) {
        const img = m.imagenes[clave(tabla, rem.id, campo)]
        const actual = loc?.[campo] as Blob | undefined
        if (img && (!actual || firma(actual) !== img.firma)) nuevo[campo] = await bajar(img.id)
        else if (actual) nuevo[campo] = actual
      }
      await poner(tabla, nuevo)
      bajadas++
      avance(`Bajando… ${bajadas}`)
    }
  }

  // 3. Subir imágenes nuevas o cambiadas
  let subidas = 0
  const final = await todos()
  for (const tabla of ['prendas', 'outfits', 'perfil'] as Tabla[]) {
    for (const r of final[tabla]) {
      const { blobs } = separar(tabla, r)
      for (const [campo, b] of Object.entries(blobs)) {
        const k = clave(tabla, r.id, campo)
        const prev = m.imagenes[k]
        if (prev?.firma === firma(b)) continue
        if (prev) await actualizarArchivo(prev.id, b)
        else m.imagenes[k] = { id: await crearArchivo(`${k}.img`, b), firma: '' }
        m.imagenes[k].firma = firma(b)
        subidas++
        avance(`Subiendo fotos… ${subidas}`)
      }
    }
  }

  // 4. Limpiar imágenes de registros borrados
  for (const k of Object.keys(m.imagenes)) {
    const id = k.split('-').slice(1, -1).join('-')
    if (borradoIds.has(id)) {
      await g(`${API}/${m.imagenes[k].id}`, { method: 'DELETE' }).catch(() => undefined)
      delete m.imagenes[k]
    }
  }

  // 5. Escribir manifiesto
  const hace90 = new Date(Date.now() - 90 * 864e5).toISOString()
  const nuevoM: Manifiesto = {
    version: 1,
    actualizadoEn: ahora(),
    prendas: final.prendas.map((r) => separar('prendas', r).datos),
    outfits: final.outfits.map((r) => separar('outfits', r).datos),
    perfil: final.perfil.map((r) => separar('perfil', r).datos),
    borrados: borrados.filter((b) => b.fecha > hace90),
    imagenes: m.imagenes,
  }
  const cuerpo = new Blob([JSON.stringify(nuevoM)], { type: 'application/json' })
  if (remoto) await actualizarArchivo(remoto.id, cuerpo)
  else await crearArchivo(NOMBRE_MANIFIESTO, cuerpo)

  await guardarAjuste('borrados', [])
  await guardarAjuste('ultimoSync', ahora())
  return { bajadas, subidas }
}

/* ---------- Respaldo .zip (sin Google) ---------- */

export async function exportarRespaldo(): Promise<File> {
  const zip = new JSZip()
  const datos = await todos()
  const json: Record<string, Registro[]> = {}
  for (const tabla of ['prendas', 'outfits', 'perfil'] as Tabla[]) {
    json[tabla] = []
    for (const r of datos[tabla]) {
      const { datos: d, blobs } = separar(tabla, r)
      json[tabla].push(d)
      for (const [campo, b] of Object.entries(blobs)) zip.file(`fotos/${clave(tabla, r.id, campo)}`, b)
    }
  }
  zip.file('datos.json', JSON.stringify({ version: 1, fecha: ahora(), ...json }))
  const blob = await zip.generateAsync({ type: 'blob' })
  return new File([blob], `miau-closet-${ahora().slice(0, 10)}.zip`, { type: 'application/zip' })
}

export async function importarRespaldo(archivo: Blob): Promise<number> {
  const zip = await JSZip.loadAsync(archivo)
  const d = JSON.parse(await zip.file('datos.json')!.async('string'))
  let n = 0
  for (const tabla of ['prendas', 'outfits', 'perfil'] as Tabla[]) {
    for (const r of (d[tabla] ?? []) as Registro[]) {
      const nuevo: Registro = { ...r }
      for (const campo of CAMPOS_BLOB[tabla]) {
        const f = zip.file(`fotos/${clave(tabla, r.id, campo)}`)
        if (f) nuevo[campo] = new Blob([await f.async('arraybuffer')], { type: campo === 'fotoRecorte' ? 'image/png' : 'image/jpeg' })
      }
      await poner(tabla, nuevo)
      n++
    }
  }
  return n
}
