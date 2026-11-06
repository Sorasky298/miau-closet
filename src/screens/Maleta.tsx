import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, leerAjuste, guardarAjuste, type Prenda } from '../db'
import { Pantalla, Titulo, Boton, Aviso, Cargando, Volver, Chips, Tarjeta } from '../components/ui'
import { Collage, FotoPrenda } from '../components/comunes'
import { planearMaleta, type MaletaIa } from '../lib/ia'
import { buscarCiudades, obtenerClima, describirClima, type Ciudad } from '../lib/clima'
import { prendasDisponibles } from '../lib/outfits'
import { traducirError } from '../lib/gemini'

const PLANES = ['Turismo', 'Trabajo', 'Playa', 'Nieve', 'Salidas', 'Eventos', 'Naturaleza'] as const

interface MaletaGuardada {
  destino: string
  dias: number
  plan: MaletaIa
  ids: string[]
  listas: string[]
}

export default function Maleta({ volver }: { volver: () => void }) {
  const perfil = useLiveQuery(() => db.perfil.get('yo'))
  const [q, setQ] = useState('')
  const [res, setRes] = useState<Ciudad[]>([])
  const [destino, setDestino] = useState<Ciudad>()
  const [inicio, setInicio] = useState(new Date().toISOString().slice(0, 10))
  const [dias, setDias] = useState(5)
  const [planes, setPlanes] = useState<string[]>(['Turismo'])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [m, setM] = useState<MaletaGuardada | null>(null)
  const prendas = useLiveQuery(async () => (m ? ((await db.prendas.bulkGet(m.ids)).filter(Boolean) as Prenda[]) : []), [m], [])

  useEffect(() => void leerAjuste<MaletaGuardada | null>('maleta', null).then(setM), [])
  useEffect(() => {
    const t = setTimeout(() => buscarCiudades(q).then(setRes).catch(() => setRes([])), 350)
    return () => clearTimeout(t)
  }, [q])

  async function planear() {
    if (!destino) return
    setCargando(true)
    setError('')
    try {
      const lista = await prendasDisponibles('Viaje')
      const desde = Math.round((new Date(inicio).getTime() - Date.now()) / 864e5)
      let clima = `clima típico de ${destino.nombre} en ${new Date(inicio).toLocaleDateString('es', { month: 'long' })}`
      if (desde >= -1 && desde + dias <= 16) {
        const c = await obtenerClima(destino.lat, destino.lon)
        const tramo = c.dias.slice(Math.max(0, desde), Math.max(0, desde) + dias)
        if (tramo.length) clima = tramo.map((d) => `${d.min}-${d.max}°C ${describirClima(d.codigo).texto}`).join('; ')
      }
      const plan = await planearMaleta({ prendas: lista, perfil, destino: `${destino.nombre}, ${destino.pais}`, dias, clima, plan: planes.join(', ') })
      const nuevo: MaletaGuardada = { destino: destino.nombre, dias, plan, ids: lista.map((p) => p.id), listas: [] }
      await guardarAjuste('maleta', nuevo)
      setM(nuevo)
    } catch (e) {
      setError(traducirError(e))
    } finally {
      setCargando(false)
    }
  }

  async function marcar(id: string) {
    if (!m) return
    const listas = m.listas.includes(id) ? m.listas.filter((x) => x !== id) : [...m.listas, id]
    const nuevo = { ...m, listas }
    setM(nuevo)
    await guardarAjuste('maleta', nuevo)
  }

  return (
    <Pantalla>
      <Volver onClick={volver} />
      <Titulo sub="Pocas prendas, muchos looks">Mi Maleta</Titulo>

      {m && !cargando ? (
        <div className="space-y-5">
          <Tarjeta className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-neutral-500">Destino</p>
              <p className="font-display text-2xl">✈️ {m.destino}</p>
              <p className="text-sm text-neutral-500">
                {m.dias} días · {m.plan.prendas.length} prendas · {m.listas.length}/{m.plan.prendas.length} empacadas
              </p>
            </div>
            <button onClick={() => setM(null)} className="h-10 px-4 rounded-full bg-rosa-100 text-sm font-semibold">
              Nueva
            </button>
          </Tarjeta>

          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-2">🧳 Toca Lo Que Ya Empacaste</p>
            <div className="grid grid-cols-3 gap-2">
              {m.plan.prendas.map((i) => {
                const p = prendas[i]
                if (!p) return null
                const lista = m.listas.includes(p.id)
                return (
                  <button key={p.id} onClick={() => marcar(p.id)} className={`relative bg-white rounded-2xl p-1.5 border-2 ${lista ? 'border-tinta' : 'border-rosa-100'}`}>
                    <FotoPrenda prenda={p} className={`w-full aspect-square ${lista ? 'opacity-40' : ''}`} />
                    {lista && <span className="absolute inset-0 flex items-center justify-center text-3xl">✓</span>}
                  </button>
                )
              })}
            </div>
          </div>

          {m.plan.consejos.length > 0 && (
            <Aviso>
              {m.plan.consejos.map((c) => (
                <p key={c}>💡 {c}</p>
              ))}
            </Aviso>
          )}

          {m.plan.dias.map((d) => (
            <div key={d.dia} className="bg-white rounded-[2rem] p-3 border border-rosa-100">
              <p className="text-xs font-bold uppercase tracking-widest text-neutral-500 px-2 pb-2">
                {d.dia} · {d.ocasion}
              </p>
              <Collage prendas={d.piezas.map((i) => prendas[i]).filter(Boolean)} />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {destino ? (
            <button onClick={() => setDestino(undefined)} className="w-full text-left bg-tinta text-white rounded-2xl px-4 py-4 font-semibold">
              ✈️ {destino.nombre}, {destino.pais} <span className="float-right opacity-70">✕</span>
            </button>
          ) : (
            <>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="✈️  ¿A dónde vas?"
                className="w-full h-14 rounded-2xl border-2 border-rosa-200 px-4 bg-white text-lg"
              />
              {res.map((c) => (
                <button key={`${c.lat}${c.lon}`} onClick={() => (setDestino(c), setQ(''), setRes([]))} className="w-full text-left px-4 py-3 rounded-2xl bg-white font-semibold">
                  {c.nombre} <span className="text-neutral-400 font-normal">· {c.pais}</span>
                </button>
              ))}
            </>
          )}
          <div className="grid grid-cols-2 gap-3">
            <label className="bg-white rounded-2xl px-4 py-2 border-2 border-rosa-200">
              <span className="block text-[10px] font-bold uppercase tracking-widest text-neutral-500">Salida</span>
              <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className="w-full bg-transparent font-semibold" />
            </label>
            <div className="bg-white rounded-2xl px-4 py-2 border-2 border-rosa-200 flex items-center justify-between">
              <button onClick={() => setDias(Math.max(1, dias - 1))} className="text-2xl w-8">
                −
              </button>
              <span className="text-center">
                <span className="block font-display text-2xl leading-none">{dias}</span>
                <span className="text-[10px] font-bold uppercase">Días</span>
              </span>
              <button onClick={() => setDias(Math.min(21, dias + 1))} className="text-2xl w-8">
                +
              </button>
            </div>
          </div>
          <Chips opciones={PLANES} valor={planes as (typeof PLANES)[number][]} multiple alCambiar={setPlanes} />
          <Boton icono="🧳" onClick={planear} disabled={!destino || cargando}>
            {cargando ? 'Empacando…' : 'Armar Mi Maleta'}
          </Boton>
          {cargando && <Cargando texto="Eligiendo lo justo…" />}
          {error && <Aviso tipo="error">{error}</Aviso>}
        </div>
      )}
    </Pantalla>
  )
}
