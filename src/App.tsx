import { useEffect, useState } from 'react'
import NavBar, { type Ruta } from './components/NavBar'
import { Pantalla, Titulo, Tarjeta } from './components/ui'
import Onboarding from './screens/Onboarding'
import Inicio from './screens/Inicio'
import Ajustes from './screens/Ajustes'
import { leerAjuste, pedirPersistencia } from './db'

const rutaInicial = (): Ruta => (location.hash.slice(1) as Ruta) || 'inicio'

export default function App() {
  const [listo, setListo] = useState<boolean | null>(null)
  const [ruta, setRuta] = useState<Ruta>(rutaInicial)

  useEffect(() => {
    pedirPersistencia()
    leerAjuste('onboardingListo', false).then(setListo)
    const alCambiar = () => setRuta(rutaInicial())
    addEventListener('hashchange', alCambiar)
    return () => removeEventListener('hashchange', alCambiar)
  }, [])

  const ir = (r: Ruta) => {
    location.hash = r
    scrollTo(0, 0)
  }

  if (listo === null) return null
  if (!listo) return <Onboarding alTerminar={() => setListo(true)} />

  return (
    <>
      {ruta === 'inicio' && <Inicio ir={ir} />}
      {ruta === 'ajustes' && <Ajustes volver={() => ir('inicio')} />}
      {ruta === 'closet' && <EnConstruccion titulo="Mi Clóset" />}
      {ruta === 'agregar' && <EnConstruccion titulo="Agregar" />}
      {ruta === 'outfits' && <EnConstruccion titulo="Outfits" />}
      {ruta === 'perfil' && <EnConstruccion titulo="Mi Perfil" />}
      {ruta !== 'ajustes' && <NavBar actual={ruta} ir={ir} />}
    </>
  )
}

function EnConstruccion({ titulo }: { titulo: string }) {
  return (
    <Pantalla>
      <Titulo>{titulo}</Titulo>
      <Tarjeta>
        <p className="text-neutral-600">Módulo en desarrollo.</p>
      </Tarjeta>
    </Pantalla>
  )
}
