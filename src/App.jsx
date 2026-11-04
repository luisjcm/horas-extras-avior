import { useMemo, useRef, useState } from 'react'
import {
  Calculator, CalendarRange, CalendarDays, Download, FilePlus2, Fingerprint, Headset,
  ListChecks, Pencil, PenLine, Share2, UserRound,
} from 'lucide-react'
import plantillaUrl from './assets/plantilla_horas_extras.xlsx?url'
import RevisionDias from './components/RevisionDias.jsx'
import VistaResultado from './components/VistaResultado.jsx'
import { Boton, BotonArchivo, Campo, Insignia, Seccion } from './components/ui.jsx'
import { usePersistentState } from './hooks/usePersistentState.js'
import { CLAVE, estadoInicial, migrateState, periodoPorDefecto } from './lib/estado.js'
import { llenarFormato } from './lib/formato.js'
import { interpretarHorario, sugerirTecnico } from './lib/horario.js'
import { interpretarMarcaje, marcasPorDia, sugerirEmpleado } from './lib/marcaje.js'
import { totalizar } from './lib/motor.js'
import { armarQuincena, corteSugerido, diasQuincena, digitosCedula, nombreArchivo } from './lib/periodo.js'
import { isoADmy, NOMBRES_MES } from './lib/tiempo.js'
import { ErrorArchivo, leerPrimeraHoja } from './lib/xlsxLectura.js'

const FIRMANTES = [
  { clave: 'revisor1', titulo: '22. Revisado por', ejemplo: 'Ej.: María Pérez' },
  { clave: 'revisor2', titulo: '23. Revisado por', ejemplo: 'Ej.: José Rodríguez' },
  { clave: 'aprobador', titulo: '24. Aprobado por', ejemplo: 'Ej.: Ana Gómez' },
]

const vibrar = (ms = 30) => navigator.vibrate?.(ms)

export default function App() {
  const [estado, setEstado] = usePersistentState(CLAVE, estadoInicial, migrateState)
  const [vista, setVista] = useState(estado.generado ? 'resultado' : 'captura')
  const [errores, setErrores] = useState({})
  const [aviso, setAviso] = useState(null)
  const [ocupado, setOcupado] = useState(false)
  const timerAviso = useRef(null)

  const { tecnico, firmantes, periodo, horario, columna, marcaje, empleado, ajustes, generado } = estado
  const bloqueado = Boolean(generado)

  const avisar = (texto, tono = 'info') => {
    clearTimeout(timerAviso.current)
    setAviso({ texto, tono, id: Date.now() })
    timerAviso.current = setTimeout(() => setAviso(null), 3200)
  }

  const actualizar = (cambios) => setEstado((s) => ({ ...s, ...cambios }))
  const limpiarError = (k) => errores[k] && setErrores((e) => ({ ...e, [k]: undefined }))

  const setTecnico = (k, v) => {
    limpiarError(k)
    setEstado((s) => ({ ...s, tecnico: { ...s.tecnico, [k]: v } }))
  }

  const setFirmante = (clave, campo, v) => {
    limpiarError(`${clave}-${campo}`)
    setEstado((s) => ({ ...s, firmantes: { ...s.firmantes, [clave]: { ...s.firmantes[clave], [campo]: v } } }))
  }

  const setPeriodo = (anio, mes, quincena) =>
    setEstado((s) => ({ ...s, periodo: { anio, mes, quincena, ...corteSugerido(anio, mes, quincena) }, ajustes: {} }))

  // --- Cálculo de la quincena (se recalcula en vivo)
  const dias = useMemo(() => {
    if (!horario || !columna || !marcaje || !empleado) return []
    return armarQuincena(
      diasQuincena(periodo.anio, periodo.mes, periodo.quincena),
      horario.porTecnico[columna] || {},
      marcasPorDia(marcaje, empleado),
      ajustes,
    )
  }, [horario, columna, marcaje, empleado, ajustes, periodo.anio, periodo.mes, periodo.quincena])
  const totales = useMemo(() => totalizar(dias.map((d) => d.resultado)), [dias])
  const pendientes = dias.filter((d) => ['sin-marcaje', 'incompleto', 'revisar'].includes(d.resultado.estado))
  const archivo = nombreArchivo(tecnico.nombre, periodo.anio, periodo.mes, periodo.quincena)

  // --- Carga de archivos
  async function cargar(file, tipo) {
    try {
      const { filas } = await leerPrimeraHoja(await file.arrayBuffer())
      if (tipo === 'horario') {
        const h = { archivo: file.name, ...interpretarHorario(filas) }
        const col = sugerirTecnico(tecnico.nombre, h.tecnicos)
        setEstado((s) => ({ ...s, horario: h, columna: col }))
        limpiarError('horario')
        if (col) limpiarError('columna')
        avisar(`Horario cargado: ${h.tecnicos.length} técnicos`, 'ok')
      } else {
        const m = { archivo: file.name, ...interpretarMarcaje(filas) }
        const cod = sugerirEmpleado(m.empleados, tecnico.cedula, tecnico.nombre)
        setEstado((s) => ({ ...s, marcaje: m, empleado: cod, ajustes: {} }))
        limpiarError('marcaje')
        avisar(`Marcaje cargado: ${m.marcas.length} marcas`, 'ok')
      }
      vibrar()
    } catch (e) {
      avisar(e instanceof ErrorArchivo ? e.message : 'No se pudo leer el archivo. Verifica que sea el .xlsx correcto.', 'error')
    }
  }

  function onAjuste(fecha, cambio) {
    setEstado((s) => {
      const aj = { ...s.ajustes }
      if (cambio == null) delete aj[fecha]
      else {
        const prev = aj[fecha] || {}
        aj[fecha] = { ...prev, ...cambio }
      }
      return { ...s, ajustes: aj }
    })
  }

  // --- Generar
  function validar() {
    const e = {}
    const req = 'Campo obligatorio'
    if (!tecnico.nombre.trim()) e.nombre = req
    if (!digitosCedula(tecnico.cedula)) e.cedula = req
    if (!tecnico.codigo.trim()) e.codigo = req
    for (const clave of FIRMANTES.map((f) => f.clave)) {
      if (!firmantes[clave].nombre.trim()) e[`${clave}-nombre`] = req
    }
    if (!horario) e.horario = 'Carga el horario del mes'
    else if (!columna) e.columna = 'Elige tu columna en el horario'
    if (!marcaje) e.marcaje = 'Carga el marcaje del Bioadmin'
    else if (!empleado) e.empleado = 'Elige el trabajador del marcaje'
    return e
  }

  function generar() {
    const e = validar()
    setErrores(e)
    const orden = [
      'nombre', 'cedula', 'codigo',
      ...FIRMANTES.map((f) => `${f.clave}-nombre`),
      'horario', 'columna', 'marcaje', 'empleado',
    ]
    const primero = orden.find((k) => e[k])
    if (primero) {
      const el = document.getElementById(`campo-${primero}`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setTimeout(() => el?.focus?.({ preventScroll: true }), 300)
      avisar(`Faltan ${Object.keys(e).length} dato(s) obligatorios`, 'error')
      vibrar([40, 60, 40])
      return
    }
    if (pendientes.length) {
      const lista = pendientes.map((d) => isoADmy(d.fecha).slice(0, 5)).join(', ')
      const ok = window.confirm(
        `Hay ${pendientes.length} día(s) por revisar (${lista}): sin marcaje, marca incompleta u horario no reconocido.\n\n¿Generar de todos modos?`,
      )
      if (!ok) return
    }
    actualizar({ generado: { en: new Date().toISOString() } })
    setVista('resultado')
    window.scrollTo({ top: 0 })
    vibrar(60)
    avisar('Formato generado', 'ok')
  }

  function corregir() {
    actualizar({ generado: null })
    setVista('captura')
    avisar('Edición desbloqueada')
  }

  function nuevo() {
    const ok = window.confirm(
      '¿Empezar una nueva quincena?\n\nSe borran el marcaje y los ajustes. Se conservan tus datos de técnico y el horario del mes.',
    )
    if (!ok) return
    setEstado((s) => ({ ...s, periodo: periodoPorDefecto(), marcaje: null, empleado: '', ajustes: {}, generado: null }))
    setErrores({})
    setVista('captura')
    avisar('Listo para una nueva quincena')
  }

  async function construirArchivo() {
    const plantilla = await (await fetch(plantillaUrl)).arrayBuffer()
    const blob = await llenarFormato(plantilla, { tecnico, firmantes, corte: { desde: periodo.desde, hasta: periodo.hasta }, dias, totales })
    return new File([blob], archivo, { type: blob.type })
  }

  function descargarArchivo(file) {
    const url = URL.createObjectURL(file)
    const a = document.createElement('a')
    a.href = url
    a.download = file.name
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 4000)
  }

  async function descargar() {
    setOcupado(true)
    try {
      descargarArchivo(await construirArchivo())
      avisar('Excel descargado', 'ok')
      vibrar()
    } catch {
      avisar('No se pudo crear el Excel. Intenta de nuevo.', 'error')
    } finally {
      setOcupado(false)
    }
  }

  async function compartir() {
    setOcupado(true)
    try {
      const file = await construirArchivo()
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: file.name })
        avisar('Excel compartido', 'ok')
      } else {
        descargarArchivo(file)
        avisar('Este navegador no permite compartir archivos; se descargó el Excel', 'info')
      }
    } catch (e) {
      if (e?.name !== 'AbortError') avisar('No se pudo compartir el Excel.', 'error')
    } finally {
      setOcupado(false)
    }
  }

  const firmantesCompletos = FIRMANTES.every((f) => firmantes[f.clave].nombre.trim())
  const valorMes = `${periodo.anio}-${String(periodo.mes).padStart(2, '0')}`
  const empleadoSel = marcaje?.empleados.find((e) => e.codigo === empleado)
  const horarioCubre =
    horario && diasQuincena(periodo.anio, periodo.mes, periodo.quincena).every((d) => d >= horario.desde && d <= horario.hasta)

  return (
    <div className="min-h-screen bg-page pb-32 text-avior-ink">
      <header className="sticky top-0 z-20 bg-avior pt-[env(safe-area-inset-top)] shadow-lg shadow-black/50">
        <div className="mx-auto flex max-w-3xl items-baseline justify-between px-4 py-3">
          <p className="text-sm font-black tracking-[0.18em] text-white">AVIOR AIRLINES · IT</p>
          <p className="text-xs font-medium text-white/80">Horas extras</p>
        </div>
        <nav className="bg-avior-nav">
          <div className="mx-auto flex max-w-3xl">
            {[
              ['captura', 'Captura'],
              ['resultado', 'Formato'],
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

      <main className="mx-auto max-w-3xl space-y-4 px-3 py-4 sm:px-4">
        {vista === 'captura' ? (
          <>
            {bloqueado && (
              <p className="rounded-lg border border-avior-line bg-avior-panel px-3 py-2 text-xs text-avior-muted">
                El formato ya está generado. Pulsa <b className="text-avior-ink">Corregir</b> para editar.
              </p>
            )}

            <Seccion icono={UserRound} titulo="Técnico">
              <Campo
                id="campo-nombre"
                etiqueta="Nombres y apellidos"
                obligatorio
                placeholder="Ej.: Pedro José Pérez González"
                autoComplete="name"
                value={tecnico.nombre}
                disabled={bloqueado}
                error={errores.nombre}
                onChange={(e) => setTecnico('nombre', e.target.value)}
              />
              <div className="grid grid-cols-2 gap-3">
                <Campo
                  id="campo-cedula"
                  etiqueta="Cédula"
                  obligatorio
                  placeholder="Ej.: 12345678"
                  inputMode="numeric"
                  value={tecnico.cedula}
                  disabled={bloqueado}
                  error={errores.cedula}
                  onChange={(e) => setTecnico('cedula', e.target.value)}
                />
                <Campo
                  id="campo-codigo"
                  etiqueta="Código de empleado"
                  obligatorio
                  placeholder="Ej.: 10001234"
                  inputMode="numeric"
                  value={tecnico.codigo}
                  disabled={bloqueado}
                  error={errores.codigo}
                  onChange={(e) => setTecnico('codigo', e.target.value)}
                />
              </div>
            </Seccion>

            <Seccion
              icono={PenLine}
              titulo="Firmantes"
              estado={firmantesCompletos && <Insignia tono="ok">Listo</Insignia>}
            >
              <p className="text-xs text-avior-muted">
                Se guardan en este dispositivo para las próximas quincenas. Las firmas se hacen a mano en el impreso.
              </p>
              {FIRMANTES.map(({ clave, titulo, ejemplo }) => (
                <div key={clave} className="space-y-2 rounded-lg border border-avior-line bg-avior-panel/60 p-3">
                  <p className="text-xs font-semibold text-avior-ink">{titulo}</p>
                  <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-2 sm:grid-cols-[minmax(0,1fr)_12rem]">
                    <Campo
                      id={`campo-${clave}-nombre`}
                      etiqueta="Nombre"
                      obligatorio
                      placeholder={ejemplo}
                      value={firmantes[clave].nombre}
                      disabled={bloqueado}
                      error={errores[`${clave}-nombre`]}
                      onChange={(e) => setFirmante(clave, 'nombre', e.target.value)}
                    />
                    <Campo
                      id={`campo-${clave}-cedula`}
                      etiqueta="Cédula"
                      placeholder="Opcional"
                      inputMode="numeric"
                      value={firmantes[clave].cedula}
                      disabled={bloqueado}
                      onChange={(e) => setFirmante(clave, 'cedula', e.target.value)}
                    />
                  </div>
                </div>
              ))}
            </Seccion>

            <Seccion icono={CalendarRange} titulo="Quincena">
              <div className="grid grid-cols-2 gap-3">
                <Campo
                  etiqueta="Mes"
                  type="month"
                  value={valorMes}
                  disabled={bloqueado}
                  onChange={(e) => {
                    const [a, m] = e.target.value.split('-').map(Number)
                    if (a && m) setPeriodo(a, m, periodo.quincena)
                  }}
                />
                <div className="min-w-0">
                  <span className="mb-1 block text-xs font-medium text-avior-muted">Quincena</span>
                  <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-avior-line">
                    {[1, 2].map((q) => (
                      <button
                        key={q}
                        type="button"
                        disabled={bloqueado}
                        onClick={() => setPeriodo(periodo.anio, periodo.mes, q)}
                        className={`py-3 text-sm font-semibold transition disabled:opacity-60 ${
                          periodo.quincena === q ? 'bg-avior-bright text-white' : 'bg-avior-well text-avior-muted'
                        }`}
                      >
                        {q === 1 ? '1 al 15' : '16 al fin'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Campo
                  etiqueta="Fecha de corte: desde"
                  type="date"
                  value={periodo.desde}
                  disabled={bloqueado}
                  onChange={(e) => actualizar({ periodo: { ...periodo, desde: e.target.value } })}
                />
                <Campo
                  etiqueta="Fecha de corte: hasta"
                  type="date"
                  value={periodo.hasta}
                  disabled={bloqueado}
                  onChange={(e) => actualizar({ periodo: { ...periodo, hasta: e.target.value } })}
                />
              </div>
              <p className="text-xs text-avior-muted">
                {NOMBRES_MES[periodo.mes - 1]} {periodo.anio}. La fecha de corte va en el campo Periodo del formato.
              </p>
            </Seccion>

            <Seccion
              icono={CalendarDays}
              titulo="Horario del mes"
              estado={horario && columna && horarioCubre && <Insignia tono="ok">Listo</Insignia>}
            >
              <BotonArchivo
                id="campo-horario"
                etiqueta="Cargar horario (.xlsx)"
                archivo={horario?.archivo}
                disabled={bloqueado}
                error={errores.horario}
                onArchivo={(f) => cargar(f, 'horario')}
              />
              {horario && (
                <>
                  <p className="text-xs text-avior-muted">
                    Cubre del {isoADmy(horario.desde)} al {isoADmy(horario.hasta)}
                  </p>
                  {!horarioCubre && (
                    <p className="text-xs font-medium text-amber-300">
                      Este horario no cubre todos los días de la quincena elegida. Revisa el mes o carga el horario correcto.
                    </p>
                  )}
                  <Campo
                    as="select"
                    id="campo-columna"
                    etiqueta="Tu columna en el horario"
                    obligatorio
                    value={columna}
                    disabled={bloqueado}
                    error={errores.columna}
                    onChange={(e) => {
                      limpiarError('columna')
                      actualizar({ columna: e.target.value })
                    }}
                  >
                    <option value="">Selecciona…</option>
                    {horario.tecnicos.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </Campo>
                </>
              )}
            </Seccion>

            <Seccion
              icono={Fingerprint}
              titulo="Marcaje (Bioadmin)"
              estado={marcaje && empleado && <Insignia tono="ok">Listo</Insignia>}
            >
              <BotonArchivo
                id="campo-marcaje"
                etiqueta="Cargar marcaje (.xlsx)"
                archivo={marcaje?.archivo}
                disabled={bloqueado}
                error={errores.marcaje}
                onArchivo={(f) => cargar(f, 'marcaje')}
              />
              {marcaje && marcaje.empleados.length > 1 && (
                <Campo
                  as="select"
                  id="campo-empleado"
                  etiqueta="Trabajador del marcaje"
                  obligatorio
                  value={empleado}
                  disabled={bloqueado}
                  error={errores.empleado}
                  onChange={(e) => {
                    limpiarError('empleado')
                    actualizar({ empleado: e.target.value, ajustes: {} })
                  }}
                >
                  <option value="">Selecciona…</option>
                  {marcaje.empleados.map((e) => (
                    <option key={e.codigo} value={e.codigo}>
                      {e.nombre} ({e.codigo})
                    </option>
                  ))}
                </Campo>
              )}
              {empleadoSel && (
                <p className="text-xs text-avior-muted">
                  {empleadoSel.nombre} · código {empleadoSel.codigo} · {empleadoSel.total} marcas
                  {marcaje.ilegibles ? ` · ${marcaje.ilegibles} filas ilegibles ignoradas` : ''}
                </p>
              )}
              {empleadoSel && tecnico.cedula && digitosCedula(tecnico.cedula) !== empleadoSel.codigo.replace(/\D/g, '') && (
                <p className="text-xs font-medium text-amber-300">
                  El código del marcaje no coincide con la cédula escrita. Verifica que sea tu marcaje.
                </p>
              )}
            </Seccion>

            {dias.length > 0 && (
              <Seccion
                icono={ListChecks}
                titulo="Revisión por día"
                estado={
                  pendientes.length ? (
                    <Insignia tono="aviso">{pendientes.length} por revisar</Insignia>
                  ) : (
                    <Insignia tono="ok">Todo en orden</Insignia>
                  )
                }
              >
                <p className="text-xs text-avior-muted">
                  Toca un día para ver el desglose del cálculo o corregir la entrada y salida.
                </p>
                <RevisionDias dias={dias} bloqueado={bloqueado} onAjuste={onAjuste} />
              </Seccion>
            )}

            <p className="flex items-center justify-center gap-2 pt-4 text-xs text-avior-muted">
              <Headset className="h-4 w-4" aria-hidden />
              Desarrollado por: <b className="text-avior-ink">HelpDesk Avior</b>
            </p>
          </>
        ) : (
          <>
            <VistaResultado estado={estado} dias={dias} totales={totales} archivo={archivo} />
            <button
              type="button"
              onClick={nuevo}
              className="mx-auto flex items-center gap-2 py-2 text-sm font-medium text-avior-muted hover:text-avior-ink"
            >
              <FilePlus2 className="h-4 w-4" aria-hidden /> Empezar una nueva quincena
            </button>
          </>
        )}
      </main>

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

      <footer className="fixed inset-x-0 bottom-0 z-20 border-t border-avior-line bg-avior-silver pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-3xl gap-2 px-3 py-3">
          {vista === 'captura' && !bloqueado ? (
            <>
              <Boton variante="secundario" icono={FilePlus2} onClick={nuevo} className="w-28 shrink-0">
                Nuevo
              </Boton>
              <Boton icono={Calculator} onClick={generar} className="flex-1">
                Generar
              </Boton>
            </>
          ) : (
            <>
              <Boton variante="secundario" icono={Pencil} onClick={corregir} className="shrink-0 px-3" aria-label="Corregir">
                <span className="hidden sm:inline">Corregir</span>
              </Boton>
              <Boton variante="secundario" icono={Share2} onClick={compartir} disabled={ocupado} className="flex-1">
                Compartir
              </Boton>
              <Boton icono={Download} onClick={descargar} disabled={ocupado} className="flex-1">
                Descargar
              </Boton>
            </>
          )}
        </div>
      </footer>
    </div>
  )
}
