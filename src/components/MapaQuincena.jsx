import { useEffect, useState } from 'react'
import { ArrowLeftRight, Check, PencilLine, RotateCcw, TriangleAlert, X } from 'lucide-react'
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
  const { fecha, asignado, entrada, salida, cambio, resultado: r } = dia
  const tono = tonoTurno(asignado)
  const pendiente = ESTADOS_PENDIENTES.includes(r.estado)
  const ds = diaSemana(fecha)
  const extras = r.diurnas + r.mixtas + r.nocturnas
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      aria-label={`${NOMBRES_DIA[ds]} ${isoADmy(fecha)}: ${textoHorario(asignado)}`}
      className={`relative flex min-h-[86px] flex-col overflow-hidden rounded-lg border text-left transition active:scale-[0.97] ${
        activo ? 'border-avior-light ring-2 ring-avior-bright' : 'border-avior-line'
      } bg-avior-well`}
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
      <span className="px-1.5 text-[10px] leading-tight text-avior-muted">
        {entrada || salida ? `${entrada || '?'}–${salida || '?'}` : '—'}
      </span>
      <span className="mt-auto flex items-center gap-1 px-1.5 pb-1">
        {extras > 0 && <span className="text-[10px] font-bold text-avior-ink">+{fmtHoras(extras)}h</span>}
        {cambio && <ArrowLeftRight className="h-3 w-3 text-sky-300" aria-label="Cambio de guardia" />}
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

function Editor({ dia, catalogo, bloqueado, onAjuste, onRestablecer }) {
  const { fecha, original, asignado, marcas, entrada, salida, cambio, sugerencia, resultado: r } = dia
  const [otro, setOtro] = useState(false)
  useEffect(() => setOtro(false), [fecha])
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
                type="time"
                value={v || ''}
                disabled={bloqueado}
                onChange={(e) => onAjuste(fecha, { [k]: e.target.value || undefined })}
                className={inputHora}
              />
            </label>
          ))}
        </div>
      </div>

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
  return (
    <div className="space-y-3">
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
        <span className="flex items-center gap-1"><PencilLine className="h-3 w-3" /> Toca un día para editarlo</span>
      </div>
      <Editor dia={dia} catalogo={catalogo} bloqueado={bloqueado} onAjuste={onAjuste} onRestablecer={onRestablecer} />
    </div>
  )
}
