// Cola de carga de prendas: sigue trabajando aunque cambies de pantalla (con la app abierta).
import { useSyncExternalStore } from 'react'
import { db, nuevoId, ahora, leerAjuste, type Prenda } from '../db'
import { prepararFoto, recortarCaja, quitarFondo } from './imagen'
import { analizarPrendas, detectarPrendas, type FichaIa } from './ia'
import { traducirError } from './gemini'

export interface EstadoCarga {
  activo: boolean
  total: number
  hechas: number
  texto: string
  error: string
}

let estado: EstadoCarga = { activo: false, total: 0, hechas: 0, texto: '', error: '' }
const oyentes = new Set<() => void>()
const fijar = (c: Partial<EstadoCarga>) => {
  estado = { ...estado, ...c }
  oyentes.forEach((o) => o())
}
export const useCarga = () =>
  useSyncExternalStore(
    (o) => (oyentes.add(o), () => oyentes.delete(o)),
    () => estado,
  )

const LOTE = 6

function base(foto: Blob): Prenda {
  const t = ahora()
  return {
    id: nuevoId(),
    fotoOriginal: foto,
    nombre: 'Analizando…',
    categoria: 'Accesorio',
    capa: 'Accesorio',
    colorPrincipal: '',
    abrigo: 3,
    formalidad: 2,
    estilos: [],
    temporadas: [],
    atemporal: false,
    vecesUsada: 0,
    favorita: false,
    estado: 'Activa',
    pendienteRevision: true,
    creadoEn: t,
    actualizadoEn: t,
  }
}

function aplicar(p: Prenda, f: FichaIa): Prenda {
  const { caja: _caja, ...resto } = f
  return { ...p, ...resto, actualizadoEn: ahora() }
}

async function recorte(foto: Blob, caja?: number[]): Promise<Blob> {
  const cortada = caja ? await recortarCaja(foto, caja) : foto
  if (!(await leerAjuste('quitarFondo', true))) return cortada
  try {
    return await quitarFondo(cortada)
  } catch {
    return cortada
  }
}

/** Varias fotos, una prenda por foto. */
export async function cargarFotos(archivos: File[]) {
  if (estado.activo) return
  fijar({ activo: true, total: archivos.length, hechas: 0, texto: 'Preparando fotos…', error: '' })
  try {
    const prendas: Prenda[] = []
    for (const a of archivos) {
      try {
        const p = base(await prepararFoto(a))
        await db.prendas.add(p)
        prendas.push(p)
      } catch {
        fijar({ error: 'Una foto no se pudo abrir (formato no compatible).' })
      }
    }
    fijar({ total: prendas.length })
    for (let i = 0; i < prendas.length; i += LOTE) {
      const lote = prendas.slice(i, i + LOTE)
      fijar({ texto: `La IA está mirando tu ropa… ${Math.min(i + LOTE, prendas.length)}/${prendas.length}` })
      let fichas: FichaIa[] = []
      try {
        fichas = await analizarPrendas(lote.map((p) => p.fotoOriginal))
      } catch (e) {
        fijar({ error: traducirError(e) })
      }
      for (const [j, p] of lote.entries()) {
        const f = fichas[j]
        fijar({ texto: `Recortando ${i + j + 1}/${prendas.length}…` })
        const actualizada = f ? aplicar(p, f) : { ...p, nombre: 'Prenda Sin Ficha' }
        actualizada.fotoRecorte = await recorte(p.fotoOriginal, f?.caja)
        await db.prendas.put(actualizada)
        fijar({ hechas: i + j + 1 })
      }
    }
    fijar({ texto: '¡Listo! Revisa tus prendas 👇' })
  } finally {
    fijar({ activo: false })
  }
}

/** Una foto con varias prendas. */
export async function cargarFotoGrupal(archivo: File) {
  if (estado.activo) return
  fijar({ activo: true, total: 1, hechas: 0, texto: 'Buscando prendas en la foto…', error: '' })
  try {
    const foto = await prepararFoto(archivo)
    const fichas = await detectarPrendas(foto)
    if (!fichas.length) {
      fijar({ error: 'No encontré prendas. Prueba con más luz y separadas.' })
      return
    }
    fijar({ total: fichas.length })
    for (const [i, f] of fichas.entries()) {
      fijar({ texto: `Recortando ${i + 1}/${fichas.length}…` })
      const solo = await recortarCaja(foto, f.caja!)
      const p = aplicar(base(solo), f)
      p.fotoRecorte = await recorte(solo)
      await db.prendas.add(p)
      fijar({ hechas: i + 1 })
    }
    fijar({ texto: `¡Encontré ${fichas.length} prendas! Revísalas 👇` })
  } catch (e) {
    fijar({ error: traducirError(e) })
  } finally {
    fijar({ activo: false })
  }
}

/** Vuelve a pedir la ficha a la IA para una prenda. */
export async function reanalizar(p: Prenda) {
  const [f] = await analizarPrendas([p.fotoOriginal])
  await db.prendas.put({ ...aplicar(p, f), fotoRecorte: p.fotoRecorte ?? (await recorte(p.fotoOriginal, f.caja)) })
}
