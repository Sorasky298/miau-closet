import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, ahora, type Perfil as P } from '../db'
import { Pantalla, Tarjeta, Chips, Boton, Aviso, Cargando } from '../components/ui'
import { BotonArchivo, avisar } from '../components/comunes'
import { ESTILOS, OCASIONES, analizarColorimetria } from '../lib/ia'
import { buscarCiudades, type Ciudad } from '../lib/clima'
import { calcularTipoCuerpo } from '../lib/cuerpo'
import { prepararFoto, useUrl } from '../lib/imagen'
import { traducirError } from '../lib/gemini'

export const PERFIL_BASE: P = { id: 'yo', apodo: 'Gatofeo', hemisferio: 'Norte', noMeGusta: [], ocasiones: [], actualizadoEn: '' }

export async function actualizarPerfil(c: Partial<P>) {
  const p = (await db.perfil.get('yo')) ?? PERFIL_BASE
  await db.perfil.put({ ...p, ...c, actualizadoEn: ahora() })
}

const ICONO_ESTILO: Record<string, string> = {
  Casual: '👟', Elegante: '🥂', Romántico: '🌹', Minimalista: '◻️', Clásico: '🤍', Boho: '🌾', Urbano: '🧢', Deportivo: '🏃‍♀️', Sexy: '💋', Oficina: '💼',
}
const ESTACIONES = [
  'Primavera Clara', 'Primavera Cálida', 'Primavera Brillante', 'Verano Claro', 'Verano Frío', 'Verano Suave',
  'Otoño Suave', 'Otoño Cálido', 'Otoño Profundo', 'Invierno Profundo', 'Invierno Frío', 'Invierno Brillante',
] as const

export default function Perfil() {
  const perfil = useLiveQuery(() => db.perfil.get('yo')) ?? PERFIL_BASE
  const urlCuerpo = useUrl(perfil.fotoCuerpo)

  return (
    <Pantalla>
      <div className="flex flex-col items-center text-center pt-2 pb-6">
        <div className="w-24 h-24 rounded-full bg-white border-4 border-rosa-200 overflow-hidden flex items-center justify-center text-5xl">
          {urlCuerpo ? <img src={urlCuerpo} className="w-full h-full object-cover object-top" alt="" /> : '🐱'}
        </div>
        <input
          value={perfil.apodo}
          onChange={(e) => actualizarPerfil({ apodo: e.target.value })}
          className="font-display text-3xl text-center bg-transparent mt-3 w-full"
        />
        <p className="text-xs uppercase tracking-widest text-neutral-400">Mi Perfil De Estilo</p>
      </div>

      <div className="space-y-4">
        <Ciudad perfil={perfil} />
        <Estilo perfil={perfil} />
        <Colorimetria perfil={perfil} />
        <Medidas perfil={perfil} />
        <FotoCuerpo perfil={perfil} />
        <Gustos perfil={perfil} />
      </div>
    </Pantalla>
  )
}

function Seccion({ icono, titulo, children, valor }: { icono: string; titulo: string; children: React.ReactNode; valor?: string }) {
  const [abierta, setAbierta] = useState(false)
  return (
    <Tarjeta className="!p-0 overflow-hidden">
      <button onClick={() => setAbierta(!abierta)} className="w-full flex items-center gap-3 p-5 text-left">
        <span className="text-2xl">{icono}</span>
        <span className="flex-1">
          <span className="block font-semibold uppercase tracking-wide text-sm">{titulo}</span>
          <span className={`block text-sm ${valor ? 'text-neutral-600' : 'text-rosa-500'}`}>{valor || 'Completar →'}</span>
        </span>
        <span className={`transition ${abierta ? 'rotate-90' : ''}`}>›</span>
      </button>
      {abierta && <div className="px-5 pb-5 space-y-3">{children}</div>}
    </Tarjeta>
  )
}

/* ---------- Ciudad ---------- */
function Ciudad({ perfil }: { perfil: P }) {
  const [q, setQ] = useState('')
  const [res, setRes] = useState<Ciudad[]>([])
  useEffect(() => {
    const t = setTimeout(() => buscarCiudades(q).then(setRes).catch(() => setRes([])), 350)
    return () => clearTimeout(t)
  }, [q])
  return (
    <Seccion icono="📍" titulo="Mi Ciudad" valor={perfil.ciudad ? `${perfil.ciudad} · Hemisferio ${perfil.hemisferio}` : ''}>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Escribe tu ciudad…"
        className="w-full h-12 rounded-2xl border-2 border-rosa-200 px-4 bg-rosa-50"
      />
      {res.map((c) => (
        <button
          key={`${c.lat}${c.lon}`}
          onClick={async () => {
            await actualizarPerfil({ ciudad: `${c.nombre}, ${c.pais}`, lat: c.lat, lon: c.lon, hemisferio: c.lat < 0 ? 'Sur' : 'Norte' })
            setQ('')
            setRes([])
            avisar(`📍 ${c.nombre}`)
          }}
          className="w-full text-left px-4 py-3 rounded-2xl bg-rosa-50 font-semibold"
        >
          {c.nombre} <span className="text-neutral-400 font-normal">· {c.pais}</span>
        </button>
      ))}
    </Seccion>
  )
}

/* ---------- Estilo ---------- */
function Estilo({ perfil }: { perfil: P }) {
  const sel = [perfil.estiloPrincipal, perfil.estiloSecundario].filter(Boolean) as string[]
  async function tocar(e: string) {
    let n = sel.includes(e) ? sel.filter((x) => x !== e) : [...sel, e]
    if (n.length > 2) n = n.slice(-2)
    await actualizarPerfil({ estiloPrincipal: n[0], estiloSecundario: n[1] })
  }
  return (
    <Seccion icono="💫" titulo="Mi Estilo" valor={sel.join(' + ')}>
      <p className="text-xs text-neutral-500">Elige 1 o 2. El primero es tu estilo principal.</p>
      <div className="grid grid-cols-3 gap-2">
        {ESTILOS.map((e) => {
          const i = sel.indexOf(e)
          return (
            <button
              key={e}
              onClick={() => tocar(e)}
              className={`relative rounded-2xl py-4 flex flex-col items-center gap-1 border-2 ${i >= 0 ? 'bg-tinta text-white border-tinta' : 'bg-rosa-50 border-rosa-100'}`}
            >
              {i >= 0 && <span className="absolute top-1 right-2 text-[10px] font-bold">{i + 1}</span>}
              <span className="text-2xl">{ICONO_ESTILO[e]}</span>
              <span className="text-[11px] font-bold uppercase">{e}</span>
            </button>
          )
        })}
      </div>
    </Seccion>
  )
}

/* ---------- Colorimetría ---------- */
function Colorimetria({ perfil }: { perfil: P }) {
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [explicacion, setExplicacion] = useState('')
  async function analizar(f: File[]) {
    setCargando(true)
    setError('')
    try {
      const r = await analizarColorimetria(await prepararFoto(f[0]))
      await actualizarPerfil({ colorimetria: r.estacion, subtono: r.subtono, cabello: r.cabello, ojos: r.ojos, paleta: [...(r.paleta ?? []), ...(r.evitar ?? []).map((c) => '!' + c)] })
      setExplicacion(r.explicacion)
    } catch (e) {
      setError(traducirError(e))
    } finally {
      setCargando(false)
    }
  }
  const favorece = (perfil.paleta ?? []).filter((c) => !c.startsWith('!'))
  const evitar = (perfil.paleta ?? []).filter((c) => c.startsWith('!')).map((c) => c.slice(1))
  return (
    <Seccion icono="🎨" titulo="Mi Colorimetría" valor={perfil.colorimetria}>
      {cargando ? (
        <Cargando texto="Leyendo tus colores…" />
      ) : (
        <BotonArchivo icono="🤳" alElegir={analizar}>
          {perfil.colorimetria ? 'Analizar De Nuevo' : 'Selfie Con Luz Natural'}
        </BotonArchivo>
      )}
      {error && <Aviso tipo="error">{error}</Aviso>}
      {explicacion && <Aviso>{explicacion}</Aviso>}
      {favorece.length > 0 && (
        <>
          <Paleta titulo="✓ Te Favorecen" colores={favorece} />
          {evitar.length > 0 && <Paleta titulo="✕ Mejor Evitar" colores={evitar} />}
          <div className="flex flex-wrap gap-2 text-xs">
            {perfil.subtono && <Pastilla>Subtono {perfil.subtono}</Pastilla>}
            {perfil.cabello && <Pastilla>Cabello {perfil.cabello}</Pastilla>}
            {perfil.ojos && <Pastilla>Ojos {perfil.ojos}</Pastilla>}
          </div>
        </>
      )}
      <p className="text-xs font-bold uppercase tracking-widest text-neutral-500 pt-2">¿Ya La Conoces? Elige</p>
      <select
        value={perfil.colorimetria ?? ''}
        onChange={(e) => actualizarPerfil({ colorimetria: e.target.value })}
        className="w-full h-12 rounded-2xl border-2 border-rosa-200 px-4 bg-white font-semibold"
      >
        <option value="">—</option>
        {ESTACIONES.map((e) => (
          <option key={e}>{e}</option>
        ))}
      </select>
    </Seccion>
  )
}

function Paleta({ titulo, colores }: { titulo: string; colores: string[] }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-2">{titulo}</p>
      <div className="flex gap-1.5">
        {colores.map((c) => (
          <span key={c} className="flex-1 h-10 rounded-xl border border-black/5" style={{ background: c }} />
        ))}
      </div>
    </div>
  )
}

const Pastilla = ({ children }: { children: React.ReactNode }) => <span className="bg-rosa-100 rounded-full px-3 py-1 font-semibold">{children}</span>

/* ---------- Medidas ---------- */
function Medidas({ perfil }: { perfil: P }) {
  const tipo = calcularTipoCuerpo(perfil)
  const campos: [keyof P, string][] = [
    ['altura', 'Altura'],
    ['hombros', 'Hombros'],
    ['busto', 'Busto'],
    ['cintura', 'Cintura'],
    ['cadera', 'Cadera'],
  ]
  return (
    <Seccion icono="📏" titulo="Mis Medidas" valor={tipo ? `${tipo.icono} ${tipo.nombre}` : ''}>
      <div className="grid grid-cols-2 gap-2">
        {campos.map(([k, t]) => (
          <label key={k} className="bg-rosa-50 rounded-2xl px-4 py-2">
            <span className="block text-[10px] font-bold uppercase tracking-widest text-neutral-500">{t} (cm)</span>
            <input
              type="number"
              inputMode="decimal"
              value={(perfil[k] as number | undefined) ?? ''}
              onChange={async (e) => {
                const v = e.target.value ? Number(e.target.value) : undefined
                const nuevo = { ...perfil, [k]: v }
                await actualizarPerfil({ [k]: v, tipoCuerpo: calcularTipoCuerpo(nuevo)?.nombre })
              }}
              className="w-full bg-transparent text-xl font-semibold"
            />
          </label>
        ))}
      </div>
      {tipo && (
        <div className="bg-tinta text-white rounded-2xl p-4 flex gap-3 items-center">
          <span className="text-4xl">{tipo.icono}</span>
          <div>
            <p className="font-semibold uppercase tracking-wide">{tipo.nombre}</p>
            <p className="text-sm text-white/80">{tipo.consejo}</p>
          </div>
        </div>
      )}
    </Seccion>
  )
}

/* ---------- Foto de cuerpo ---------- */
function FotoCuerpo({ perfil }: { perfil: P }) {
  const url = useUrl(perfil.fotoCuerpo)
  return (
    <Seccion icono="🧍‍♀️" titulo="Foto Para Probador" valor={perfil.fotoCuerpo ? 'Lista ✓' : ''}>
      {url && <img src={url} className="w-1/2 mx-auto rounded-2xl" alt="" />}
      <BotonArchivo
        icono="📸"
        variante={perfil.fotoCuerpo ? 'secundario' : 'principal'}
        alElegir={async (f) => (await actualizarPerfil({ fotoCuerpo: await prepararFoto(f[0]) }), avisar('📸 Foto lista'))}
      >
        {perfil.fotoCuerpo ? 'Cambiar Foto' : 'Subir Foto'}
      </BotonArchivo>
      <p className="text-xs text-neutral-500">Cuerpo entero, de frente, ropa ajustada, fondo liso. Se guarda solo en tus dispositivos y tu Drive.</p>
    </Seccion>
  )
}

/* ---------- Gustos ---------- */
function Gustos({ perfil }: { perfil: P }) {
  const [nuevo, setNuevo] = useState('')
  return (
    <Seccion icono="💖" titulo="Mi Día A Día" valor={perfil.ocasiones.join(', ')}>
      <p className="text-xs font-bold uppercase tracking-widest text-neutral-500">Lo Que Más Hago</p>
      <Chips opciones={OCASIONES} valor={perfil.ocasiones as (typeof OCASIONES)[number][]} multiple alCambiar={(v) => actualizarPerfil({ ocasiones: v })} />
      <p className="text-xs font-bold uppercase tracking-widest text-neutral-500 pt-2">No Me Gusta</p>
      <div className="flex flex-wrap gap-2">
        {perfil.noMeGusta.map((x) => (
          <button key={x} onClick={() => actualizarPerfil({ noMeGusta: perfil.noMeGusta.filter((y) => y !== x) })} className="px-3 h-9 rounded-full bg-rosa-100 text-sm font-semibold">
            🚫 {x} ✕
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={nuevo}
          onChange={(e) => setNuevo(e.target.value)}
          placeholder="Ej. Crop Tops, Amarillo…"
          className="flex-1 h-12 rounded-2xl border-2 border-rosa-200 px-4 bg-rosa-50"
        />
        <Boton
          className="!w-auto"
          onClick={async () => {
            if (!nuevo.trim()) return
            await actualizarPerfil({ noMeGusta: [...perfil.noMeGusta, nuevo.trim()] })
            setNuevo('')
          }}
        >
          +
        </Boton>
      </div>
    </Seccion>
  )
}
