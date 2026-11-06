import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Prenda } from '../db'
import { Pantalla, Titulo, Boton, Aviso, Cargando, Volver, Mosaico } from '../components/ui'
import { BotonArchivo, FotoPrenda } from '../components/comunes'
import { analizarBrechas, antesDeComprar, type BrechaIa, type VeredictoIa } from '../lib/ia'
import { prepararFoto, useUrl } from '../lib/imagen'
import { traducirError } from '../lib/gemini'
import { temporadaActual, siguienteTemporada, ICONO_TEMPORADA } from '../lib/temporadas'

export default function Compras({ volver }: { volver: () => void }) {
  const [modo, setModo] = useState<'menu' | 'brechas' | 'antes'>('menu')
  return (
    <Pantalla>
      <Volver onClick={() => (modo === 'menu' ? volver() : setModo('menu'))} />
      <Titulo sub="Compra menos, combina más">Compra Inteligente</Titulo>
      {modo === 'menu' && (
        <div className="grid grid-cols-2 gap-3">
          <Mosaico icono="🧩" texto="Lo Que Me Falta" sub="Prendas que suman más outfits" onClick={() => setModo('brechas')} destacado />
          <Mosaico icono="🛍️" texto="Antes De Comprar" sub="Foto en la tienda → ¿vale la pena?" onClick={() => setModo('antes')} />
        </div>
      )}
      {modo === 'brechas' && <Brechas />}
      {modo === 'antes' && <AntesDeComprar />}
    </Pantalla>
  )
}

async function prendasActivas() {
  return db.prendas.filter((p) => !p.pendienteRevision && p.estado !== 'Donar' && p.estado !== 'Vender').toArray()
}

function Brechas() {
  const perfil = useLiveQuery(() => db.perfil.get('yo'))
  const hem = perfil?.hemisferio ?? 'Norte'
  const proxima = siguienteTemporada(temporadaActual(hem))
  const [temporada, setTemporada] = useState(temporadaActual(hem))
  const [r, setR] = useState<{ resumen: string; faltantes: BrechaIa[] }>()
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  async function analizar() {
    setCargando(true)
    setError('')
    try {
      setR(await analizarBrechas(await prendasActivas(), perfil, temporada))
    } catch (e) {
      setError(traducirError(e))
    } finally {
      setCargando(false)
    }
  }

  const PRIORIDAD = { Alta: 'bg-tinta text-white', Media: 'bg-rosa-300', Baja: 'bg-rosa-100' }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {[temporadaActual(hem), proxima].map((t) => (
          <button
            key={t}
            onClick={() => setTemporada(t)}
            className={`h-14 rounded-2xl font-semibold border-2 ${temporada === t ? 'bg-tinta text-white border-tinta' : 'bg-white border-rosa-200'}`}
          >
            {ICONO_TEMPORADA[t]} {t}
          </button>
        ))}
      </div>
      <Boton icono="🧩" onClick={analizar} disabled={cargando}>
        {cargando ? 'Analizando…' : 'Analizar Mi Clóset'}
      </Boton>
      {cargando && <Cargando texto="Revisando combinaciones…" />}
      {error && <Aviso tipo="error">{error}</Aviso>}
      {r && (
        <>
          <Aviso>{r.resumen}</Aviso>
          {r.faltantes.map((f, i) => (
            <div key={i} className="bg-white rounded-3xl p-4 border border-rosa-100 flex gap-4 items-center">
              <span className="w-14 h-14 rounded-2xl shrink-0 border border-black/5" style={{ background: f.colorHex ?? '#eee' }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold">{f.prenda}</p>
                  <span className={`text-[10px] font-bold uppercase rounded-full px-2 py-0.5 ${PRIORIDAD[f.prioridad] ?? 'bg-rosa-100'}`}>{f.prioridad}</span>
                </div>
                <p className="text-sm text-neutral-500">{f.motivo}</p>
                <p className="text-xs font-semibold mt-1">+{f.outfitsNuevos} outfits nuevos</p>
              </div>
              <button
                onClick={() => window.open(`https://www.google.com/search?udm=28&q=${encodeURIComponent(f.prenda + ' mujer')}`, '_blank')}
                className="w-11 h-11 rounded-full bg-rosa-100 text-lg shrink-0"
                aria-label="Buscar"
              >
                🔍
              </button>
            </div>
          ))}
        </>
      )}
    </div>
  )
}

function AntesDeComprar() {
  const perfil = useLiveQuery(() => db.perfil.get('yo'))
  const [foto, setFoto] = useState<Blob>()
  const [r, setR] = useState<VeredictoIa>()
  const [prendas, setPrendas] = useState<Prenda[]>([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const url = useUrl(foto)

  async function evaluar(f: File[]) {
    setCargando(true)
    setError('')
    setR(undefined)
    try {
      const img = await prepararFoto(f[0])
      setFoto(img)
      const lista = await prendasActivas()
      setPrendas(lista)
      setR(await antesDeComprar(img, lista, perfil))
    } catch (e) {
      setError(traducirError(e))
    } finally {
      setCargando(false)
    }
  }

  const COLOR = { 'Cómpralo': 'bg-emerald-600', 'Piénsalo': 'bg-amber-500', 'Déjalo': 'bg-rosa-500' }
  const ICONO = { 'Cómpralo': '🛍️', 'Piénsalo': '🤔', 'Déjalo': '✋' }

  return (
    <div className="space-y-4">
      <BotonArchivo icono="📸" capture alElegir={evaluar}>
        Foto De La Prenda
      </BotonArchivo>
      <BotonArchivo icono="🖼️" variante="secundario" alElegir={evaluar}>
        Desde Galería
      </BotonArchivo>
      {cargando && <Cargando texto="Comparando con tu clóset…" />}
      {error && <Aviso tipo="error">{error}</Aviso>}
      {r && url && (
        <div className="bg-white rounded-[2rem] overflow-hidden border border-rosa-100">
          <div className="relative">
            <img src={url} className="w-full aspect-square object-cover" alt="" />
            <span className={`absolute bottom-3 left-3 text-white font-display text-2xl uppercase px-5 py-2 rounded-full ${COLOR[r.veredicto] ?? 'bg-tinta'}`}>
              {ICONO[r.veredicto]} {r.veredicto}
            </span>
          </div>
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="bg-rosa-50 rounded-2xl py-3">
                <p className="font-display text-3xl">+{r.outfitsNuevos}</p>
                <p className="text-[10px] font-bold uppercase">Outfits Nuevos</p>
              </div>
              <div className="bg-rosa-50 rounded-2xl py-3">
                <p className="text-3xl">{r.vaConTuPaleta ? '🎨✓' : '🎨✕'}</p>
                <p className="text-[10px] font-bold uppercase">Tu Paleta</p>
              </div>
            </div>
            <p className="text-neutral-700">{r.motivo}</p>
            {r.parecidas.length > 0 && <Fila titulo="⚠️ Ya Tienes Algo Parecido" ids={r.parecidas} prendas={prendas} />}
            {r.combinaCon.length > 0 && <Fila titulo="✨ Combina Con" ids={r.combinaCon} prendas={prendas} />}
          </div>
        </div>
      )}
    </div>
  )
}

function Fila({ titulo, ids, prendas }: { titulo: string; ids: number[]; prendas: Prenda[] }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-2">{titulo}</p>
      <div className="flex gap-2 overflow-x-auto ocultar-scroll">
        {ids.map((i) => (
          <FotoPrenda key={i} prenda={prendas[i]} className="w-20 h-20 shrink-0 rounded-2xl bg-rosa-50 p-1" />
        ))}
      </div>
    </div>
  )
}
