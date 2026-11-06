// Funciones de estilista: cada una arma su instrucción y valida la respuesta de la IA.
import { preguntarJson, generarImagen } from './gemini'
import type { Prenda, Perfil, Capa, Temporada } from '../db'
import { TEMPORADAS } from './temporadas'

export const CATEGORIAS = [
  'Top', 'Blusa', 'Camisa', 'Polo', 'Chompa', 'Cárdigan', 'Polera', 'Casaca', 'Blazer', 'Abrigo', 'Chaleco',
  'Pantalón', 'Jean', 'Falda', 'Short', 'Leggings', 'Vestido', 'Enterizo',
  'Zapatos', 'Zapatillas', 'Botas', 'Sandalias', 'Tacones',
  'Cinturón', 'Cartera', 'Bufanda', 'Gorro', 'Accesorio', 'Joyería',
  'Ropa Interior', 'Deporte', 'Pijama', 'Baño',
] as const

export const CAPAS: Capa[] = ['Base', 'Media', 'Exterior', 'Abajo', 'Pieza Única', 'Calzado', 'Accesorio']
export const ESTILOS = ['Casual', 'Elegante', 'Romántico', 'Minimalista', 'Clásico', 'Boho', 'Urbano', 'Deportivo', 'Sexy', 'Oficina'] as const
export const OCASIONES = ['Día a Día', 'Trabajo', 'Cita', 'Salida de Noche', 'Evento', 'Viaje', 'Deporte', 'Casa'] as const

const ESTILISTA =
  'Eres una estilista de moda experta, cálida y práctica. Respondes SIEMPRE en español neutro, en JSON válido, sin texto extra. ' +
  'Usas nombres cortos y en Title Case. Nunca inventas prendas que no están en la lista que te dan.'

/* ---------- Fichas de prendas ---------- */

export interface FichaIa {
  nombre: string
  categoria: string
  capa: Capa
  colorPrincipal: string
  colorPrincipalHex?: string
  colorSecundario?: string
  estampado?: string
  material?: string
  abrigo: number
  formalidad: number
  estilos: string[]
  temporadas: Temporada[]
  atemporal: boolean
  motivoAtemporal?: string
  caja?: number[]
}

const ESQUEMA_FICHA = `{
 "nombre": "nombre corto, ej. Chaqueta Denim Negra",
 "categoria": uno de [${CATEGORIAS.join(', ')}],
 "capa": uno de [${CAPAS.join(', ')}]  (Base=prenda superior pegada al cuerpo; Media=chompa/cárdigan/blazer ligero; Exterior=casaca/abrigo; Abajo=pantalón/falda/short; Pieza Única=vestido/enterizo),
 "colorPrincipal": "nombre del color", "colorPrincipalHex": "#RRGGBB", "colorSecundario": "opcional",
 "estampado": "Liso | Rayas | Cuadros | Floral | Animal Print | Lunares | Otro",
 "material": "Algodón | Denim | Lana | Punto | Cuero | Seda | Lino | Sintético | Otro",
 "abrigo": 1-5 (1=muy fresco, 5=muy abrigador),
 "formalidad": 1-5 (1=muy casual, 5=gala),
 "estilos": subconjunto de [${ESTILOS.join(', ')}],
 "temporadas": subconjunto de [${TEMPORADAS.join(', ')}] donde tiene sentido usarla,
 "atemporal": true si NO rota por temporada (ropa interior, pijama, deporte, cinturones, carteras, joyería, básicos que sirven todo el año),
 "motivoAtemporal": "frase corta si atemporal",
 "caja": [ymin, xmin, ymax, xmax] de la prenda principal, normalizado 0-1000
}`

export function normalizarFicha(f: Partial<FichaIa>): FichaIa {
  const temps = (f.temporadas ?? []).filter((t): t is Temporada => TEMPORADAS.includes(t as Temporada))
  const atemporal = Boolean(f.atemporal)
  return {
    nombre: (f.nombre || 'Prenda').slice(0, 40),
    categoria: CATEGORIAS.includes(f.categoria as (typeof CATEGORIAS)[number]) ? f.categoria! : 'Accesorio',
    capa: CAPAS.includes(f.capa as Capa) ? (f.capa as Capa) : 'Accesorio',
    colorPrincipal: f.colorPrincipal || 'Sin Definir',
    colorPrincipalHex: /^#[0-9a-f]{6}$/i.test(f.colorPrincipalHex ?? '') ? f.colorPrincipalHex : undefined,
    colorSecundario: f.colorSecundario || undefined,
    estampado: f.estampado || undefined,
    material: f.material || undefined,
    abrigo: Math.min(5, Math.max(1, Math.round(Number(f.abrigo) || 3))),
    formalidad: Math.min(5, Math.max(1, Math.round(Number(f.formalidad) || 2))),
    estilos: (f.estilos ?? []).slice(0, 4),
    temporadas: atemporal ? [...TEMPORADAS] : temps.length ? temps : [...TEMPORADAS],
    atemporal,
    motivoAtemporal: atemporal ? f.motivoAtemporal : undefined,
    caja: Array.isArray(f.caja) && f.caja.length === 4 ? f.caja.map(Number) : undefined,
  }
}

/** Analiza varias fotos (1 prenda por foto) en una sola consulta. */
export async function analizarPrendas(fotos: Blob[]): Promise<FichaIa[]> {
  const r = await preguntarJson<{ prendas: Partial<FichaIa>[] }>({
    instruccion: ESTILISTA,
    imagenes: fotos,
    texto:
      `Te envío ${fotos.length} foto(s), en orden. Cada foto muestra UNA prenda principal. ` +
      `Devuelve {"prendas": [ficha por cada foto, en el mismo orden]} con este formato por ficha:\n${ESQUEMA_FICHA}`,
  })
  const lista = r.prendas ?? []
  return fotos.map((_, i) => normalizarFicha(lista[i] ?? {}))
}

/** Foto Grupal: detecta varias prendas en una sola foto. */
export async function detectarPrendas(foto: Blob): Promise<FichaIa[]> {
  const r = await preguntarJson<{ prendas: Partial<FichaIa>[] }>({
    instruccion: ESTILISTA,
    imagenes: [foto],
    texto:
      'En esta foto hay VARIAS prendas sobre una superficie. Detecta cada prenda por separado (máximo 12). ' +
      `Devuelve {"prendas": [ficha por prenda]} con "caja" ajustada a cada una. Formato:\n${ESQUEMA_FICHA}`,
  })
  return (r.prendas ?? []).map(normalizarFicha).filter((f) => f.caja)
}

/* ---------- Catálogo compacto para la IA ---------- */

export function catalogo(prendas: Prenda[]) {
  return prendas.map((p, i) => ({
    i,
    n: p.nombre,
    cat: p.categoria,
    capa: p.capa,
    color: p.colorPrincipal + (p.colorSecundario ? '/' + p.colorSecundario : ''),
    est: p.estampado,
    abr: p.abrigo,
    form: p.formalidad,
    estilos: p.estilos,
    temp: p.atemporal ? 'Todo el año' : p.temporadas.join(','),
    usada: p.vecesUsada,
  }))
}

export function contextoPerfil(p?: Perfil) {
  if (!p) return 'Sin perfil.'
  return JSON.stringify({
    estilo: [p.estiloPrincipal, p.estiloSecundario].filter(Boolean),
    colorimetria: p.colorimetria,
    paleta: p.paleta,
    cabello: p.cabello,
    ojos: p.ojos,
    tipoCuerpo: p.tipoCuerpo,
    noLeGusta: p.noMeGusta,
    ocasiones: p.ocasiones,
  })
}

/* ---------- Outfits ---------- */

export interface OutfitIa {
  nombre: string
  piezas: number[]
  ocasion: string
  estilo: string
  motivo: string
}

export async function generarOutfits(opts: {
  prendas: Prenda[]
  perfil?: Perfil
  n: number
  ocasion?: string
  estilo?: string
  clima?: string
  temporada?: Temporada
  incluir?: number
  evitar?: number[][]
}): Promise<OutfitIa[]> {
  const r = await preguntarJson<{ outfits: OutfitIa[] }>({
    instruccion: ESTILISTA,
    texto:
      `Arma ${opts.n} outfits DISTINTOS usando SOLO prendas de este clóset (usa el índice "i"):\n${JSON.stringify(catalogo(opts.prendas))}\n\n` +
      `Perfil de la usuaria: ${contextoPerfil(opts.perfil)}\n` +
      (opts.ocasion ? `Ocasión: ${opts.ocasion}\n` : '') +
      (opts.estilo ? `Estilo deseado: ${opts.estilo}\n` : '') +
      (opts.clima ? `Clima: ${opts.clima}\n` : '') +
      (opts.temporada ? `Temporada: ${opts.temporada}\n` : '') +
      (opts.incluir !== undefined ? `Todos los outfits deben incluir la prenda i=${opts.incluir}\n` : '') +
      (opts.evitar?.length ? `No repitas estas combinaciones: ${JSON.stringify(opts.evitar)}\n` : '') +
      'Reglas: arma por capas (Base o Pieza Única + Abajo si corresponde + Media/Exterior según clima + Calzado + 0-2 Accesorios). ' +
      'Combina colores según su paleta y favorece su tipo de cuerpo. Prioriza prendas poco usadas cuando queden bien. ' +
      'Devuelve {"outfits":[{"nombre":"nombre corto y evocador","piezas":[i...],"ocasion":"...","estilo":"...","motivo":"una frase de por qué funciona"}]}',
  })
  return (r.outfits ?? [])
    .map((o) => ({ ...o, piezas: [...new Set((o.piezas ?? []).map(Number))].filter((i) => opts.prendas[i]) }))
    .filter((o) => o.piezas.length >= 2)
}

/* ---------- Colorimetría ---------- */

export interface ColorimetriaIa {
  estacion: string
  subtono: string
  cabello: string
  ojos: string
  paleta: string[]
  evitar: string[]
  explicacion: string
}

export async function analizarColorimetria(selfie: Blob): Promise<ColorimetriaIa> {
  return preguntarJson<ColorimetriaIa>({
    instruccion: ESTILISTA + ' Eres además asesora de colorimetría (sistema de 12 estaciones).',
    imagenes: [selfie],
    texto:
      'Analiza la colorimetría de esta persona (selfie con luz natural). Ten en cuenta que la luz puede alterar tonos. ' +
      'Devuelve {"estacion":"ej. Otoño Suave","subtono":"Cálido | Frío | Neutro","cabello":"color","ojos":"color",' +
      '"paleta":[8 colores #RRGGBB que la favorecen],"evitar":[4 colores #RRGGBB],"explicacion":"2 frases"}',
  })
}

/* ---------- Compra Inteligente ---------- */

export interface BrechaIa {
  prenda: string
  motivo: string
  prioridad: 'Alta' | 'Media' | 'Baja'
  colorHex?: string
  outfitsNuevos: number
}

export async function analizarBrechas(prendas: Prenda[], perfil: Perfil | undefined, temporada: Temporada): Promise<{ resumen: string; faltantes: BrechaIa[] }> {
  return preguntarJson({
    instruccion: ESTILISTA,
    texto:
      `Clóset actual:\n${JSON.stringify(catalogo(prendas))}\nPerfil: ${contextoPerfil(perfil)}\nTemporada que viene: ${temporada}\n` +
      'Identifica las 3 a 6 prendas que más le faltan para armar más outfits (cápsula inteligente, compra mínima). ' +
      'Devuelve {"resumen":"1 frase","faltantes":[{"prenda":"nombre concreto","motivo":"frase corta","prioridad":"Alta|Media|Baja","colorHex":"#RRGGBB","outfitsNuevos":número estimado}]}',
  })
}

export interface VeredictoIa {
  veredicto: 'Cómpralo' | 'Piénsalo' | 'Déjalo'
  outfitsNuevos: number
  parecidas: number[]
  vaConTuPaleta: boolean
  motivo: string
  combinaCon: number[]
}

export async function antesDeComprar(foto: Blob, prendas: Prenda[], perfil?: Perfil): Promise<VeredictoIa> {
  const r = await preguntarJson<VeredictoIa>({
    instruccion: ESTILISTA + ' Ayudas a comprar con inteligencia y evitar compras repetidas.',
    imagenes: [foto],
    texto:
      `La usuaria está pensando comprar la prenda de la foto. Su clóset:\n${JSON.stringify(catalogo(prendas))}\nPerfil: ${contextoPerfil(perfil)}\n` +
      'Devuelve {"veredicto":"Cómpralo|Piénsalo|Déjalo","outfitsNuevos":número,"parecidas":[i de prendas casi iguales],' +
      '"vaConTuPaleta":true|false,"combinaCon":[i de hasta 6 prendas con las que combina],"motivo":"máx. 2 frases"}',
  })
  const ok = (l?: number[]) => (l ?? []).map(Number).filter((i) => prendas[i])
  return { ...r, parecidas: ok(r.parecidas), combinaCon: ok(r.combinaCon) }
}

/* ---------- Maleta ---------- */

export interface MaletaIa {
  prendas: number[]
  dias: { dia: string; piezas: number[]; ocasion: string }[]
  consejos: string[]
}

export async function planearMaleta(opts: { prendas: Prenda[]; perfil?: Perfil; destino: string; dias: number; clima: string; plan: string }): Promise<MaletaIa> {
  const r = await preguntarJson<MaletaIa>({
    instruccion: ESTILISTA + ' Eres experta en maletas cápsula: pocas prendas, muchas combinaciones.',
    texto:
      `Clóset:\n${JSON.stringify(catalogo(opts.prendas))}\nPerfil: ${contextoPerfil(opts.perfil)}\n` +
      `Viaje a ${opts.destino}, ${opts.dias} días. Clima esperado: ${opts.clima}. Planes: ${opts.plan || 'turismo y salidas'}.\n` +
      'Elige la menor cantidad de prendas que cubran todos los días. ' +
      'Devuelve {"prendas":[i...],"dias":[{"dia":"Día 1","piezas":[i...],"ocasion":"..."}],"consejos":["máx 3 consejos cortos"]}',
  })
  const ok = (l?: number[]) => [...new Set((l ?? []).map(Number))].filter((i) => opts.prendas[i])
  return { prendas: ok(r.prendas), dias: (r.dias ?? []).map((d) => ({ ...d, piezas: ok(d.piezas) })), consejos: r.consejos ?? [] }
}

/* ---------- Imágenes (con costo) ---------- */

export const PROMPT_PROBADOR =
  'Viste a la persona de la primera foto con EXACTAMENTE las prendas de las demás fotos, combinadas como un solo outfit. ' +
  'Conserva su rostro, cuerpo, tono de piel y cabello. Mantén colores, texturas y detalles reales de cada prenda. ' +
  'Foto de cuerpo entero, pose natural, fondo de estudio claro, luz suave, estilo editorial de moda.'

export function probarOutfit(fotoCuerpo: Blob, prendas: Blob[]) {
  return generarImagen(PROMPT_PROBADOR, [fotoCuerpo, ...prendas])
}

export function fotoCatalogo(prenda: Blob) {
  return generarImagen(
    'Convierte esta foto en una foto de catálogo de tienda online: la MISMA prenda, sin cambiar diseño, color, estampado ni detalles, ' +
      'centrada, plana o en maniquí invisible, fondo blanco limpio, luz de estudio suave.',
    [prenda],
  )
}

/* ---------- Texto para ChatGPT ---------- */

export function resumenParaChatGpt(prendas: Prenda[], perfil?: Perfil) {
  const lineas = prendas
    .filter((p) => p.estado !== 'Donar' && p.estado !== 'Vender')
    .map((p) => `- ${p.nombre} (${p.categoria}, ${p.colorPrincipal}${p.atemporal ? ', todo el año' : ', ' + p.temporadas.join('/')})`)
  return (
    'Eres mi estilista personal. Este es mi clóset y mi perfil. Ayúdame a armar outfits y decidir compras usando SOLO estas prendas salvo que te pida comprar.\n\n' +
    `MI PERFIL: ${contextoPerfil(perfil)}\n\nMI CLÓSET (${lineas.length} prendas):\n${lineas.join('\n')}`
  )
}
