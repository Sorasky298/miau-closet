import Dexie, { type EntityTable } from 'dexie'

export type Temporada = 'Primavera' | 'Verano' | 'Otoño' | 'Invierno'
export type Capa = 'Base' | 'Media' | 'Exterior' | 'Abajo' | 'Pieza Única' | 'Calzado' | 'Accesorio'
export type EstadoPrenda = 'Activa' | 'Guardada' | 'Donar' | 'Vender'

export interface Prenda {
  id: string
  fotoOriginal: Blob
  fotoRecorte?: Blob
  fotoCatalogo?: Blob
  nombre: string
  categoria: string
  capa: Capa
  colorPrincipal: string
  colorPrincipalHex?: string
  colorSecundario?: string
  estampado?: string
  material?: string
  abrigo: number // 1–5
  formalidad: number // 1–5
  estilos: string[]
  temporadas: Temporada[]
  atemporal: boolean
  motivoAtemporal?: string
  ubicacion?: string
  marca?: string
  linkReferencia?: string
  vecesUsada: number
  ultimaVez?: string
  favorita: boolean
  estado: EstadoPrenda
  notas?: string
  pendienteRevision: boolean
  creadoEn: string
  actualizadoEn: string
}

export interface Outfit {
  id: string
  prendas: Partial<Record<Capa, string[]>>
  ocasion?: string
  temporada?: Temporada
  estilo?: string
  motivoIa?: string
  guardado: boolean
  fechasUsado: string[]
  imagenProbador?: Blob
  creadoEn: string
  actualizadoEn: string
}

export interface Perfil {
  id: 'yo'
  nombre?: string
  apodo: string
  ciudad?: string
  lat?: number
  lon?: number
  hemisferio: 'Norte' | 'Sur'
  estiloPrincipal?: string
  estiloSecundario?: string
  colorimetria?: string
  paleta?: string[]
  cabello?: string
  ojos?: string
  subtono?: string
  altura?: number
  hombros?: number
  busto?: number
  cintura?: number
  cadera?: number
  tipoCuerpo?: string
  noMeGusta: string[]
  ocasiones: string[]
  fotoCuerpo?: Blob
  actualizadoEn: string
}

export interface Ajuste {
  clave: string
  valor: unknown
}

export const db = new Dexie('miau-closet') as Dexie & {
  prendas: EntityTable<Prenda, 'id'>
  outfits: EntityTable<Outfit, 'id'>
  perfil: EntityTable<Perfil, 'id'>
  ajustes: EntityTable<Ajuste, 'clave'>
}

db.version(1).stores({
  prendas: 'id, categoria, capa, estado, atemporal, *temporadas, actualizadoEn',
  outfits: 'id, guardado, actualizadoEn',
  perfil: 'id',
  ajustes: 'clave',
})

export const nuevoId = () => crypto.randomUUID()
export const ahora = () => new Date().toISOString()

export async function leerAjuste<T>(clave: string, porDefecto: T): Promise<T> {
  const a = await db.ajustes.get(clave)
  return (a?.valor as T) ?? porDefecto
}
export async function guardarAjuste(clave: string, valor: unknown) {
  await db.ajustes.put({ clave, valor })
}

// Pide al navegador que no borre los datos (importante en iPhone)
export async function pedirPersistencia() {
  try {
    if (navigator.storage?.persist) await navigator.storage.persist()
  } catch {
    /* sin soporte */
  }
}
