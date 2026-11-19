// Módulo masivo: varios técnicos que comparten el horario del mes. Se cargan uno o
// varios marcajes del Bioadmin y se genera un formato por técnico en una sola pasada.
import { useMemo, useState } from 'react'
import {
  Calculator, Check, ChevronDown, Download, FilePlus2, FileSpreadsheet, Fingerprint, ListChecks, Pencil, Share2, Users, X,
} from 'lucide-react'
import plantillaUrl from '../assets/plantilla_horas_extras.xlsx?url'
import MapaQuincena from '../components/MapaQuincena.jsx'
import {
  AvisoBloqueado, Credito, DatosTecnico, FIRMANTES, SeccionFirmantes, SeccionHorario, SeccionObservaciones, SeccionQuincena,
  useEdicionNombre,
} from '../components/secciones.jsx'
import VistaResultado from '../components/VistaResultado.jsx'
import { Boton, BotonArchivo, Campo, Insignia, Seccion } from '../components/ui.jsx'
import { cargarPlantilla, compartirArchivos, descargarArchivo, zipArchivos } from '../lib/archivos.js'
import { periodoPorDefecto } from '../lib/estado.js'
import { llenarFormato } from '../lib/formato.js'
import { catalogoTurnos, interpretarHorario } from '../lib/horario.js'
import { coberturaMarcaje, interpretarMarcaje, marcasPorDia, nombrePropio } from '../lib/marcaje.js'
import { columnasRepetidas, combinarMarcajes, nombresUnicos, nombreZip, sincronizarTecnicos } from '../lib/masivo.js'
import { fmtHoras, totalizar } from '../lib/motor.js'
import { armarQuincena, diasQuincena, ESTADOS_PENDIENTES, nombreArchivo, nombreCorto } from '../lib/periodo.js'
import { isoADmy, NOMBRES_MES } from '../lib/tiempo.js'
import { ErrorArchivo, leerPrimeraHoja } from '../lib/xlsxLectura.js'
import { conHorario, enfocarPrimero, vibrar } from './comun.js'

const TOTALES = [
  ['bono', 'Bono'],
  ['diurnas', 'HE D'],
  ['mixtas', 'HE M'],
  ['nocturnas', 'HE N'],
  ['domingo', 'Dom'],
  ['descanso', 'Desc'],
  ['feriado', 'Fer'],
]

export default function Masivo({ estado, setEstado, comunes, avisar, vista, setVista, selector }) {
  const [errores, setErrores] = useState({})
  const [ocupado, setOcupado] = useState(false)
  const [revisando, setRevisando] = useState('')
  const [previa, setPrevia] = useState('')
  const [editando, setEditando] = useEdicionNombre()

  const { firmantes, periodo, horario, masivo } = estado
  const { marcajes, tecnicos: fichas, generado } = masivo
  const bloqueado = Boolean(generado)

  const actualizarMasivo = (fn) => setEstado((s) => ({ ...s, masivo: fn(s.masivo) }))
  const setFicha = (ced, cambios) =>
    actualizarMasivo((m) => ({ ...m, tecnicos: { ...m.tecnicos, [ced]: { ...m.tecnicos[ced], ...cambios } } }))
  const limpiarError = (k) => errores[k] && setErrores((e) => ({ ...e, [k]: undefined }))

  // --- Datos combinados y cálculo por técnico
  const combinado = useMemo(() => combinarMarcajes(marcajes), [marcajes])
  const cobertura = useMemo(() => coberturaMarcaje(combinado), [combinado])
  const catalogo = useMemo(() => catalogoTurnos(horario), [horario])
  const visibles = combinado.empleados.filter((e) => fichas[e.codigo])
  const incluidos = visibles.filter((e) => fichas[e.codigo].incluir)
  const diasQ = useMemo(() => diasQuincena(periodo.anio, periodo.mes, periodo.quincena), [periodo.anio, periodo.mes, periodo.quincena])

  const calculos = useMemo(() => {
    const out = {}
    for (const e of incluidos) {
      const f = fichas[e.codigo]
      if (!horario || !f.columna) continue
      const dias = armarQuincena(diasQ, horario.porTecnico[f.columna] || {}, marcasPorDia(combinado, e.codigo), f.ajustes, {
        catalogo,
        cobertura,
      })
      out[e.codigo] = {
        dias,
        totales: totalizar(dias.map((d) => d.resultado)),
        pendientes: dias.filter((d) => ESTADOS_PENDIENTES.includes(d.resultado.estado)),
      }
    }
    return out
  }, [incluidos, fichas, horario, diasQ, combinado, catalogo, cobertura])

  const repetidas = columnasRepetidas(fichas, incluidos.map((e) => e.codigo))
  const conCalculo = incluidos.filter((e) => calculos[e.codigo])
  // Sin elección explícita, se abre primero el técnico que tiene días por revisar
  const sel =
    conCalculo.find((e) => e.codigo === revisando) || conCalculo.find((e) => calculos[e.codigo].pendientes.length) || conCalculo[0]
  const tecnicoDe = (e) => ({ nombre: fichas[e.codigo].nombre, cedula: e.codigo, codigo: fichas[e.codigo].codigo })

  // --- Carga de archivos
  async function cargarHorario(file) {
    try {
      const { filas } = await leerPrimeraHoja(await file.arrayBuffer())
      const h = { archivo: file.name, ...interpretarHorario(filas) }
      setEstado((s) => conHorario(s, h))
      limpiarError('horario')
      avisar(`Horario cargado: ${h.tecnicos.length} técnicos`, 'ok')
      vibrar()
    } catch (e) {
      avisar(e instanceof ErrorArchivo ? e.message : 'No se pudo leer el horario. Verifica que sea el .xlsx correcto.', 'error')
    }
  }

  async function cargarMarcajes(files) {
    const nuevos = []
    const fallidos = []
    for (const file of files) {
      try {
        const { filas } = await leerPrimeraHoja(await file.arrayBuffer())
        nuevos.push({ archivo: file.name, ...interpretarMarcaje(filas) })
      } catch {
        fallidos.push(file.name)
      }
    }
    if (nuevos.length) {
      setEstado((s) => {
        // Un archivo con el mismo nombre reemplaza al anterior
        const lista = [...s.masivo.marcajes.filter((m) => !nuevos.some((n) => n.archivo === m.archivo)), ...nuevos]
        const tecnicos = sincronizarTecnicos(combinarMarcajes(lista), s.masivo.tecnicos, s.horario, s.tecnico)
        return { ...s, masivo: { ...s.masivo, marcajes: lista, tecnicos } }
      })
      setErrores((e) => ({ ...e, marcajes: undefined, tecnicos: undefined }))
      vibrar()
    }
    if (fallidos.length) avisar(`No se pudo leer: ${fallidos.join(', ')}`, 'error')
    else avisar(nuevos.length === 1 ? 'Marcaje cargado' : `${nuevos.length} marcajes cargados`, 'ok')
  }

  const quitarMarcaje = (archivo) => actualizarMasivo((m) => ({ ...m, marcajes: m.marcajes.filter((x) => x.archivo !== archivo) }))

  // --- Ajustes del mapa del técnico en revisión
  function onAjuste(ced) {
    return (fecha, cambio) =>
      actualizarMasivo((m) => {
        const f = m.tecnicos[ced]
        const aj = { ...f.ajustes }
        const dia = { ...(aj[fecha] || {}), ...cambio }
        for (const k of Object.keys(dia)) if (dia[k] === undefined) delete dia[k]
        if (Object.keys(dia).length) aj[fecha] = dia
        else delete aj[fecha]
        return { ...m, tecnicos: { ...m.tecnicos, [ced]: { ...f, ajustes: aj } } }
      })
  }
  const onRestablecer = (ced) => (fecha) => onAjuste(ced)(fecha, Object.fromEntries(Object.keys(fichas[ced].ajustes[fecha] || {}).map((k) => [k, undefined])))

  // --- Generar
  function validar() {
    const e = {}
    const req = 'Campo obligatorio'
    for (const { clave } of FIRMANTES) if (!firmantes[clave].nombre.trim()) e[`${clave}-nombre`] = req
    if (!horario) e.horario = 'Carga el horario del mes'
    if (!marcajes.length) e.marcajes = 'Carga al menos un marcaje del Bioadmin'
    else if (!incluidos.length) e.tecnicos = 'Incluye al menos un técnico'
    for (const emp of incluidos) {
      const f = fichas[emp.codigo]
      const k = `m-${emp.codigo}`
      if (!f.nombre.trim()) e[`${k}-nombre`] = req
      if (!f.codigo.trim()) e[`${k}-codigo`] = req
      if (horario && !f.columna) e[`${k}-columna`] = 'Elige su columna en el horario'
      else if (repetidas[f.columna]) e[`${k}-columna`] = 'Otro técnico tiene esta misma columna'
    }
    return e
  }

  function generar() {
    const e = validar()
    setErrores(e)
    const orden = [
      ...FIRMANTES.map((f) => `${f.clave}-nombre`),
      'horario', 'marcajes', 'tecnicos',
      ...incluidos.flatMap((emp) => ['nombre', 'codigo', 'columna'].map((c) => `m-${emp.codigo}-${c}`)),
    ]
    const primero = orden.find((k) => e[k])
    if (primero) {
      if (primero.endsWith('-nombre') && primero.startsWith('m-')) setEditando(primero.slice(2, -7), true)
      enfocarPrimero(primero.startsWith('m-') ? primero : `campo-${primero}`)
      avisar(`Faltan ${Object.keys(e).length} dato(s) obligatorios`, 'error')
      vibrar([40, 60, 40])
      return
    }
    const conPendientes = incluidos.filter((emp) => calculos[emp.codigo]?.pendientes.length)
    if (conPendientes.length) {
      const lista = conPendientes
        .map((emp) => {
          const p = calculos[emp.codigo].pendientes
          return `• ${nombreCorto(fichas[emp.codigo].nombre)}: ${p.map((d) => isoADmy(d.fecha).slice(0, 5)).join(', ')}`
        })
        .join('\n')
      const ok = window.confirm(
        `Hay días por revisar (turno sin marcas, marca incompleta, horario no reconocido o posible cambio de guardia):\n\n${lista}\n\n¿Generar de todos modos?`,
      )
      if (!ok) return
    }
    actualizarMasivo((m) => ({ ...m, generado: { en: new Date().toISOString() } }))
    setVista('resultado')
    window.scrollTo({ top: 0 })
    vibrar(60)
    avisar(incluidos.length === 1 ? 'Formato generado' : `${incluidos.length} formatos generados`, 'ok')
  }

  function corregir() {
    actualizarMasivo((m) => ({ ...m, generado: null }))
    setVista('captura')
    avisar('Edición desbloqueada')
  }

  function nuevo() {
    const ok = window.confirm(
      '¿Empezar una nueva quincena?\n\nSe borran los marcajes, los ajustes del mapa y las observaciones de todos los técnicos. Se conservan el horario del mes, los firmantes y los nombres corregidos.',
    )
    if (!ok) return
    setEstado((s) => ({
      ...s,
      periodo: periodoPorDefecto(),
      masivo: {
        marcajes: [],
        generado: null,
        tecnicos: Object.fromEntries(Object.entries(s.masivo.tecnicos).map(([c, f]) => [c, { ...f, ajustes: {}, observaciones: '' }])),
      },
    }))
    setErrores({})
    setRevisando('')
    setVista('captura')
    avisar('Listo para una nueva quincena')
  }

  // --- Archivos
  const archivos = nombresUnicos(incluidos.map((e) => nombreArchivo(fichas[e.codigo].nombre, periodo.anio, periodo.mes, periodo.quincena)))
  const archivoDe = Object.fromEntries(incluidos.map((e, i) => [e.codigo, archivos[i]]))

  async function construir(emp) {
    const { dias, totales } = calculos[emp.codigo]
    const blob = await llenarFormato(await cargarPlantilla(plantillaUrl), {
      tecnico: tecnicoDe(emp),
      firmantes,
      corte: { desde: periodo.desde, hasta: periodo.hasta },
      dias,
      totales,
      observaciones: fichas[emp.codigo].observaciones,
    })
    return new File([blob], archivoDe[emp.codigo], { type: blob.type })
  }

  async function conOcupado(fn, error) {
    setOcupado(true)
    try {
      await fn()
    } catch (e) {
      if (e?.name !== 'AbortError') avisar(error, 'error')
    } finally {
      setOcupado(false)
    }
  }

  const descargarUno = (emp) =>
    conOcupado(async () => {
      descargarArchivo(await construir(emp))
      avisar('Excel descargado', 'ok')
    }, 'No se pudo crear el Excel. Intenta de nuevo.')

  const descargarTodos = () =>
    conOcupado(async () => {
      const files = await Promise.all(conCalculo.map(construir))
      descargarArchivo(files.length === 1 ? files[0] : await zipArchivos(files, nombreZip(periodo.anio, periodo.mes, periodo.quincena)))
      avisar(files.length === 1 ? 'Excel descargado' : `Descargado el .zip con ${files.length} reportes`, 'ok')
      vibrar()
    }, 'No se pudieron crear los Excel. Intenta de nuevo.')

  const compartirTodos = () =>
    conOcupado(async () => {
      const files = await Promise.all(conCalculo.map(construir))
      const zip = files.length > 1 ? await zipArchivos(files, nombreZip(periodo.anio, periodo.mes, periodo.quincena)) : files[0]
      const r = await compartirArchivos(files, zip)
      avisar(
        r === 'compartido' ? `${files.length} reporte(s) compartido(s)` : 'Este navegador no permite compartir archivos; se descargó el .zip',
        r === 'compartido' ? 'ok' : 'info',
      )
    }, 'No se pudieron compartir los Excel.')

  const horarioCubre = horario && diasQ.every((d) => d >= horario.desde && d <= horario.hasta)
  const listos = incluidos.filter((e) => fichas[e.codigo].columna && fichas[e.codigo].codigo.trim() && !repetidas[fichas[e.codigo].columna])

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
              listo={horario && horarioCubre}
              bloqueado={bloqueado}
              error={errores.horario}
              onArchivo={cargarHorario}
            >
              <p className="text-xs text-avior-muted">La columna de cada técnico se elige abajo, en Técnicos.</p>
            </SeccionHorario>

            <Seccion
              icono={Fingerprint}
              titulo="Marcajes (Bioadmin)"
              estado={marcajes.length > 0 && <Insignia tono="ok">{marcajes.length === 1 ? '1 archivo' : `${marcajes.length} archivos`}</Insignia>}
            >
              <BotonArchivo
                id="campo-marcajes"
                etiqueta={marcajes.length ? 'Agregar más marcajes (.xlsx)' : 'Cargar marcajes (.xlsx)'}
                ayuda="Puedes elegir varios a la vez: uno por técnico o uno con todos"
                multiple
                disabled={bloqueado}
                error={errores.marcajes}
                onArchivos={cargarMarcajes}
              />
              {marcajes.length > 0 && (
                <ul className="space-y-2">
                  {marcajes.map((m) => (
                    <li key={m.archivo} className="flex items-center gap-3 rounded-lg border border-avior-line bg-avior-well px-3 py-2">
                      <FileSpreadsheet className="h-4 w-4 shrink-0 text-avior-light" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-avior-ink">{m.archivo}</span>
                        <span className="block text-xs text-avior-muted">
                          {m.empleados.length === 1 ? nombreCorto(nombrePropio(m.empleados[0].nombre)) || '1 trabajador' : `${m.empleados.length} trabajadores`} ·{' '}
                          {m.marcas.length} marcas
                        </span>
                      </span>
                      {!bloqueado && (
                        <button
                          type="button"
                          onClick={() => quitarMarcaje(m.archivo)}
                          aria-label={`Quitar ${m.archivo}`}
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-avior-muted hover:bg-avior-nav hover:text-avior-ink"
                        >
                          <X className="h-4 w-4" aria-hidden />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {combinado.ilegibles > 0 && <p className="text-xs text-avior-muted">{combinado.ilegibles} filas ilegibles ignoradas.</p>}
            </Seccion>

            <Seccion
              id="campo-tecnicos"
              icono={Users}
              titulo="Técnicos"
              estado={
                visibles.length > 0 && (
                  <Insignia tono={listos.length === incluidos.length && incluidos.length ? 'ok' : 'neutro'}>
                    {incluidos.length} de {visibles.length} incluidos
                  </Insignia>
                )
              }
            >
              {!visibles.length ? (
                <p className="text-sm text-avior-muted">
                  Aparecen al cargar los marcajes. Los datos de cada uno salen del Bioadmin y su columna del horario se elige sola por
                  el nombre.
                </p>
              ) : (
                <>
                  {errores.tecnicos && <p className="text-xs font-medium text-red-400">{errores.tecnicos}</p>}
                  {visibles.map((emp) => {
                    const f = fichas[emp.codigo]
                    const k = `m-${emp.codigo}`
                    const pend = calculos[emp.codigo]?.pendientes.length || 0
                    return (
                      <div
                        key={emp.codigo}
                        className={`space-y-3 rounded-lg border p-3 ${f.incluir ? 'border-avior-line bg-avior-panel/60' : 'border-dashed border-avior-line opacity-70'}`}
                      >
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={f.incluir}
                            aria-label={`Incluir a ${f.nombre}`}
                            disabled={bloqueado}
                            onClick={() => {
                              setFicha(emp.codigo, { incluir: !f.incluir })
                              limpiarError('tecnicos')
                            }}
                            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border transition disabled:opacity-60 ${
                              f.incluir ? 'border-avior-bright bg-avior-bright text-white' : 'border-avior-line bg-avior-well text-transparent'
                            }`}
                          >
                            <Check className="h-5 w-5" aria-hidden />
                          </button>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-avior-ink">{nombreCorto(f.nombre) || f.nombre}</p>
                            <p className="text-xs text-avior-muted">{emp.total} marcas</p>
                          </div>
                          {!f.incluir ? (
                            <Insignia>No se genera</Insignia>
                          ) : !calculos[emp.codigo] ? (
                            <Insignia tono="aviso">Falta columna</Insignia>
                          ) : pend ? (
                            <Insignia tono="aviso">{pend} por revisar</Insignia>
                          ) : (
                            <Insignia tono="ok">Todo en orden</Insignia>
                          )}
                        </div>
                        {f.incluir && (
                          <>
                            <DatosTecnico
                              tecnico={tecnicoDe(emp)}
                              empleado={emp}
                              bloqueado={bloqueado}
                              idBase={k}
                              errores={{ nombre: errores[`${k}-nombre`], codigo: errores[`${k}-codigo`] }}
                              onCambio={(campo, v) => {
                                limpiarError(`${k}-${campo}`)
                                setFicha(emp.codigo, { [campo]: v })
                              }}
                              editando={editando(emp.codigo)}
                              onEditando={(v) => setEditando(emp.codigo, v)}
                            />
                            {horario ? (
                              <Campo
                                as="select"
                                id={`${k}-columna`}
                                etiqueta="Su columna en el horario"
                                obligatorio
                                value={f.columna}
                                disabled={bloqueado}
                                error={errores[`${k}-columna`] || (repetidas[f.columna] && 'Otro técnico tiene esta misma columna')}
                                onChange={(e) => {
                                  limpiarError(`${k}-columna`)
                                  setFicha(emp.codigo, { columna: e.target.value })
                                }}
                              >
                                <option value="">Selecciona…</option>
                                {horario.tecnicos.map((t) => (
                                  <option key={t} value={t}>
                                    {t}
                                  </option>
                                ))}
                              </Campo>
                            ) : (
                              <p className="text-xs text-avior-muted">Carga el horario para elegir su columna.</p>
                            )}
                          </>
                        )}
                      </div>
                    )
                  })}
                </>
              )}
            </Seccion>

            {sel && (
              <Seccion
                icono={ListChecks}
                titulo="Revisión por técnico"
                estado={
                  calculos[sel.codigo].pendientes.length ? (
                    <Insignia tono="aviso">{calculos[sel.codigo].pendientes.length} por revisar</Insignia>
                  ) : (
                    <Insignia tono="ok">Todo en orden</Insignia>
                  )
                }
              >
                <div role="tablist" aria-label="Técnico en revisión" className="flex gap-2 overflow-x-auto pb-1">
                  {conCalculo.map((emp) => {
                    const p = calculos[emp.codigo].pendientes.length
                    const activo = emp.codigo === sel.codigo
                    return (
                      <button
                        key={emp.codigo}
                        type="button"
                        role="tab"
                        aria-selected={activo}
                        onClick={() => setRevisando(emp.codigo)}
                        className={`flex min-h-[44px] shrink-0 items-center gap-2 rounded-lg border px-3 text-sm font-semibold transition ${
                          activo ? 'border-avior-bright bg-avior-bright text-white' : 'border-avior-line bg-avior-well text-avior-muted'
                        }`}
                      >
                        {nombreCorto(fichas[emp.codigo].nombre)}
                        {p > 0 && (
                          <span className="rounded-full bg-amber-400 px-1.5 text-[11px] font-bold text-black" aria-label={`${p} por revisar`}>
                            {p}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
                <MapaQuincena
                  key={sel.codigo}
                  dias={calculos[sel.codigo].dias}
                  catalogo={catalogo}
                  bloqueado={bloqueado}
                  onAjuste={onAjuste(sel.codigo)}
                  onRestablecer={onRestablecer(sel.codigo)}
                />
              </Seccion>
            )}

            {sel && (
              <SeccionObservaciones
                key={`obs-${sel.codigo}`}
                id={`m-${sel.codigo}-observaciones`}
                titulo={`Observaciones de ${nombreCorto(fichas[sel.codigo].nombre)} (opcional)`}
                valor={fichas[sel.codigo].observaciones}
                dias={calculos[sel.codigo].dias}
                bloqueado={bloqueado}
                onCambio={(v) => setFicha(sel.codigo, { observaciones: v })}
              />
            )}

            <Credito />
          </>
        ) : (
          <>
            <div className="rounded-xl border border-avior-line bg-metal p-4">
              <p className="text-sm font-semibold text-avior-ink">
                {conCalculo.length === 1 ? '1 reporte' : `${conCalculo.length} reportes`} · {periodo.quincena === 1 ? '1 al 15' : '16 al fin'} de{' '}
                {NOMBRES_MES[periodo.mes - 1]} {periodo.anio}
              </p>
              <p className="mt-1 text-xs text-avior-muted">
                Descarga todos en un .zip, compártelos juntos o baja cada uno por separado. Cada formato lleva al técnico en
                “Elaborado por”.
              </p>
            </div>
            {conCalculo.map((emp) => {
              const { dias, totales, pendientes } = calculos[emp.codigo]
              const f = fichas[emp.codigo]
              const abierta = previa === emp.codigo
              return (
                <section key={emp.codigo} className="overflow-hidden rounded-xl border border-avior-line bg-metal shadow-lg shadow-black/40">
                  <div className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-words text-base font-semibold text-avior-ink">{f.nombre}</p>
                        <p className="break-all text-xs text-avior-muted">{archivoDe[emp.codigo]}</p>
                      </div>
                      {pendientes.length > 0 && <Insignia tono="aviso">{pendientes.length} por revisar</Insignia>}
                    </div>
                    <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
                      {TOTALES.map(([clave, etiqueta]) => (
                        <div key={clave} className="rounded-lg border border-avior-line bg-avior-well px-2 py-1.5 text-center">
                          <p className="text-[10px] text-avior-muted">{etiqueta}</p>
                          <p className={`text-sm font-bold ${totales[clave] ? 'text-avior-ink' : 'text-avior-muted/50'}`}>{fmtHoras(totales[clave])}</p>
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setPrevia(abierta ? '' : emp.codigo)}
                        aria-expanded={abierta}
                        className="flex min-h-[44px] items-center justify-center gap-1 rounded-lg border border-avior-line bg-avior-nav text-sm font-semibold text-avior-ink"
                      >
                        <ChevronDown className={`h-4 w-4 transition ${abierta ? 'rotate-180' : ''}`} aria-hidden /> Vista previa
                      </button>
                      <button
                        type="button"
                        disabled={ocupado}
                        onClick={() => descargarUno(emp)}
                        className="flex min-h-[44px] items-center justify-center gap-1 rounded-lg border border-avior-line bg-avior-nav text-sm font-semibold text-avior-ink disabled:opacity-50"
                      >
                        <Download className="h-4 w-4" aria-hidden /> Este Excel
                      </button>
                    </div>
                  </div>
                  {abierta && (
                    <div className="border-t border-avior-line p-3">
                      <VistaResultado
                        estado={{ ...estado, tecnico: tecnicoDe(emp), observaciones: f.observaciones }}
                        dias={dias}
                        totales={totales}
                        archivo={archivoDe[emp.codigo]}
                      />
                    </div>
                  )}
                </section>
              )
            })}
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
                {incluidos.length > 1 ? `Generar ${incluidos.length}` : 'Generar'}
              </Boton>
            </>
          ) : (
            <>
              <Boton variante="secundario" icono={Pencil} onClick={corregir} className="shrink-0 px-3" aria-label="Corregir">
                <span className="hidden sm:inline">Corregir</span>
              </Boton>
              <Boton variante="secundario" icono={Share2} onClick={compartirTodos} disabled={ocupado} className="flex-1">
                Compartir
              </Boton>
              <Boton icono={Download} onClick={descargarTodos} disabled={ocupado} className="flex-1">
                Descargar
              </Boton>
            </>
          )}
        </div>
      </footer>
    </>
  )
}
