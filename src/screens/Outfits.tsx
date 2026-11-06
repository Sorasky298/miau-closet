import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, leerAjuste, guardarAjuste, ahora, type Outfit } from '../db'
import { Pantalla, Titulo, Chips, Boton, Aviso, Cargando, Tarjeta } from '../components/ui'
import { Collage, Probador, usePrendas, FotoPrenda, avisar } from '../components/comunes'
import { OCASIONES, ESTILOS, PROMPT_PROBADOR } from '../lib/ia'
import { crearOutfits, guardarOutfit, usarOutfit, idsDe, nombreDe, motivoDe, prendasDisponibles } from '../lib/outfits'
import { traducirError, crearLoteImagenes, revisarLote, COSTO_IMAGEN_USD } from '../lib/gemini'
import { obtenerClima, describirClima } from '../lib/clima'
import { generarOutfits } from '../lib/ia'
import { useUrl, fotoDe } from '../lib/imagen'
import { temporadaActual } from '../lib/temporadas'

type Pestana = 'crear' | 'guardados' | 'semana'

export default function Outfits({ incluirId, limpiarIncluir }: { incluirId?: string; limpiarIncluir: () => void }) {
  const [pestana, setPestana] = useState<Pestana>('crear')
  return (
    <Pantalla>
      <Titulo>Outfits</Titulo>
      <div className="grid grid-cols-3 gap-1 bg-white rounded-2xl p-1 border border-rosa-100 mb-5">
        {(
          [
            ['crear', '✨', 'Crear'],
            ['guardados', '❤️', 'Guardados'],
            ['semana', '📅', 'Mi Semana'],
          ] as const
        ).map(([k, i, t]) => (
          <button key={k} onClick={() => setPestana(k)} className={`h-11 rounded-xl text-xs font-bold uppercase whitespace-nowrap ${pestana === k ? 'bg-tinta text-white' : ''}`}>
            {i} {t}
          </button>
        ))}
      </div>
      {pestana === 'crear' && <Crear incluirId={incluirId} limpiarIncluir={limpiarIncluir} />}
      {pestana === 'guardados' && <Guardados />}
      {pestana === 'semana' && <Semana />}
    </Pantalla>
  )
}

/* ---------- Crear ---------- */
function Crear({ incluirId, limpiarIncluir }: { incluirId?: string; limpiarIncluir: () => void }) {
  const perfil = useLiveQuery(() => db.perfil.get('yo'))
  const [ocasion, setOcasion] = useState<string>('Día a Día')
  const [estilo, setEstilo] = useState<string>()
  const [conClima, setConClima] = useState(true)
  const [ideas, setIdeas] = useState<Outfit[]>([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const incluida = useLiveQuery(() => (incluirId ? db.prendas.get(incluirId) : undefined), [incluirId])

  useEffect(() => {
    if (perfil?.estiloPrincipal && !estilo) setEstilo(perfil.estiloPrincipal)
  }, [perfil, estilo])

  async function crear(mas = false) {
    setCargando(true)
    setError('')
    try {
      const nuevos = await crearOutfits({ n: 4, ocasion, estilo, conClima: conClima && Boolean(perfil?.lat), incluirId, evitar: mas ? ideas : [] })
      setIdeas(mas ? [...ideas, ...nuevos] : nuevos)
    } catch (e) {
      setError(String((e as Error).message) === 'POCAS_PRENDAS' ? 'Necesitas al menos 3 prendas activas para armar outfits.' : traducirError(e))
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="space-y-5">
      {incluida && (
        <div className="flex items-center gap-3 bg-white rounded-2xl p-2 pr-4 border-2 border-tinta">
          <FotoPrenda prenda={incluida} className="w-14 h-14 rounded-xl bg-rosa-50" />
          <div className="flex-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Combinar</p>
            <p className="font-semibold text-sm">{incluida.nombre}</p>
          </div>
          <button onClick={limpiarIncluir} className="text-xl">
            ✕
          </button>
        </div>
      )}

      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-2">¿Para Qué?</p>
        <Chips opciones={OCASIONES} valor={ocasion} alCambiar={(v) => v[0] && setOcasion(v[0])} />
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-2">Estilo</p>
        <Chips opciones={ESTILOS} valor={estilo as (typeof ESTILOS)[number]} alCambiar={(v) => setEstilo(v[0])} />
      </div>
      {perfil?.lat && (
        <button onClick={() => setConClima(!conClima)} className="flex items-center gap-3 text-sm font-semibold">
          <span className={`w-12 h-7 rounded-full p-1 transition ${conClima ? 'bg-tinta' : 'bg-rosa-200'}`}>
            <span className={`block w-5 h-5 rounded-full bg-white transition ${conClima ? 'translate-x-5' : ''}`} />
          </span>
          🌤️ Según El Clima De Hoy
        </button>
      )}

      <Boton icono="✨" onClick={() => crear(false)} disabled={cargando}>
        {cargando ? 'Pensando…' : 'Crear Outfits'}
      </Boton>
      {error && <Aviso tipo="error">{error}</Aviso>}
      {cargando && !ideas.length && <Cargando texto="Combinando tu clóset…" />}

      <div className="space-y-5">
        {ideas.map((o) => (
          <TarjetaOutfit key={o.id} outfit={o} />
        ))}
      </div>
      {ideas.length > 0 && (
        <Boton variante="secundario" icono="🔄" onClick={() => crear(true)} disabled={cargando}>
          {cargando ? 'Pensando…' : 'Más Ideas'}
        </Boton>
      )}
    </div>
  )
}

/* ---------- Tarjeta reutilizable ---------- */
export function TarjetaOutfit({ outfit, etiqueta }: { outfit: Outfit; etiqueta?: string }) {
  const prendas = usePrendas(idsDe(outfit))
  const vivo = useLiveQuery(() => db.outfits.get(outfit.id), [outfit.id])
  const o = vivo ?? outfit
  const [probar, setProbar] = useState(false)
  const urlProbador = useUrl(o.imagenProbador)
  const [verProbador, setVerProbador] = useState(true)

  return (
    <div className="bg-white rounded-[2rem] border border-rosa-100 p-3 shadow-sm">
      {etiqueta && <p className="text-xs font-bold uppercase tracking-widest text-neutral-500 px-2 pt-1 pb-2">{etiqueta}</p>}
      {urlProbador && verProbador ? (
        <button onClick={() => setVerProbador(false)} className="block w-full">
          <img src={urlProbador} alt="Look" className="w-full aspect-[4/5] object-cover rounded-3xl" />
        </button>
      ) : (
        <button onClick={() => setVerProbador(true)} className="block w-full">
          <Collage prendas={prendas} />
        </button>
      )}
      <div className="px-2 pt-3">
        <h3 className="font-display text-xl">{nombreDe(o)}</h3>
        <p className="text-sm text-neutral-500">{motivoDe(o)}</p>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-3">
        <BotonIcono
          icono={o.guardado ? '❤️' : '🤍'}
          texto={o.guardado ? 'Guardado' : 'Guardar'}
          onClick={async () => {
            await guardarOutfit(o, !o.guardado)
            if (!o.guardado) avisar('❤️ Guardado')
          }}
        />
        <BotonIcono
          icono="👗"
          texto="Lo Usé"
          onClick={async () => {
            await usarOutfit(o)
            avisar('👗 ¡Anotado!')
          }}
        />
        <BotonIcono icono="🪄" texto="Probar" destacado onClick={() => setProbar(true)} />
      </div>
      <Probador abierto={probar} alCerrar={() => setProbar(false)} prendas={prendas} outfitId={vivo ? o.id : undefined} />
    </div>
  )
}

function BotonIcono({ icono, texto, onClick, destacado }: { icono: string; texto: string; onClick: () => void; destacado?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`h-16 rounded-2xl flex flex-col items-center justify-center gap-0.5 font-bold text-[11px] uppercase tracking-wide active:scale-95 transition ${
        destacado ? 'bg-tinta text-white' : 'bg-rosa-100'
      }`}
    >
      <span className="text-xl">{icono}</span>
      {texto}
    </button>
  )
}

/* ---------- Guardados ---------- */
function Guardados() {
  const lista = useLiveQuery(() => db.outfits.filter((o) => o.guardado).reverse().sortBy('actualizadoEn'), [], [])
  if (!lista.length)
    return (
      <Tarjeta className="text-center">
        <div className="text-4xl mb-2">🤍</div>
        <p className="text-neutral-600">Toca ❤️ en un outfit para guardarlo aquí.</p>
      </Tarjeta>
    )
  return (
    <div className="space-y-5">
      {lista.map((o) => (
        <TarjetaOutfit key={o.id} outfit={o} />
      ))}
    </div>
  )
}

/* ---------- Mi Semana (Lookbook) ---------- */
interface Lookbook {
  creado: string
  dias: { fecha: string; icono: string; temp: string; outfitId: string }[]
  lote?: string
}

function Semana() {
  const perfil = useLiveQuery(() => db.perfil.get('yo'))
  const [lb, setLb] = useState<Lookbook | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [confirmar, setConfirmar] = useState(false)
  const [estadoLote, setEstadoLote] = useState('')

  useEffect(() => {
    leerAjuste<Lookbook | null>('lookbook', null).then(async (l) => {
      setLb(l)
      if (l?.lote) await revisar(l)
    })
  }, [])

  async function revisar(l: Lookbook) {
    try {
      const r = await revisarLote(l.lote!)
      if (r.estado === 'pendiente') return setEstadoLote('⏳ Tus 7 looks se están creando. Vuelve en unas horas.')
      if (r.estado === 'error') setEstadoLote('No se pudieron crear las imágenes.')
      for (const [id, img] of Object.entries(r.imagenes)) await db.outfits.update(id, { imagenProbador: img, actualizadoEn: ahora() })
      if (r.estado === 'listo') setEstadoLote('✨ ¡Tus looks están listos!')
      const nuevo = { ...l, lote: undefined }
      await guardarAjuste('lookbook', nuevo)
      setLb(nuevo)
    } catch (e) {
      setEstadoLote(traducirError(e))
    }
  }

  async function crearSemana() {
    setCargando(true)
    setError('')
    try {
      const hem = perfil?.hemisferio ?? 'Norte'
      const prendas = await prendasDisponibles('Día a Día', temporadaActual(hem))
      if (prendas.length < 3) throw new Error('POCAS_PRENDAS')
      const clima = perfil?.lat ? await obtenerClima(perfil.lat, perfil.lon!) : undefined
      const dias = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(Date.now() + i * 864e5)
        const c = clima?.dias[i]
        return { fecha: d.toISOString().slice(0, 10), c }
      })
      const climaTexto = dias.map((d, i) => `Día ${i + 1}: ${d.c ? `${d.c.min}-${d.c.max}°C ${describirClima(d.c.codigo).texto}` : 'sin dato'}`).join('; ')
      const r = await generarOutfits({ prendas, perfil, n: 7, ocasion: perfil?.ocasiones?.[0] ?? 'Día a Día', estilo: perfil?.estiloPrincipal, clima: climaTexto })
      const nuevo: Lookbook = { creado: ahora(), dias: [] }
      for (const [i, o] of r.slice(0, 7).entries()) {
        const piezas = o.piezas.map((x) => prendas[x])
        const out: Outfit = {
          id: crypto.randomUUID(),
          prendas: piezas.reduce<Outfit['prendas']>((acc, p) => ((acc[p.capa] ??= []).push(p.id), acc), {}),
          ocasion: o.ocasion,
          estilo: o.estilo,
          motivoIa: `${o.nombre}|${o.motivo}`,
          guardado: false,
          fechasUsado: [],
          creadoEn: ahora(),
          actualizadoEn: ahora(),
        }
        await db.outfits.put(out)
        const c = dias[i]?.c
        nuevo.dias.push({ fecha: dias[i].fecha, icono: c ? describirClima(c.codigo).icono : '📅', temp: c ? `${c.min}°–${c.max}°` : '', outfitId: out.id })
      }
      await guardarAjuste('lookbook', nuevo)
      setLb(nuevo)
    } catch (e) {
      setError(String((e as Error).message) === 'POCAS_PRENDAS' ? 'Necesitas al menos 3 prendas activas.' : traducirError(e))
    } finally {
      setCargando(false)
    }
  }

  async function verme7() {
    if (!lb || !perfil?.fotoCuerpo) return
    setConfirmar(false)
    setEstadoLote('Enviando…')
    try {
      const pedidos = []
      for (const d of lb.dias) {
        const o = await db.outfits.get(d.outfitId)
        if (!o) continue
        const prendas = (await db.prendas.bulkGet(idsDe(o))).filter(Boolean)
        pedidos.push({ clave: o.id, texto: PROMPT_PROBADOR, imagenes: [perfil.fotoCuerpo, ...prendas.map((p) => fotoDe(p!))] })
      }
      const lote = await crearLoteImagenes(pedidos)
      const nuevo = { ...lb, lote }
      await guardarAjuste('lookbook', nuevo)
      setLb(nuevo)
      setEstadoLote('⏳ Listo en unas horas. Te avisamos aquí.')
    } catch (e) {
      setEstadoLote(traducirError(e))
    }
  }

  const dia = (f: string) => new Date(f + 'T12:00').toLocaleDateString('es', { weekday: 'long', day: 'numeric' })

  return (
    <div className="space-y-5">
      <Boton icono="📅" onClick={crearSemana} disabled={cargando}>
        {cargando ? 'Planeando…' : lb ? 'Nueva Semana' : 'Planear Mi Semana'}
      </Boton>
      {error && <Aviso tipo="error">{error}</Aviso>}
      {cargando && <Cargando texto="7 días, 7 looks…" />}

      {lb && !cargando && (
        <>
          {perfil?.fotoCuerpo && !lb.lote && (
            confirmar ? (
              <div className="bg-white rounded-3xl p-4 text-center space-y-3 border-2 border-rosa-200">
                <p className="font-semibold">💳 7 imágenes ≈ US${(7 * COSTO_IMAGEN_USD * 0.5).toFixed(2)} · Lo Paga Tu Google</p>
                <div className="grid grid-cols-2 gap-2">
                  <Boton onClick={verme7}>Sí, Crear</Boton>
                  <Boton variante="secundario" onClick={() => setConfirmar(false)}>
                    No
                  </Boton>
                </div>
              </div>
            ) : (
              <button onClick={() => setConfirmar(true)} className="w-full rounded-3xl bg-tinta text-white p-4 flex items-center justify-between">
                <span className="flex items-center gap-3">
                  <span className="text-3xl">🪄</span>
                  <span className="text-left">
                    <span className="block font-semibold uppercase tracking-wide">Verme Los 7</span>
                    <span className="block text-xs text-white/70">Mitad De Precio · Listo En Horas</span>
                  </span>
                </span>
                <span className="text-xs font-semibold bg-white/15 rounded-full px-3 py-1">-50%</span>
              </button>
            )
          )}
          {estadoLote && <Aviso>{estadoLote}</Aviso>}
          {lb.dias.map((d) => (
            <DiaLookbook key={d.outfitId} etiqueta={`${d.icono} ${dia(d.fecha)} ${d.temp}`} id={d.outfitId} />
          ))}
        </>
      )}
    </div>
  )
}

function DiaLookbook({ id, etiqueta }: { id: string; etiqueta: string }) {
  const o = useLiveQuery(() => db.outfits.get(id), [id])
  if (!o) return null
  return <TarjetaOutfit outfit={o} etiqueta={etiqueta} />
}
