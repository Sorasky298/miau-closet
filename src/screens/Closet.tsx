import { useMemo, useState } from 'react'
import { useMoneda } from '../lib/moneda'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, ahora, leerAjuste, guardarAjuste, type Prenda, type EstadoPrenda, type Temporada } from '../db'
import { Pantalla, Titulo, Chips, Hoja, Boton, Aviso } from '../components/ui'
import { FotoPrenda, avisar } from '../components/comunes'
import EditorPrenda from '../components/EditorPrenda'
import { TEMPORADAS, ICONO_TEMPORADA } from '../lib/temporadas'
import { registrarBorrado } from '../lib/sync'
import { fotoCatalogo } from '../lib/ia'
import { traducirError, COSTO_IMAGEN_USD } from '../lib/gemini'

export const GRUPOS: Record<string, string[]> = {
  Arriba: ['Top', 'Blusa', 'Camisa', 'Polo', 'Chompa', 'Cárdigan', 'Polera'],
  Abrigos: ['Casaca', 'Blazer', 'Abrigo', 'Chaleco'],
  Abajo: ['Pantalón', 'Jean', 'Falda', 'Short', 'Leggings'],
  Vestidos: ['Vestido', 'Enterizo'],
  Calzado: ['Zapatos', 'Zapatillas', 'Botas', 'Sandalias', 'Tacones'],
  Accesorios: ['Cinturón', 'Cartera', 'Bufanda', 'Gorro', 'Accesorio', 'Joyería'],
  Básicos: ['Ropa Interior', 'Deporte', 'Pijama', 'Baño'],
}
const ICONO_GRUPO: Record<string, string> = { Arriba: '👚', Abrigos: '🧥', Abajo: '👖', Vestidos: '👗', Calzado: '👠', Accesorios: '👜', Básicos: '🩱' }
const ESPECIALES = ['Favoritas', 'Sin Usar', 'Donar / Vender'] as const
const ICONO_ESPECIAL = { Favoritas: '❤️', 'Sin Usar': '😴', 'Donar / Vender': '📦' }

export const sinUsar = (p: Prenda) => {
  const ref = p.ultimaVez ?? p.creadoEn
  return Date.now() - new Date(ref).getTime() > 180 * 864e5
}

export default function Closet({ verOutfitsCon }: { verOutfitsCon: (id: string) => void }) {
  const todas = useLiveQuery(() => db.prendas.filter((p) => !p.pendienteRevision).toArray(), [], [])
  const [grupo, setGrupo] = useState<string>()
  const [temporada, setTemporada] = useState<Temporada>()
  const [especial, setEspecial] = useState<(typeof ESPECIALES)[number]>()
  const [busca, setBusca] = useState('')
  const [detalle, setDetalle] = useState<Prenda | null>(null)

  const lista = useMemo(() => {
    const q = busca.toLowerCase()
    return todas
      .filter((p) => (especial === 'Donar / Vender' ? p.estado === 'Donar' || p.estado === 'Vender' : p.estado !== 'Donar' && p.estado !== 'Vender'))
      .filter((p) => !grupo || GRUPOS[grupo].includes(p.categoria))
      .filter((p) => !temporada || p.atemporal || p.temporadas.includes(temporada))
      .filter((p) => especial !== 'Favoritas' || p.favorita)
      .filter((p) => especial !== 'Sin Usar' || sinUsar(p))
      .filter((p) => !q || `${p.nombre} ${p.colorPrincipal} ${p.marca ?? ''} ${p.categoria}`.toLowerCase().includes(q))
      .sort((a, b) => b.creadoEn.localeCompare(a.creadoEn))
  }, [todas, grupo, temporada, especial, busca])

  const prendaViva = detalle ? (todas.find((p) => p.id === detalle.id) ?? null) : null

  return (
    <Pantalla>
      <Titulo sub={`${todas.length} prendas`}>Mi Clóset</Titulo>

      <input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="🔍  Buscar: negro, jean, Zara…"
        className="w-full h-12 rounded-2xl border-2 border-rosa-200 px-4 bg-white mb-3"
      />

      <div className="flex gap-2 overflow-x-auto ocultar-scroll -mx-5 px-5 pb-2">
        {Object.keys(GRUPOS).map((g) => (
          <button
            key={g}
            onClick={() => setGrupo(grupo === g ? undefined : g)}
            className={`shrink-0 flex flex-col items-center w-16 py-2 rounded-2xl border-2 ${grupo === g ? 'bg-tinta text-white border-tinta' : 'bg-white border-rosa-100'}`}
          >
            <span className="text-2xl">{ICONO_GRUPO[g]}</span>
            <span className="text-[10px] font-bold uppercase">{g}</span>
          </button>
        ))}
      </div>

      <div className="flex gap-2 overflow-x-auto ocultar-scroll -mx-5 px-5 py-2">
        <Chips fila opciones={TEMPORADAS} valor={temporada} iconos={ICONO_TEMPORADA} alCambiar={(v) => setTemporada(v[0])} />
      </div>
      <div className="flex gap-2 overflow-x-auto ocultar-scroll -mx-5 px-5 pb-3">
        <Chips fila opciones={ESPECIALES} valor={especial} iconos={ICONO_ESPECIAL} alCambiar={(v) => setEspecial(v[0])} />
      </div>

      {lista.length === 0 ? (
        <p className="text-center text-neutral-400 py-12">Nada por aquí 🐾</p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {lista.map((p) => (
            <button key={p.id} onClick={() => setDetalle(p)} className="relative bg-white rounded-2xl border border-rosa-100 aspect-square p-1.5 active:scale-95 transition">
              <FotoPrenda prenda={p} className="w-full h-full" />
              {p.favorita && <span className="absolute top-1 right-1 text-xs">❤️</span>}
              {p.estado === 'Guardada' && <span className="absolute top-1 left-1 text-xs">📦</span>}
            </button>
          ))}
        </div>
      )}

      <DetallePrenda prenda={prendaViva} alCerrar={() => setDetalle(null)} verOutfitsCon={verOutfitsCon} />
    </Pantalla>
  )
}

const ESTADOS: EstadoPrenda[] = ['Activa', 'Guardada', 'Donar', 'Vender']
const ICONO_ESTADO: Record<EstadoPrenda, string> = { Activa: '✅', Guardada: '📦', Donar: '🎁', Vender: '💸' }

export function DetallePrenda({ prenda, alCerrar, verOutfitsCon }: { prenda: Prenda | null; alCerrar: () => void; verOutfitsCon: (id: string) => void }) {
  const [editar, setEditar] = useState(false)
  const [confirmarCosto, setConfirmarCosto] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const { formato } = useMoneda()
  if (!prenda) return null
  const p = prenda
  const act = (c: Partial<Prenda>) => db.prendas.update(p.id, { ...c, actualizadoEn: ahora() })

  async function usadaHoy() {
    const hoy = ahora()
    await act({ vecesUsada: p.vecesUsada + 1, ultimaVez: hoy })
    avisar('👗 Anotado: usada hoy')
  }

  async function catalogo() {
    if (!(await leerAjuste('avisoCostoAceptado', false)) && !confirmarCosto) return setConfirmarCosto(true)
    await guardarAjuste('avisoCostoAceptado', true)
    setConfirmarCosto(false)
    setCargando(true)
    setError('')
    try {
      const img = await fotoCatalogo(p.fotoRecorte ?? p.fotoOriginal)
      await act({ fotoCatalogo: img })
      avisar('✨ Foto de catálogo lista')
    } catch (e) {
      setError(traducirError(e))
    } finally {
      setCargando(false)
    }
  }

  async function eliminar() {
    await db.prendas.delete(p.id)
    await registrarBorrado('prendas', p.id)
    alCerrar()
    avisar('🗑 Prenda eliminada')
  }

  const buscar = () =>
    window.open(`https://www.google.com/search?udm=28&q=${encodeURIComponent(`${p.categoria} ${p.colorPrincipal} ${p.material ?? ''} ${p.marca ?? ''} mujer`)}`, '_blank')

  return (
    <>
      <Hoja abierta={!editar} alCerrar={alCerrar}>
        <div className="space-y-4">
          <div className="relative bg-white rounded-3xl p-4">
            <FotoPrenda prenda={p} className="w-full aspect-square" />
            <button onClick={() => act({ favorita: !p.favorita })} className="absolute top-3 right-3 w-11 h-11 rounded-full bg-rosa-50 text-xl">
              {p.favorita ? '❤️' : '🤍'}
            </button>
          </div>
          <div className="text-center">
            <h2 className="font-display text-2xl">{p.nombre}</h2>
            <p className="text-sm text-neutral-500">
              {p.categoria} · {p.colorPrincipal}
              {p.marca ? ` · ${p.marca}` : ''}
            </p>
            <div className="flex justify-center gap-2 mt-2 flex-wrap">
              <Etiqueta>{p.atemporal ? '♾️ Todo El Año' : p.temporadas.map((t) => ICONO_TEMPORADA[t]).join(' ')}</Etiqueta>
              <Etiqueta>👗 {p.vecesUsada} Usos</Etiqueta>
              {p.ubicacion && <Etiqueta>📍 {p.ubicacion}</Etiqueta>}
            </div>
            {p.motivoAtemporal && <p className="text-xs text-neutral-400 mt-2">{p.motivoAtemporal}</p>}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Boton icono="👗" onClick={usadaHoy}>
              Lo Usé Hoy
            </Boton>
            <Boton variante="suave" icono="✨" onClick={() => (alCerrar(), verOutfitsCon(p.id))}>
              Combinar
            </Boton>
            <Boton variante="secundario" icono="🔍" onClick={buscar}>
              Similares
            </Boton>
            <Boton variante="secundario" icono="✏️" onClick={() => setEditar(true)}>
              Editar
            </Boton>
          </div>

          {confirmarCosto ? (
            <div className="bg-white rounded-2xl p-4 text-center space-y-3 border-2 border-rosa-200">
              <p className="font-semibold">💳 ≈ {formato(COSTO_IMAGEN_USD)} · Lo Paga Tu Google</p>
              <div className="grid grid-cols-2 gap-2">
                <Boton onClick={catalogo}>Sí, Crear</Boton>
                <Boton variante="secundario" onClick={() => setConfirmarCosto(false)}>
                  No
                </Boton>
              </div>
            </div>
          ) : (
            <Boton variante="suave" icono="📸" onClick={catalogo} disabled={cargando}>
              {cargando ? 'Creando…' : p.fotoCatalogo ? 'Nueva Foto Catálogo' : 'Foto Catálogo IA'}
            </Boton>
          )}
          {p.fotoCatalogo && (
            <button className="w-full text-xs text-neutral-500 underline" onClick={() => act({ fotoCatalogo: undefined })}>
              Volver A Mi Foto
            </button>
          )}
          {error && <Aviso tipo="error">{error}</Aviso>}

          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-2">Estado</p>
            <Chips opciones={ESTADOS} valor={p.estado} iconos={ICONO_ESTADO} alCambiar={(v) => v[0] && act({ estado: v[0] })} />
          </div>

          <button onClick={eliminar} className="w-full text-sm text-rosa-500 font-semibold py-2">
            🗑 Eliminar Prenda
          </button>
        </div>
      </Hoja>
      <EditorPrenda prenda={editar ? { ...p, fotoOriginal: p.fotoOriginal } : null} alCerrar={() => setEditar(false)} />
    </>
  )
}

function Etiqueta({ children }: { children: React.ReactNode }) {
  return <span className="text-xs font-semibold bg-white border border-rosa-100 rounded-full px-3 py-1">{children}</span>
}

