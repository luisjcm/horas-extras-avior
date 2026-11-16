import { useEffect, useRef, useState } from 'react'
import { ArrowLeftRight, Check, Fingerprint, PencilLine, RotateCcw, TriangleAlert, UserX, X } from 'lucide-react'
import { tipoAusencia, TIPOS_AUSENCIA } from '../data/ausencias.js'
import { mismoTurno } from '../lib/guardia.js'
import { fmtHoras } from '../lib/motor.js'
import { ESTADOS_PENDIENTES, textoHorario } from '../lib/periodo.js'
import { aMinutos, diaSemana, isoADmy, NOMBRES_DIA } from '../lib/tiempo.js'
import { Insignia } from './ui.jsx'

// Color por tipo de turno, para comparar de un vistazo con el horario impreso
function tonoTurno(t) {
  if (t == null) return { banda: 'bg-red-900/80', texto: 'text-red-200', nombre: 'Libre' }
  if (t.texto != null) return { banda: 'bg-neutral-600', texto: 'text-neutral-200', nombre: 'Revisar' }
  const h = aMinutos(t.inicio) / 60
  if (h < 7) return { banda: 'bg-amber-500/80', texto: 'text-amber-100', nombre: 'Madrugada' }
  if (h < 12) return { banda: 'bg-teal-600/80', texto: 'text-teal-100', nombre: 'Mañana' }
  if (h < 18) return { banda: 'bg-sky-600/80', texto: 'text-sky-100', nombre: 'Tarde' }
  return { banda: 'bg-violet-600/80', texto: 'text-violet-100', nombre: 'Noche' }
}

export function chipsResultado(r) {
  const c = []
  if (r.bono) c.push(`Bono ${fmtHoras(r.bono)}`)
  if (r.diurnas) c.push(`Ext. diurna ${fmtHoras(r.diurnas)}`)
  if (r.mixtas) c.push(`Ext. mixta ${fmtHoras(r.mixtas)}`)
  if (r.nocturnas) c.push(`Ext. nocturna ${fmtHoras(r.nocturnas)}`)
  if (r.domingo) c.push('Domingo')
  if (r.descanso) c.push('Descanso laborado')
  if (r.feriado) c.push('Feriado')
  return c
}

const corto = (t) => (t == null ? 'Libre' : t.texto != null ? 'Revisar' : `${t.inicio}–${t.fin}`)

function Celda({ dia, activo, onClick }) {
  const { fecha, asignado, entrada, salida, cambio, ausencia, sinRegistro, resultado: r } = dia
  const tono = tonoTurno(asignado)
  const pendiente = ESTADOS_PENDIENTES.includes(r.estado)
  const vacio = r.estado === 'sin-marcaje'
  const ds = diaSemana(fecha)
  const extras = r.diurnas + r.mixtas + r.nocturnas
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      aria-label={`${NOMBRES_DIA[ds]} ${isoADmy(fecha)}: ${textoHorario(asignado)}`}
      className={`relative flex min-h-[86px] flex-col overflow-hidden rounded-lg text-left transition active:scale-[0.97] ${
        vacio ? 'border-2 border-dashed border-amber-400 bg-amber-950/50' : 'border bg-avior-well'
      } ${activo ? 'ring-2 ring-avior-bright' : ''} ${activo && !vacio ? 'border-avior-light' : !vacio ? 'border-avior-line' : ''}`}
    >
      <span className={`h-1.5 w-full ${tono.banda}`} />
      <span className="flex items-baseline justify-between px-1.5 pt-1">
        <span className="flex items-center gap-1">
          <span className="text-base font-bold leading-none text-avior-ink">{fecha.slice(8, 10)}</span>
          {pendiente && <span className="h-2 w-2 rounded-full bg-amber-400" aria-label="Por revisar" />}
        </span>
        <span className={`text-[10px] font-semibold ${ds === 0 ? 'text-avior-light' : 'text-avior-muted'}`}>
          {NOMBRES_DIA[ds].slice(0, 3)}
        </span>
      </span>
      <span className={`px-1.5 pt-1 text-[10px] font-semibold leading-tight ${tono.texto}`}>{corto(asignado)}</span>
      {vacio ? (
        <span className="flex items-center gap-1 px-1.5 text-[11px] font-bold leading-tight text-amber-300">
          <TriangleAlert className="h-3 w-3 shrink-0" aria-hidden /> Sin marcas
        </span>
      ) : ausencia ? (
        <span className="px-1.5 text-[11px] font-bold leading-tight text-red-300">{tipoAusencia(ausencia.tipo)?.corta}</span>
      ) : (
        <span className="px-1.5 text-[10px] leading-tight text-avior-muted">
          {entrada || salida ? `${entrada || '?'}–${salida || '?'}` : '—'}
        </span>
      )}
      <span className="mt-auto flex items-center gap-1 px-1.5 pb-1">
        {extras > 0 && <span className="text-[10px] font-bold text-avior-ink">+{fmtHoras(extras)}h</span>}
        {cambio && <ArrowLeftRight className="h-3 w-3 text-sky-300" aria-label="Cambio de guardia" />}
        {sinRegistro && <PencilLine className="h-3 w-3 text-avior-light" aria-label="Marcas cargadas a mano" />}
        {ausencia && <UserX className="h-3 w-3 text-red-300" aria-label="Ausencia" />}
      </span>
    </button>
  )
}

function Chip({ activo, children, ...props }) {
  return (
    <button
      type="button"
      className={`min-h-[40px] rounded-lg border px-3 text-xs font-semibold transition active:scale-[0.97] disabled:opacity-50 ${
        activo ? 'border-avior-bright bg-avior-bright text-white' : 'border-avior-line bg-avior-field text-avior-ink'
      }`}
      {...props}
    >
      {children}
    </button>
  )
}

const inputHora =
  'w-full min-w-0 rounded-lg border border-avior-line bg-avior-field px-2 py-2 text-sm text-avior-ink disabled:opacity-60'

const CAUSA_VACIO = {
  fuera: 'Este día no está en el archivo del Bioadmin que cargaste. Descarga un marcaje más reciente o complétalo aquí.',
  general:
    'Nadie tiene marcas este día en el archivo: parece una falla del biométrico, de luz o de la descarga.',
  propio: 'El Bioadmin no tiene marcas tuyas este día, aunque tenías turno.',
}

// Día con turno y sin marcas: el técnico indica si trabajó (y carga las horas) o si faltó.
function PanelVacio({ dia, bloqueado, onAjuste, onTrabaje }) {
  const { fecha, vacio, ausencia, sinRegistro } = dia
  const [eligiendo, setEligiendo] = useState(false)
  useEffect(() => setEligiendo(false), [fecha])
  const quitar = { sinRegistro: undefined, ausencia: undefined, entrada: undefined, salida: undefined }

  if (sinRegistro) {
    return (
      <div className="rounded-lg border border-avior-line bg-avior-well p-3 text-xs text-avior-ink">
        <p className="flex items-start gap-2">
          <Fingerprint className="mt-0.5 h-4 w-4 shrink-0 text-avior-light" aria-hidden />
          <span>
            <b>Marcas cargadas a mano.</b> Se llenaron con tu horario asignado. Si recuerdas la hora real de entrada o salida,
            corrígela abajo: las horas extras salen de ahí.
          </span>
        </p>
        {!bloqueado && (
          <button type="button" onClick={() => onAjuste(fecha, quitar)} className="mt-2 font-semibold text-avior-light underline">
            Deshacer
          </button>
        )}
      </div>
    )
  }

  if (ausencia || eligiendo) {
    return (
      <div className="space-y-3 rounded-lg border border-red-800 bg-red-950/40 p-3 text-xs text-red-100">
        <p className="flex items-start gap-2">
          <UserX className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            <b>No trabajaste este turno.</b> Elige el motivo: va en la columna 19 del formato y el día queda sin bono ni horas
            extras.
          </span>
        </p>
        <div className="flex flex-wrap gap-2">
          {TIPOS_AUSENCIA.map((t) => (
            <Chip
              key={t.id}
              activo={ausencia?.tipo === t.id}
              disabled={bloqueado}
              onClick={() => onAjuste(fecha, { ...quitar, ausencia: { tipo: t.id, nota: ausencia?.nota || '' } })}
            >
              {t.etiqueta}
            </Chip>
          ))}
        </div>
        {ausencia && (
          <label className="block">
            <span className="mb-1 block text-red-200/80">Detalle (opcional, va en observaciones)</span>
            <input
              type="text"
              maxLength={80}
              disabled={bloqueado}
              value={ausencia.nota}
              placeholder="Ej.: cita médica, permiso aprobado por el jefe"
              onChange={(e) => onAjuste(fecha, { ausencia: { tipo: ausencia.tipo, nota: e.target.value } })}
              className={`${inputHora} placeholder:text-avior-muted/60`}
            />
          </label>
        )}
        {!bloqueado && (
          <button
            type="button"
            onClick={() => {
              setEligiendo(false)
              onAjuste(fecha, quitar)
            }}
            className="font-semibold text-red-200 underline"
          >
            {ausencia ? 'Deshacer' : 'Volver'}
          </button>
        )}
      </div>
    )
  }

  return (
    <div role="alert" className="space-y-3 rounded-lg border-2 border-dashed border-amber-400 bg-amber-950/60 p-3 text-amber-50">
      <p className="flex items-start gap-2 text-sm">
        <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" aria-hidden />
        <span>
          <b>Este día no tiene marcas.</b> <span className="text-xs text-amber-100/90">{CAUSA_VACIO[vacio] || CAUSA_VACIO.propio}</span>
        </span>
      </p>
      {!bloqueado && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={onTrabaje}
            className="flex min-h-[52px] items-center justify-center gap-2 rounded-lg bg-avior px-3 text-sm font-semibold text-white transition hover:bg-avior-bright active:scale-[0.98]"
          >
            <Fingerprint className="h-4 w-4" aria-hidden /> Trabajé, no se registró
          </button>
          <button
            type="button"
            onClick={() => setEligiendo(true)}
            className="flex min-h-[52px] items-center justify-center gap-2 rounded-lg border border-avior-line bg-avior-nav px-3 text-sm font-semibold text-avior-ink transition active:scale-[0.98]"
          >
            <UserX className="h-4 w-4" aria-hidden /> No trabajé
          </button>
        </div>
      )}
    </div>
  )
}

function Editor({ dia, catalogo, bloqueado, onAjuste, onRestablecer }) {
  const { fecha, original, asignado, marcas, entrada, salida, cambio, sugerencia, resultado: r } = dia
  const [otro, setOtro] = useState(false)
  useEffect(() => setOtro(false), [fecha])
  const refEntrada = useRef(null)
  const [enfocar, setEnfocar] = useState(false)
  useEffect(() => {
    if (enfocar && dia.sinRegistro) {
      refEntrada.current?.focus()
      setEnfocar(false)
    }
  }, [enfocar, dia.sinRegistro])
  const conPanelVacio = Boolean(dia.vacio) && (r.estado === 'sin-marcaje' || dia.sinRegistro || dia.ausencia)
  const pidiendoDecision = conPanelVacio && !dia.sinRegistro
  const trabaje = () => {
    onAjuste(fecha, { sinRegistro: true, ausencia: undefined, entrada: asignado.inicio, salida: asignado.fin })
    setEnfocar(true)
  }
  // Marca incompleta: completar la que falta con la hora del horario asignado
  const faltante = r.estado === 'incompleto' && asignado?.inicio ? (entrada ? ['salida', asignado.fin] : ['entrada', asignado.inicio]) : null
  const esOtro = asignado?.inicio && !catalogo.some((t) => mismoTurno(t, asignado))
  const ds = diaSemana(fecha)

  return (
    <div className="animate-rise space-y-4 rounded-xl border border-avior-line bg-avior-panel p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-avior-ink">
          {NOMBRES_DIA[ds]} {isoADmy(fecha)}
        </p>
        {!bloqueado && (
          <button type="button" onClick={() => onRestablecer(fecha)} className="flex items-center gap-1 text-xs font-medium text-avior-light">
            <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Restablecer día
          </button>
        )}
      </div>

      {conPanelVacio && <PanelVacio dia={dia} bloqueado={bloqueado} onAjuste={onAjuste} onTrabaje={trabaje} />}

      {cambio?.auto && (
        <div className="rounded-lg border border-sky-700 bg-sky-950/60 p-3 text-xs text-sky-100">
          <p className="flex items-start gap-2">
            <ArrowLeftRight className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>
              <b>Cambio de guardia detectado.</b> El horario decía {textoHorario(cambio.de)} y marcaste {entrada}–{salida}. Se
              calcula con {textoHorario(cambio.a)}, sin contarlo como horas extras.
            </span>
          </p>
          {!bloqueado && (
            <button
              type="button"
              onClick={() => onAjuste(fecha, { cambio: false })}
              className="mt-2 flex items-center gap-1 font-semibold text-sky-200 underline"
            >
              <X className="h-3.5 w-3.5" aria-hidden /> No fue cambio de guardia
            </button>
          )}
        </div>
      )}

      {sugerencia && !cambio && (
        <div className="rounded-lg border border-amber-700 bg-amber-950/50 p-3 text-xs text-amber-100">
          <p className="flex items-start gap-2">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>
              <b>¿Cambio de guardia?</b> Tus marcas ({entrada}–{salida}) encajan mejor con {textoHorario(sugerencia)} que con el
              horario asignado ({textoHorario(original)}).
            </span>
          </p>
          {!bloqueado && (
            <div className="mt-2 flex gap-2">
              <Chip activo onClick={() => onAjuste(fecha, { asignado: sugerencia })}>
                <span className="flex items-center gap-1">
                  <Check className="h-3.5 w-3.5" aria-hidden /> Sí, aplicar
                </span>
              </Chip>
              <Chip onClick={() => onAjuste(fecha, { cambio: false })}>No, mantener</Chip>
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs font-medium text-avior-muted">
          Horario asignado
          {!cambio && original?.texto == null && <span className="text-avior-muted/70"> · del Excel: {textoHorario(original)}</span>}
        </p>
        <div className="flex flex-wrap gap-2">
          {catalogo.map((t) => (
            <Chip
              key={`${t.inicio}-${t.fin}`}
              activo={!otro && mismoTurno(asignado, t)}
              disabled={bloqueado}
              onClick={() => {
                setOtro(false)
                onAjuste(fecha, { asignado: t })
              }}
            >
              {t.inicio}–{t.fin}
            </Chip>
          ))}
          <Chip
            activo={!otro && asignado === null}
            disabled={bloqueado}
            onClick={() => {
              setOtro(false)
              onAjuste(fecha, { asignado: null })
            }}
          >
            Libre
          </Chip>
          <Chip activo={otro || esOtro} disabled={bloqueado} onClick={() => setOtro(true)}>
            Otro…
          </Chip>
        </div>
        {(otro || esOtro) && (
          <div className="grid grid-cols-2 gap-2">
            {['inicio', 'fin'].map((k) => (
              <label key={k} className="min-w-0">
                <span className="mb-1 block text-xs text-avior-muted">{k === 'inicio' ? 'Desde' : 'Hasta'}</span>
                <input
                  type="time"
                  disabled={bloqueado}
                  value={asignado?.[k] || ''}
                  onChange={(e) => {
                    const base = asignado?.inicio ? asignado : { inicio: '08:00', fin: '16:00' }
                    if (e.target.value) onAjuste(fecha, { asignado: { inicio: base.inicio, fin: base.fin, [k]: e.target.value } })
                  }}
                  className={inputHora}
                />
              </label>
            ))}
          </div>
        )}
      </div>

      {!pidiendoDecision && (
      <div className="space-y-2">
        <p className="text-xs font-medium text-avior-muted">
          Horario laborado · marcas: {marcas.length ? marcas.join(' · ') : 'ninguna'}
        </p>
        <div className="grid grid-cols-2 gap-2">
          {[
            ['entrada', 'Entrada', entrada],
            ['salida', 'Salida', salida],
          ].map(([k, t, v]) => (
            <label key={k} className="min-w-0">
              <span className="mb-1 block text-xs text-avior-muted">{t}</span>
              <input
                ref={k === 'entrada' ? refEntrada : undefined}
                type="time"
                value={v || ''}
                disabled={bloqueado}
                onChange={(e) => onAjuste(fecha, { [k]: e.target.value || undefined })}
                className={inputHora}
              />
            </label>
          ))}
        </div>
        {faltante && !bloqueado && (
          <button
            type="button"
            onClick={() => onAjuste(fecha, { [faltante[0]]: faltante[1], sinRegistro: true })}
            className="flex min-h-[40px] items-center gap-1 text-xs font-semibold text-avior-light"
          >
            <Fingerprint className="h-3.5 w-3.5" aria-hidden /> Falta la {faltante[0]}: usar la del horario ({faltante[1]})
          </button>
        )}
      </div>
      )}

      <label className="flex min-h-[44px] items-center gap-3 rounded-lg border border-avior-line bg-avior-field px-3">
        <input
          type="checkbox"
          checked={Boolean(dia.feriadoMarcado)}
          disabled={bloqueado}
          onChange={(e) => onAjuste(fecha, { feriado: e.target.checked })}
          className="h-5 w-5 accent-[#991C1F]"
        />
        <span className="text-sm text-avior-ink">Feriado</span>
        <span className="text-xs text-avior-muted">(cuenta si el día fue laborado)</span>
      </label>

      {(chipsResultado(r).length > 0 || r.detalle.length > 0) && (
        <div className="space-y-2 rounded-lg bg-avior-well p-3">
          <div className="flex flex-wrap gap-1">
            {chipsResultado(r).map((c) => (
              <Insignia key={c}>{c}</Insignia>
            ))}
          </div>
          <ul className="space-y-1 text-xs text-avior-ink">
            {r.detalle.map((d) => (
              <li key={d}>• {d}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export default function MapaQuincena({ dias, catalogo, bloqueado, onAjuste, onRestablecer }) {
  const primeroPendiente = dias.find((d) => ESTADOS_PENDIENTES.includes(d.resultado.estado))
  const [sel, setSel] = useState(primeroPendiente?.fecha || dias[0]?.fecha)
  const dia = dias.find((d) => d.fecha === sel) || dias[0]
  if (!dia) return null
  const vacios = dias.filter((d) => d.resultado.estado === 'sin-marcaje')
  return (
    <div className="space-y-3">
      {vacios.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border-2 border-dashed border-amber-400 bg-amber-950/50 p-3 text-amber-50">
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" aria-hidden />
          <div className="min-w-0 flex-1 space-y-2 text-xs">
            <p>
              <b className="text-sm">
                {vacios.length === 1 ? '1 día con turno y sin marcas' : `${vacios.length} días con turno y sin marcas`}
              </b>
              <br />
              Si trabajaste y el biométrico no lo registró, complétalo. Si no, indica el motivo.
            </p>
            <div className="flex flex-wrap gap-2">
              {vacios.map((d) => (
                <button
                  key={d.fecha}
                  type="button"
                  onClick={() => setSel(d.fecha)}
                  className={`min-h-[40px] rounded-lg border px-3 font-semibold ${
                    d.fecha === dia.fecha ? 'border-amber-300 bg-amber-400 text-black' : 'border-amber-600 text-amber-100'
                  }`}
                >
                  {NOMBRES_DIA[diaSemana(d.fecha)].slice(0, 3)} {d.fecha.slice(8, 10)}/{d.fecha.slice(5, 7)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-8">
        {dias.map((d) => (
          <Celda key={d.fecha} dia={d} activo={d.fecha === dia.fecha} onClick={() => setSel(d.fecha)} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-avior-muted">
        <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-sm bg-amber-500/80" /> Madrugada</span>
        <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-sm bg-teal-600/80" /> Mañana</span>
        <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-sm bg-sky-600/80" /> Tarde</span>
        <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-sm bg-violet-600/80" /> Noche</span>
        <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-sm bg-red-900/80" /> Libre</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400" /> Por revisar</span>
        <span className="flex items-center gap-1"><ArrowLeftRight className="h-3 w-3 text-sky-300" /> Cambio de guardia</span>
        <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-sm border border-dashed border-amber-400" /> Sin marcas</span>
        <span className="flex items-center gap-1"><PencilLine className="h-3 w-3 text-avior-light" /> Marcas a mano</span>
        <span className="flex items-center gap-1"><UserX className="h-3 w-3 text-red-300" /> Ausencia</span>
      </div>
      <Editor dia={dia} catalogo={catalogo} bloqueado={bloqueado} onAjuste={onAjuste} onRestablecer={onRestablecer} />
    </div>
  )
}
