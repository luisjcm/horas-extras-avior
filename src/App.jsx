// Marco de la app: cabecera, selector de módulo (individual / masivo) y avisos.
// Firmantes, quincena y horario son comunes a los dos módulos.
import { useRef, useState } from 'react'
import { SelectorModo } from './components/secciones.jsx'
import { usePersistentState } from './hooks/usePersistentState.js'
import { CLAVE, estadoInicial, migrateState } from './lib/estado.js'
import { corteSugerido } from './lib/periodo.js'
import Individual from './modos/Individual.jsx'
import Masivo from './modos/Masivo.jsx'

export default function App() {
  const [estado, setEstado] = usePersistentState(CLAVE, estadoInicial, migrateState)
  const [vistas, setVistas] = useState(() => ({
    individual: estado.generado ? 'resultado' : 'captura',
    masivo: estado.masivo.generado ? 'resultado' : 'captura',
  }))
  const [aviso, setAviso] = useState(null)
  const timerAviso = useRef(null)

  const modo = estado.modo
  const vista = vistas[modo]
  const setVista = (v) => setVistas((x) => ({ ...x, [modo]: v }))
  const generado = modo === 'masivo' ? estado.masivo.generado : estado.generado

  const avisar = (texto, tono = 'info') => {
    clearTimeout(timerAviso.current)
    setAviso({ texto, tono, id: Date.now() })
    timerAviso.current = setTimeout(() => setAviso(null), 3200)
  }

  const comunes = {
    onFirmante: (clave, campo, v) =>
      setEstado((s) => ({ ...s, firmantes: { ...s.firmantes, [clave]: { ...s.firmantes[clave], [campo]: v } } })),
    onPeriodo: (anio, mes, quincena) =>
      setEstado((s) => ({ ...s, periodo: { anio, mes, quincena, ...corteSugerido(anio, mes, quincena) }, ajustes: {} })),
    onCorte: (cambio) => setEstado((s) => ({ ...s, periodo: { ...s.periodo, ...cambio } })),
  }

  const cambiarModo = (m) => {
    if (m === modo) return
    setEstado((s) => ({ ...s, modo: m }))
    setAviso(null)
    window.scrollTo({ top: 0 })
  }

  const Modulo = modo === 'masivo' ? Masivo : Individual

  return (
    <div className="min-h-screen bg-page pb-32 text-avior-ink">
      <header className="sticky top-0 z-20 bg-avior pt-[env(safe-area-inset-top)] shadow-lg shadow-black/50">
        <div className="mx-auto flex max-w-3xl items-baseline justify-between px-4 py-3">
          <p className="text-sm font-black tracking-[0.18em] text-white">AVIOR AIRLINES · IT</p>
          <p className="text-xs font-medium text-white/80">Horas extras · {modo === 'masivo' ? 'Masivo' : 'Individual'}</p>
        </div>
        <nav className="bg-avior-nav">
          <div className="mx-auto flex max-w-3xl">
            {[
              ['captura', 'Captura'],
              ['resultado', modo === 'masivo' ? 'Formatos' : 'Formato'],
            ].map(([k, t]) => (
              <button
                key={k}
                type="button"
                disabled={k === 'resultado' && !generado}
                onClick={() => setVista(k)}
                className={`flex-1 py-3 text-sm font-semibold transition disabled:opacity-40 ${
                  vista === k ? 'bg-avior-bright text-white' : 'text-avior-muted hover:brightness-110'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </nav>
      </header>

      <Modulo
        key={modo}
        estado={estado}
        setEstado={setEstado}
        comunes={comunes}
        avisar={avisar}
        vista={vista}
        setVista={setVista}
        selector={<SelectorModo modo={modo} onModo={cambiarModo} />}
      />

      {aviso && (
        <div
          key={aviso.id}
          role="status"
          className={`fixed inset-x-3 bottom-[calc(88px+env(safe-area-inset-bottom))] z-30 mx-auto max-w-md animate-rise rounded-lg px-4 py-3 text-center text-sm font-medium shadow-xl shadow-black/60 ${
            aviso.tono === 'error'
              ? 'bg-red-900 text-red-100'
              : aviso.tono === 'ok'
                ? 'bg-emerald-900 text-emerald-100'
                : 'bg-avior-nav text-avior-ink'
          }`}
        >
          {aviso.texto}
        </div>
      )}
    </div>
  )
}
