// Secciones comunes a los módulos individual y masivo.
import { useState } from 'react'
import { CalendarDays, CalendarRange, Check, Headset, MessageSquareText, Pencil, PenLine, UserRound, Users } from 'lucide-react'
import { MAX_OBSERVACIONES } from '../lib/formato.js'
import { normalizar } from '../lib/horario.js'
import { nombrePropio } from '../lib/marcaje.js'
import { formatoCedula, lineasObservacion } from '../lib/periodo.js'
import { isoADmy, NOMBRES_MES } from '../lib/tiempo.js'
import { BotonArchivo, Campo, Insignia, Seccion } from './ui.jsx'

export const FIRMANTES = [
  { clave: 'revisor1', titulo: '22. Revisado por', ejemplo: 'Ej.: María Pérez' },
  { clave: 'revisor2', titulo: '23. Revisado por', ejemplo: 'Ej.: José Rodríguez' },
  { clave: 'aprobador', titulo: '24. Aprobado por', ejemplo: 'Ej.: Ana Gómez' },
]

export function SelectorModo({ modo, onModo }) {
  const opciones = [
    ['individual', UserRound, 'Individual', 'Un técnico'],
    ['masivo', Users, 'Masivo', 'Varios técnicos'],
  ]
  return (
    <div role="tablist" aria-label="Módulo" className="grid grid-cols-2 gap-2 rounded-xl border border-avior-line bg-avior-silver p-1.5">
      {opciones.map(([k, Icono, titulo, sub]) => (
        <button
          key={k}
          type="button"
          role="tab"
          aria-selected={modo === k}
          onClick={() => onModo(k)}
          className={`flex min-h-[52px] items-center justify-center gap-2 rounded-lg px-2 transition active:scale-[0.98] ${
            modo === k ? 'bg-avior-bright text-white shadow-md shadow-black/40' : 'text-avior-muted hover:bg-avior-nav'
          }`}
        >
          <Icono className="h-5 w-5 shrink-0" aria-hidden />
          <span className="text-left leading-tight">
            <span className="block text-sm font-semibold">{titulo}</span>
            <span className={`block text-[11px] ${modo === k ? 'text-white/80' : 'text-avior-muted'}`}>{sub}</span>
          </span>
        </button>
      ))}
    </div>
  )
}

export function AvisoBloqueado({ visible }) {
  if (!visible) return null
  return (
    <p className="rounded-lg border border-avior-line bg-avior-panel px-3 py-2 text-xs text-avior-muted">
      El formato ya está generado. Pulsa <b className="text-avior-ink">Corregir</b> para editar.
    </p>
  )
}

export function Credito() {
  return (
    <p className="flex items-center justify-center gap-2 pt-4 text-xs text-avior-muted">
      <Headset className="h-4 w-4" aria-hidden />
      Desarrollado por: <b className="text-avior-ink">HelpDesk Avior</b>
    </p>
  )
}

export function SeccionFirmantes({ firmantes, errores, bloqueado, onFirmante }) {
  const completos = FIRMANTES.every((f) => firmantes[f.clave].nombre.trim())
  return (
    <Seccion icono={PenLine} titulo="Firmantes" estado={completos && <Insignia tono="ok">Listo</Insignia>}>
      <p className="text-xs text-avior-muted">
        Se guardan en este dispositivo para las próximas quincenas y sirven para los dos módulos. Las firmas se hacen a mano en
        el impreso.
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
              onChange={(e) => onFirmante(clave, 'nombre', e.target.value)}
            />
            <Campo
              id={`campo-${clave}-cedula`}
              etiqueta="Cédula"
              placeholder="Opcional"
              inputMode="numeric"
              value={firmantes[clave].cedula}
              disabled={bloqueado}
              onChange={(e) => onFirmante(clave, 'cedula', e.target.value)}
            />
          </div>
        </div>
      ))}
    </Seccion>
  )
}

export function SeccionQuincena({ periodo, bloqueado, onPeriodo, onCorte }) {
  const valorMes = `${periodo.anio}-${String(periodo.mes).padStart(2, '0')}`
  return (
    <Seccion icono={CalendarRange} titulo="Quincena">
      <div className="grid grid-cols-2 gap-3">
        <Campo
          etiqueta="Mes"
          type="month"
          value={valorMes}
          disabled={bloqueado}
          onChange={(e) => {
            const [a, m] = e.target.value.split('-').map(Number)
            if (a && m) onPeriodo(a, m, periodo.quincena)
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
                onClick={() => onPeriodo(periodo.anio, periodo.mes, q)}
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
          onChange={(e) => onCorte({ desde: e.target.value })}
        />
        <Campo
          etiqueta="Fecha de corte: hasta"
          type="date"
          value={periodo.hasta}
          disabled={bloqueado}
          onChange={(e) => onCorte({ hasta: e.target.value })}
        />
      </div>
      <p className="text-xs text-avior-muted">
        {NOMBRES_MES[periodo.mes - 1]} {periodo.anio}. La fecha de corte va en el campo Periodo del formato.
      </p>
    </Seccion>
  )
}

// Horario del mes. `children` recibe el selector de columna (individual) o una nota (masivo).
export function SeccionHorario({ horario, cubre, listo, bloqueado, error, onArchivo, children }) {
  return (
    <Seccion icono={CalendarDays} titulo="Horario del mes" estado={listo && <Insignia tono="ok">Listo</Insignia>}>
      <BotonArchivo
        id="campo-horario"
        etiqueta="Cargar horario (.xlsx)"
        archivo={horario?.archivo}
        disabled={bloqueado}
        error={error}
        onArchivo={onArchivo}
      />
      {horario && (
        <>
          <p className="text-xs text-avior-muted">
            Cubre del {isoADmy(horario.desde)} al {isoADmy(horario.hasta)}
          </p>
          {horario.ajusteAnio && (
            <p className="text-xs font-medium text-amber-300">
              Las fechas del Excel dicen {horario.ajusteAnio.de}, pero los días de la semana corresponden a {horario.ajusteAnio.a}.
              Se usó {horario.ajusteAnio.a}.
            </p>
          )}
          {horario.notas?.map((n) => (
            <p key={n} className="text-xs font-medium text-amber-300">
              {n}. Si no es así, corrígelo en el mapa de la quincena.
            </p>
          ))}
          {!cubre && (
            <p className="text-xs font-medium text-amber-300">
              Este horario no cubre todos los días de la quincena elegida. Revisa el mes o carga el horario correcto.
            </p>
          )}
          {children}
        </>
      )}
    </Seccion>
  )
}

/**
 * Datos del técnico tomados del marcaje: nombre (con corrección de tildes), cédula y código.
 * @param {string} idBase prefijo de los id de los campos ("campo" → campo-nombre, campo-codigo)
 */
export function DatosTecnico({ tecnico, empleado, bloqueado, errores = {}, idBase = 'campo', onCambio, editando, onEditando }) {
  const delBioadmin = nombrePropio(empleado.nombre)
  const abierto = editando || !tecnico.nombre.trim()
  return (
    <>
      {abierto ? (
        <div className="space-y-2">
          <Campo
            id={`${idBase}-nombre`}
            etiqueta="Nombres y apellidos (corrige tildes si hace falta)"
            obligatorio
            autoComplete="off"
            value={tecnico.nombre}
            disabled={bloqueado}
            error={errores.nombre}
            onChange={(e) => onCambio('nombre', e.target.value)}
          />
          {tecnico.nombre.trim() && (
            <button
              type="button"
              onClick={() => onEditando(false)}
              className="flex min-h-[40px] items-center gap-1 text-xs font-semibold text-avior-light"
            >
              <Check className="h-3.5 w-3.5" aria-hidden /> Listo
            </button>
          )}
        </div>
      ) : (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-avior-line bg-avior-well px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-xs text-avior-muted">Nombres y apellidos</p>
            <p className="break-words text-base font-semibold text-avior-ink">{tecnico.nombre}</p>
          </div>
          {!bloqueado && (
            <button
              type="button"
              onClick={() => onEditando(true)}
              className="flex min-h-[40px] shrink-0 items-center gap-1 text-xs font-semibold text-avior-light"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden /> Corregir tildes
            </button>
          )}
        </div>
      )}
      {tecnico.nombre.trim() && normalizar(tecnico.nombre) !== normalizar(delBioadmin) && (
        <p className="text-xs font-medium text-amber-300">
          El nombre ya no coincide con el del Bioadmin ({delBioadmin}). Revisa que solo hayas cambiado tildes.
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-avior-line bg-avior-well px-3 py-2.5">
          <p className="text-xs text-avior-muted">Cédula</p>
          <p className="text-base font-semibold text-avior-ink">{formatoCedula(tecnico.cedula, '-')}</p>
        </div>
        {empleado.identificacion ? (
          <div className="rounded-lg border border-avior-line bg-avior-well px-3 py-2.5">
            <p className="text-xs text-avior-muted">Código de empleado</p>
            <p className="text-base font-semibold text-avior-ink">{tecnico.codigo}</p>
          </div>
        ) : (
          <Campo
            id={`${idBase}-codigo`}
            etiqueta="Código de empleado"
            obligatorio
            placeholder="Ej.: 10001234"
            inputMode="numeric"
            value={tecnico.codigo}
            disabled={bloqueado}
            error={errores.codigo}
            ayuda="Este marcaje no trae Núm. Identificación"
            onChange={(e) => onCambio('codigo', e.target.value)}
          />
        )}
      </div>
    </>
  )
}

// Campo 20 con el atajo para añadir lo anotado en el mapa
export function SeccionObservaciones({ id = 'campo-observaciones', valor, dias, bloqueado, onCambio, titulo = 'Observaciones (opcional)' }) {
  const nuevas = lineasObservacion(dias).filter((l) => !valor.includes(l))
  return (
    <Seccion icono={MessageSquareText} titulo={titulo}>
      <Campo
        as="textarea"
        id={id}
        etiqueta="Van en el campo 20 del formato"
        rows={3}
        maxLength={MAX_OBSERVACIONES}
        placeholder="Ej.: Cambio de guardia con Nelson Guanipa el 07/11."
        value={valor}
        disabled={bloqueado}
        className="resize-y"
        onChange={(e) => onCambio(e.target.value)}
        ayuda={`${valor.length}/${MAX_OBSERVACIONES} caracteres`}
      />
      {nuevas.length > 0 && !bloqueado && (
        <div className="space-y-1 rounded-lg bg-avior-well p-2 text-xs">
          <p className="text-avior-muted">Anotado en el mapa:</p>
          {nuevas.map((l) => (
            <p key={l} className="text-avior-ink">{l}</p>
          ))}
          <button
            type="button"
            onClick={() => onCambio([valor.trim(), ...nuevas].filter(Boolean).join('\n').slice(0, MAX_OBSERVACIONES))}
            className="flex min-h-[40px] items-center gap-1 font-semibold text-avior-light"
          >
            + Añadir a observaciones
          </button>
        </div>
      )}
    </Seccion>
  )
}

// Hook pequeño para el estado "corrigiendo el nombre" por clave (masivo: una por técnico)
export function useEdicionNombre() {
  const [abiertos, setAbiertos] = useState({})
  return [(k) => Boolean(abiertos[k]), (k, v) => setAbiertos((a) => ({ ...a, [k]: v }))]
}
