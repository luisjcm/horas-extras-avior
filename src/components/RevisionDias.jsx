import { useState } from 'react'
import { ChevronDown, RotateCcw } from 'lucide-react'
import { fmtHoras } from '../lib/motor.js'
import { textoHorario } from '../lib/periodo.js'
import { diaSemana, isoADmy, NOMBRES_DIA } from '../lib/tiempo.js'
import { Insignia } from './ui.jsx'

const ESTADOS = {
  'sin-marcaje': ['aviso', 'Sin marcaje'],
  incompleto: ['aviso', 'Marca incompleta'],
  revisar: ['error', 'Revisar horario'],
  'libre-laborado': ['neutro', 'Libre laborado'],
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

function FilaDia({ dia, bloqueado, onAjuste }) {
  const [abierto, setAbierto] = useState(false)
  const { fecha, asignado, marcas, entrada, salida, ajustado, resultado: r } = dia
  const estado = ESTADOS[r.estado]
  const chips = chipsResultado(r)
  const nombre = NOMBRES_DIA[diaSemana(fecha)]
  return (
    <li className="border-b border-avior-line last:border-0">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="flex w-full items-start gap-3 px-1 py-3 text-left active:bg-avior-field/50"
        aria-expanded={abierto}
      >
        <span className="w-14 shrink-0">
          <span className="block text-sm font-semibold text-avior-ink">{isoADmy(fecha).slice(0, 5)}</span>
          <span className={`block text-xs ${nombre === 'Domingo' ? 'text-avior-light' : 'text-avior-muted'}`}>{nombre.slice(0, 3)}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm text-avior-ink">
            {textoHorario(asignado)}
            {(entrada || salida) && (
              <span className="text-avior-muted"> · marcó {entrada || '--:--'} a {salida || '--:--'}</span>
            )}
          </span>
          <span className="mt-1 flex flex-wrap gap-1">
            {estado && <Insignia tono={estado[0]}>{estado[1]}</Insignia>}
            {ajustado && <Insignia tono="aviso">Ajustado a mano</Insignia>}
            {chips.map((c) => (
              <Insignia key={c}>{c}</Insignia>
            ))}
          </span>
        </span>
        <ChevronDown className={`mt-1 h-4 w-4 shrink-0 text-avior-muted transition ${abierto ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {abierto && (
        <div className="mb-3 animate-rise space-y-3 rounded-lg bg-avior-well p-3">
          <div>
            <p className="text-xs font-medium text-avior-muted">Marcas del Bioadmin</p>
            <p className="text-sm text-avior-ink">{marcas.length ? marcas.join(' · ') : 'Ninguna'}</p>
          </div>
          {r.detalle.length > 0 && (
            <ul className="space-y-1 text-xs text-avior-ink">
              {r.detalle.map((d) => (
                <li key={d}>• {d}</li>
              ))}
            </ul>
          )}
          <div className="grid grid-cols-2 gap-2">
            <label className="min-w-0">
              <span className="mb-1 block text-xs text-avior-muted">Entrada</span>
              <input
                type="time"
                value={entrada || ''}
                disabled={bloqueado}
                onChange={(e) => onAjuste(fecha, { entrada: e.target.value })}
                className="w-full min-w-0 rounded-lg border border-avior-line bg-avior-field px-2 py-2 text-sm text-avior-ink disabled:opacity-60"
              />
            </label>
            <label className="min-w-0">
              <span className="mb-1 block text-xs text-avior-muted">Salida</span>
              <input
                type="time"
                value={salida || ''}
                disabled={bloqueado}
                onChange={(e) => onAjuste(fecha, { salida: e.target.value })}
                className="w-full min-w-0 rounded-lg border border-avior-line bg-avior-field px-2 py-2 text-sm text-avior-ink disabled:opacity-60"
              />
            </label>
          </div>
          {ajustado && !bloqueado && (
            <button
              type="button"
              onClick={() => onAjuste(fecha, null)}
              className="flex items-center gap-1 text-xs font-medium text-avior-light"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Volver a las marcas del Bioadmin
            </button>
          )}
        </div>
      )}
    </li>
  )
}

export default function RevisionDias({ dias, bloqueado, onAjuste }) {
  return (
    <ul>
      {dias.map((d) => (
        <FilaDia key={d.fecha} dia={d} bloqueado={bloqueado} onAjuste={onAjuste} />
      ))}
    </ul>
  )
}
