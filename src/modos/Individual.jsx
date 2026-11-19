// Módulo individual: un técnico, un marcaje, un formato.
import { useMemo, useState } from 'react'
import { Calculator, Download, FilePlus2, Fingerprint, ListChecks, Lock, Pencil, Share2, UserRound } from 'lucide-react'
import plantillaUrl from '../assets/plantilla_horas_extras.xlsx?url'
import MapaQuincena from '../components/MapaQuincena.jsx'
import {
  AvisoBloqueado, Credito, DatosTecnico, FIRMANTES, SeccionFirmantes, SeccionHorario, SeccionObservaciones, SeccionQuincena,
} from '../components/secciones.jsx'
import VistaResultado from '../components/VistaResultado.jsx'
import { Boton, BotonArchivo, Campo, Insignia, Seccion } from '../components/ui.jsx'
import { cargarPlantilla, compartirArchivos, descargarArchivo } from '../lib/archivos.js'
import { periodoPorDefecto } from '../lib/estado.js'
import { llenarFormato } from '../lib/formato.js'
import { catalogoTurnos, interpretarHorario, sugerirTecnico } from '../lib/horario.js'
import { coberturaMarcaje, interpretarMarcaje, marcasPorDia, sugerirEmpleado, tecnicoDesdeMarcaje } from '../lib/marcaje.js'
import { totalizar } from '../lib/motor.js'
import { armarQuincena, diasQuincena, digitosCedula, ESTADOS_PENDIENTES, nombreArchivo } from '../lib/periodo.js'
import { isoADmy } from '../lib/tiempo.js'
import { ErrorArchivo, leerPrimeraHoja } from '../lib/xlsxLectura.js'
import { conHorario, enfocarPrimero, vibrar } from './comun.js'

// Aplica el trabajador elegido del marcaje: llena el técnico y reajusta la columna del horario.
function conEmpleado(s, marcaje, codigo) {
  const emp = marcaje?.empleados.find((e) => e.codigo === codigo)
  const base = { ...s, marcaje, empleado: codigo, ajustes: {} }
  if (!emp) return base
  const tecnico = tecnicoDesdeMarcaje(emp, s.tecnico)
  const columna = s.horario ? sugerirTecnico(tecnico.nombre, s.horario.tecnicos) || s.columna : s.columna
  return { ...base, tecnico, columna }
}

export default function Individual({ estado, setEstado, comunes, avisar, vista, setVista, selector }) {
  const [errores, setErrores] = useState({})
  const [ocupado, setOcupado] = useState(false)
  const [editandoNombre, setEditandoNombre] = useState(false)

  const { tecnico, firmantes, periodo, horario, columna, marcaje, empleado, ajustes, observaciones, generado } = estado
  const bloqueado = Boolean(generado)

  const actualizar = (cambios) => setEstado((s) => ({ ...s, ...cambios }))
  const limpiarError = (k) => errores[k] && setErrores((e) => ({ ...e, [k]: undefined }))
  const setTecnico = (k, v) => {
    limpiarError(k)
    setEstado((s) => ({ ...s, tecnico: { ...s.tecnico, [k]: v } }))
  }

  // --- Cálculo de la quincena (se recalcula en vivo)
  const catalogo = useMemo(() => catalogoTurnos(horario), [horario])
  const cobertura = useMemo(() => coberturaMarcaje(marcaje), [marcaje])
  const dias = useMemo(() => {
    if (!horario || !columna || !marcaje || !empleado) return []
    return armarQuincena(
      diasQuincena(periodo.anio, periodo.mes, periodo.quincena),
      horario.porTecnico[columna] || {},
      marcasPorDia(marcaje, empleado),
      ajustes,
      { catalogo, cobertura },
    )
  }, [horario, columna, marcaje, empleado, ajustes, catalogo, cobertura, periodo.anio, periodo.mes, periodo.quincena])
  const totales = useMemo(() => totalizar(dias.map((d) => d.resultado)), [dias])
  const pendientes = dias.filter((d) => ESTADOS_PENDIENTES.includes(d.resultado.estado))
  const archivo = nombreArchivo(tecnico.nombre, periodo.anio, periodo.mes, periodo.quincena)

  // --- Carga de archivos
  async function cargar(file, tipo) {
    try {
      const { filas } = await leerPrimeraHoja(await file.arrayBuffer())
      if (tipo === 'horario') {
        const h = { archivo: file.name, ...interpretarHorario(filas) }
        const col = sugerirTecnico(tecnico.nombre, h.tecnicos)
        setEstado((s) => conHorario(s, h))
        limpiarError('horario')
        if (col) limpiarError('columna')
        avisar(`Horario cargado: ${h.tecnicos.length} técnicos`, 'ok')
      } else {
        const m = { archivo: file.name, ...interpretarMarcaje(filas) }
        const cod = sugerirEmpleado(m.empleados, tecnico.cedula, tecnico.nombre)
        setEstado((s) => conEmpleado(s, m, cod))
        setEditandoNombre(false)
        setErrores((e) => ({ ...e, marcaje: undefined, nombre: undefined, cedula: undefined, codigo: undefined, columna: undefined }))
        avisar(`Marcaje cargado: ${m.marcas.length} marcas`, 'ok')
      }
      vibrar()
    } catch (e) {
      avisar(e instanceof ErrorArchivo ? e.message : 'No se pudo leer el archivo. Verifica que sea el .xlsx correcto.', 'error')
    }
  }

  // Ajustes del mapa: un valor undefined elimina esa clave; un día sin claves vuelve al Excel
  function onAjuste(fecha, cambio) {
    setEstado((s) => {
      const aj = { ...s.ajustes }
      const dia = { ...(aj[fecha] || {}), ...cambio }
      for (const k of Object.keys(dia)) if (dia[k] === undefined) delete dia[k]
      if (Object.keys(dia).length) aj[fecha] = dia
      else delete aj[fecha]
      return { ...s, ajustes: aj }
    })
  }

  function onRestablecer(fecha) {
    setEstado((s) => {
      const aj = { ...s.ajustes }
      delete aj[fecha]
      return { ...s, ajustes: aj }
    })
  }

  // --- Generar
  function validar() {
    const e = {}
    const req = 'Campo obligatorio'
    for (const clave of FIRMANTES.map((f) => f.clave)) {
      if (!firmantes[clave].nombre.trim()) e[`${clave}-nombre`] = req
    }
    if (!horario) e.horario = 'Carga el horario del mes'
    else if (!columna) e.columna = 'Elige tu columna en el horario'
    if (!marcaje) e.marcaje = 'Carga el marcaje del Bioadmin'
    else if (!empleado) e.empleado = 'Elige el trabajador del marcaje'
    else {
      // El técnico se llena desde el marcaje; solo puede faltar el código (formato viejo) o un nombre borrado
      if (!tecnico.nombre.trim()) e.nombre = req
      if (!digitosCedula(tecnico.cedula)) e.cedula = req
      if (!tecnico.codigo.trim()) e.codigo = req
    }
    return e
  }

  function generar() {
    const e = validar()
    setErrores(e)
    const orden = [...FIRMANTES.map((f) => `${f.clave}-nombre`), 'horario', 'columna', 'marcaje', 'empleado', 'nombre', 'cedula', 'codigo']
    const primero = orden.find((k) => e[k])
    if (primero) {
      if (primero === 'nombre') setEditandoNombre(true)
      enfocarPrimero(`campo-${primero}`)
      avisar(`Faltan ${Object.keys(e).length} dato(s) obligatorios`, 'error')
      vibrar([40, 60, 40])
      return
    }
    if (pendientes.length) {
      const lista = pendientes.map((d) => isoADmy(d.fecha).slice(0, 5)).join(', ')
      const ok = window.confirm(
        `Hay ${pendientes.length} día(s) por revisar (${lista}): turno sin marcas, marca incompleta, horario no reconocido o posible cambio de guardia.\n\n¿Generar de todos modos?`,
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
      '¿Empezar una nueva quincena?\n\nSe borran el marcaje, los ajustes del mapa y las observaciones. Se conservan tus datos de técnico y el horario del mes.',
    )
    if (!ok) return
    setEstado((s) => ({ ...s, periodo: periodoPorDefecto(), marcaje: null, empleado: '', ajustes: {}, observaciones: '', generado: null }))
    setErrores({})
    setVista('captura')
    avisar('Listo para una nueva quincena')
  }

  async function construirArchivo() {
    const blob = await llenarFormato(await cargarPlantilla(plantillaUrl), {
      tecnico, firmantes, corte: { desde: periodo.desde, hasta: periodo.hasta }, dias, totales, observaciones,
    })
    return new File([blob], archivo, { type: blob.type })
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
      const r = await compartirArchivos([await construirArchivo()])
      avisar(r === 'compartido' ? 'Excel compartido' : 'Este navegador no permite compartir archivos; se descargó el Excel', r === 'compartido' ? 'ok' : 'info')
    } catch (e) {
      if (e?.name !== 'AbortError') avisar('No se pudo compartir el Excel.', 'error')
    } finally {
      setOcupado(false)
    }
  }

  const empleadoSel = marcaje?.empleados.find((e) => e.codigo === empleado)
  const horarioCubre =
    horario && diasQuincena(periodo.anio, periodo.mes, periodo.quincena).every((d) => d >= horario.desde && d <= horario.hasta)

  return (
    <>
      <main className="mx-auto max-w-3xl space-y-4 px-3 py-4 sm:px-4">
        {vista === 'captura' ? (
          <>
            {selector}
            <AvisoBloqueado visible={bloqueado} />

            <SeccionFirmantes
              firmantes={firmantes}
              errores={errores}
              bloqueado={bloqueado}
              onFirmante={(clave, campo, v) => {
                limpiarError(`${clave}-${campo}`)
                comunes.onFirmante(clave, campo, v)
              }}
            />
            <SeccionQuincena periodo={periodo} bloqueado={bloqueado} onPeriodo={comunes.onPeriodo} onCorte={comunes.onCorte} />

            <SeccionHorario
              horario={horario}
              cubre={horarioCubre}
              listo={horario && columna && horarioCubre}
              bloqueado={bloqueado}
              error={errores.horario}
              onArchivo={(f) => cargar(f, 'horario')}
            >
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
                {horario?.tecnicos.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Campo>
            </SeccionHorario>

            <Seccion icono={Fingerprint} titulo="Marcaje (Bioadmin)" estado={marcaje && empleado && <Insignia tono="ok">Listo</Insignia>}>
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
                    const cod = e.target.value
                    setEstado((st) => conEmpleado(st, st.marcaje, cod))
                    setEditandoNombre(false)
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
                  {empleadoSel.total} marcas
                  {marcaje.ilegibles ? `, ${marcaje.ilegibles} filas ilegibles ignoradas` : ''}
                </p>
              )}
            </Seccion>

            <Seccion
              icono={UserRound}
              titulo="Técnico"
              estado={
                empleadoSel && (
                  <Insignia>
                    <span className="flex items-center gap-1">
                      <Lock className="h-3 w-3" aria-hidden /> Del marcaje
                    </span>
                  </Insignia>
                )
              }
            >
              {!empleadoSel ? (
                <p className="text-sm text-avior-muted">
                  Se llena solo al cargar el marcaje: el nombre y la cédula salen del Bioadmin, y el código de empleado de la
                  columna Núm. Identificación.
                </p>
              ) : (
                <DatosTecnico
                  tecnico={tecnico}
                  empleado={empleadoSel}
                  bloqueado={bloqueado}
                  errores={errores}
                  onCambio={setTecnico}
                  editando={editandoNombre}
                  onEditando={setEditandoNombre}
                />
              )}
            </Seccion>

            {dias.length > 0 && (
              <Seccion
                icono={ListChecks}
                titulo="Mapa de la quincena"
                estado={
                  pendientes.length ? (
                    <Insignia tono="aviso">{pendientes.length} por revisar</Insignia>
                  ) : (
                    <Insignia tono="ok">Todo en orden</Insignia>
                  )
                }
              >
                <MapaQuincena dias={dias} catalogo={catalogo} bloqueado={bloqueado} onAjuste={onAjuste} onRestablecer={onRestablecer} />
              </Seccion>
            )}

            {dias.length > 0 && (
              <SeccionObservaciones valor={observaciones} dias={dias} bloqueado={bloqueado} onCambio={(v) => actualizar({ observaciones: v })} />
            )}

            <Credito />
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
    </>
  )
}
