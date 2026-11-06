import { useEffect, useState } from 'react'
import { Boton, Tarjeta, Titulo, Aviso, Pantalla } from '../components/ui'
import { obtenerLlave, guardarLlave, probarLlave, modeloTexto, MODELO_TEXTO_DEFECTO } from '../lib/gemini'
import { googleDisponible, entrarConGoogle, salirDeGoogle, guardarConfigNube, type UsuarioGoogle } from '../lib/google'
import { leerAjuste, guardarAjuste } from '../db'

export default function Ajustes({ volver }: { volver: () => void }) {
  const [llave, setLlave] = useState('')
  const [estado, setEstado] = useState<{ tipo: 'ok' | 'error' | 'info'; texto: string } | null>(null)
  const [usuario, setUsuario] = useState<UsuarioGoogle | null>(null)
  const [modelo, setModelo] = useState(MODELO_TEXTO_DEFECTO)
  const [probador, setProbador] = useState(false)
  const [tope, setTope] = useState(4)

  useEffect(() => {
    ;(async () => {
      setLlave(await obtenerLlave())
      setUsuario(await leerAjuste<UsuarioGoogle | null>('googleUsuario', null))
      setModelo(await modeloTexto())
      setProbador(await leerAjuste('probadorAutomatico', false))
      setTope(await leerAjuste('topeDiarioImagenes', 4))
    })()
  }, [])

  async function probar() {
    setEstado({ tipo: 'info', texto: 'Probando conexión…' })
    const r = await probarLlave(llave)
    if (r.ok) {
      await guardarLlave(llave)
      if (usuario) await guardarConfigNube({ llaveIa: llave.trim() }).catch(() => undefined)
      setEstado({ tipo: 'ok', texto: 'Conexión correcta ✅' })
    } else setEstado({ tipo: 'error', texto: r.error ?? 'No funcionó' })
  }

  const oculta = llave ? `${llave.slice(0, 6)}••••••${llave.slice(-4)}` : 'Sin conectar'

  return (
    <Pantalla>
      <button onClick={volver} className="text-sm font-semibold uppercase tracking-wide mb-4">
        ← Volver
      </button>
      <Titulo>Ajustes</Titulo>

      <div className="space-y-4">
        <Tarjeta className="space-y-3">
          <h2 className="font-semibold uppercase tracking-wide text-sm">🔑 Llave IA</h2>
          <p className="text-sm text-neutral-500">Actual: {oculta}</p>
          <input
            value={llave}
            onChange={(e) => setLlave(e.target.value)}
            placeholder="AIza…"
            className="w-full rounded-2xl border-2 border-rosa-200 px-4 py-3 bg-rosa-50 text-sm"
            autoCapitalize="off"
            autoCorrect="off"
          />
          <Boton onClick={probar} icono="⚡">
            Probar Conexión
          </Boton>
          <Boton variante="secundario" icono="↗" onClick={() => window.open('https://aistudio.google.com/apikey', '_blank')}>
            Abrir AI Studio
          </Boton>
          {estado && <Aviso tipo={estado.tipo}>{estado.texto}</Aviso>}
        </Tarjeta>

        <Tarjeta className="space-y-3">
          <h2 className="font-semibold uppercase tracking-wide text-sm">👤 Cuenta Google</h2>
          {usuario ? (
            <>
              <div className="flex items-center gap-3">
                {usuario.foto && <img src={usuario.foto} className="w-10 h-10 rounded-full" alt="" />}
                <div>
                  <p className="font-semibold">{usuario.nombre}</p>
                  <p className="text-sm text-neutral-500">{usuario.email}</p>
                </div>
              </div>
              <Boton variante="peligro" onClick={async () => (await salirDeGoogle(), setUsuario(null))}>
                Cerrar Sesión
              </Boton>
            </>
          ) : googleDisponible() ? (
            <Boton icono="G" onClick={async () => setUsuario(await entrarConGoogle())}>
              Entrar con Google
            </Boton>
          ) : (
            <Aviso>Pendiente: configurar Client ID de Google.</Aviso>
          )}
        </Tarjeta>

        <Tarjeta className="space-y-3">
          <h2 className="font-semibold uppercase tracking-wide text-sm">🪄 Probador Automático</h2>
          <p className="text-sm text-neutral-500">
            Genera la imagen del outfit puesto dentro de la app. Tiene costo por imagen (~US$0.03–0.07) o usa tus créditos de Google AI Pro. Apagado,
            igual puedes usar Probar en Gemini o Probar en ChatGPT gratis.
          </p>
          <Interruptor
            activo={probador}
            alCambiar={async (v) => (setProbador(v), await guardarAjuste('probadorAutomatico', v))}
            texto={probador ? 'Activado' : 'Apagado'}
          />
          {probador && (
            <label className="flex items-center justify-between text-sm">
              <span>Tope de imágenes por día</span>
              <input
                type="number"
                min={1}
                max={20}
                value={tope}
                onChange={async (e) => {
                  const v = Math.max(1, Number(e.target.value) || 1)
                  setTope(v)
                  await guardarAjuste('topeDiarioImagenes', v)
                }}
                className="w-20 rounded-xl border-2 border-rosa-200 px-3 py-2 text-center"
              />
            </label>
          )}
        </Tarjeta>

        <Tarjeta className="space-y-3">
          <h2 className="font-semibold uppercase tracking-wide text-sm">⚙️ Avanzado</h2>
          <label className="block text-sm">
            Modelo de IA
            <input
              value={modelo}
              onChange={async (e) => (setModelo(e.target.value), await guardarAjuste('modeloTexto', e.target.value))}
              className="mt-1 w-full rounded-2xl border-2 border-rosa-200 px-4 py-3 bg-rosa-50"
            />
          </label>
        </Tarjeta>
      </div>
    </Pantalla>
  )
}

function Interruptor({ activo, alCambiar, texto }: { activo: boolean; alCambiar: (v: boolean) => void; texto: string }) {
  return (
    <button onClick={() => alCambiar(!activo)} className="flex items-center gap-3">
      <span className={`w-14 h-8 rounded-full p-1 transition ${activo ? 'bg-tinta' : 'bg-rosa-200'}`}>
        <span className={`block w-6 h-6 rounded-full bg-white shadow transition ${activo ? 'translate-x-6' : ''}`} />
      </span>
      <span className="font-semibold">{texto}</span>
    </button>
  )
}
