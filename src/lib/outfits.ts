import { db, nuevoId, ahora, type Outfit, type Prenda, type Capa, type Perfil, type Temporada } from '../db'
import { generarOutfits } from './ia'
import { temporadaActual } from './temporadas'
import { obtenerClima, resumenClima } from './clima'

const BASICOS = ['Ropa Interior', 'Pijama', 'Baño']

export const idsDe = (o: Outfit) => Object.values(o.prendas).flat() as string[]

/** Prendas disponibles para armar outfits según ocasión y temporada. */
export async function prendasDisponibles(ocasion?: string, temporada?: Temporada) {
  return db.prendas
    .filter(
      (p) =>
        !p.pendienteRevision &&
        p.estado === 'Activa' &&
        !BASICOS.includes(p.categoria) &&
        (ocasion === 'Deporte' || p.categoria !== 'Deporte') &&
        (!temporada || p.atemporal || p.temporadas.includes(temporada)),
    )
    .toArray()
}

export async function climaHoy(perfil?: Perfil) {
  if (!perfil?.lat || !perfil.lon) return undefined
  const c = await obtenerClima(perfil.lat, perfil.lon).catch(() => undefined)
  return c ? { texto: resumenClima(c.dias[0]), clima: c } : undefined
}

function aOutfit(piezas: Prenda[], extra: Partial<Outfit>): Outfit {
  const prendas: Partial<Record<Capa, string[]>> = {}
  for (const p of piezas) (prendas[p.capa] ??= []).push(p.id)
  const t = ahora()
  return { id: nuevoId(), prendas, guardado: false, fechasUsado: [], creadoEn: t, actualizadoEn: t, ...extra }
}

export async function crearOutfits(opts: {
  n: number
  ocasion?: string
  estilo?: string
  conClima?: boolean
  incluirId?: string
  evitar?: Outfit[]
}): Promise<Outfit[]> {
  const perfil = await db.perfil.get('yo')
  const temporada = opts.conClima ? temporadaActual(perfil?.hemisferio ?? 'Norte') : undefined
  let prendas = await prendasDisponibles(opts.ocasion, temporada)
  if (opts.incluirId && !prendas.some((p) => p.id === opts.incluirId)) {
    const extra = await db.prendas.get(opts.incluirId)
    if (extra) prendas = [extra, ...prendas]
  }
  if (prendas.length < 3) throw new Error('POCAS_PRENDAS')
  const clima = opts.conClima ? await climaHoy(perfil) : undefined
  const idx = new Map(prendas.map((p, i) => [p.id, i]))
  const r = await generarOutfits({
    prendas,
    perfil,
    n: opts.n,
    ocasion: opts.ocasion,
    estilo: opts.estilo,
    clima: clima?.texto,
    temporada,
    incluir: opts.incluirId ? idx.get(opts.incluirId) : undefined,
    evitar: opts.evitar?.map((o) => idsDe(o).map((id) => idx.get(id) ?? -1)),
  })
  return r.map((o) => aOutfit(o.piezas.map((i) => prendas[i]), { ocasion: o.ocasion, estilo: o.estilo, motivoIa: `${o.nombre}|${o.motivo}` }))
}

export const nombreDe = (o: Outfit) => o.motivoIa?.split('|')[0] ?? 'Outfit'
export const motivoDe = (o: Outfit) => o.motivoIa?.split('|')[1] ?? ''

export async function guardarOutfit(o: Outfit, guardado = true) {
  const existente = await db.outfits.get(o.id)
  await db.outfits.put({ ...(existente ?? o), guardado, actualizadoEn: ahora() })
}

export async function usarOutfit(o: Outfit) {
  const hoy = ahora()
  const existente = (await db.outfits.get(o.id)) ?? o
  await db.outfits.put({ ...existente, fechasUsado: [...existente.fechasUsado, hoy], actualizadoEn: hoy })
  const prendas = (await db.prendas.bulkGet(idsDe(o))).filter((p): p is Prenda => Boolean(p))
  await db.prendas.bulkPut(prendas.map((p) => ({ ...p, vecesUsada: p.vecesUsada + 1, ultimaVez: hoy, actualizadoEn: hoy })))
}

/** Outfit del día: se guarda por fecha para no gastar consultas cada vez que abre la app. */
export async function outfitDelDia(forzar = false): Promise<Outfit | null> {
  const hoy = ahora().slice(0, 10)
  const prev = await db.ajustes.get('outfitDelDia')
  const v = prev?.valor as { fecha: string; id: string } | undefined
  if (!forzar && v?.fecha === hoy) {
    const o = await db.outfits.get(v.id)
    if (o) return o
  }
  const [o] = await crearOutfits({ n: 1, ocasion: 'Día a Día', conClima: true, evitar: v ? [((await db.outfits.get(v.id)) as Outfit)].filter(Boolean) : [] })
  if (!o) return null
  await db.outfits.put(o)
  await db.ajustes.put({ clave: 'outfitDelDia', valor: { fecha: hoy, id: o.id } })
  return o
}
