import { corteSugerido } from './periodo.js'

export const CLAVE = 'he-avior:v1'
const VERSION = 1

// Por defecto: la última quincena cerrada respecto a hoy.
export function periodoPorDefecto(hoy = new Date()) {
  let anio = hoy.getFullYear()
  let mes = hoy.getMonth() + 1
  let quincena
  if (hoy.getDate() >= 16) quincena = 1
  else {
    quincena = 2
    mes -= 1
    if (mes === 0) {
      mes = 12
      anio -= 1
    }
  }
  return { anio, mes, quincena, ...corteSugerido(anio, mes, quincena) }
}

export function estadoInicial() {
  return {
    v: VERSION,
    tecnico: { nombre: '', cedula: '', codigo: '' },
    firmantes: {
      revisor1: { nombre: '', cedula: '' },
      revisor2: { nombre: '', cedula: '' },
      aprobador: { nombre: '', cedula: '' },
    },
    periodo: periodoPorDefecto(),
    horario: null,
    columna: '',
    marcaje: null,
    empleado: '',
    ajustes: {},
    generado: null,
  }
}

const obj = (x) => (x && typeof x === 'object' && !Array.isArray(x) ? x : null)
const txt = (x) => (typeof x === 'string' ? x : '')

// Completa o repara un estado guardado (estructura antigua, incompleta o dañada).
export function migrateState(saved) {
  const base = estadoInicial()
  const s = obj(saved)
  if (!s) return base
  const t = obj(s.tecnico) || {}
  const f = obj(s.firmantes) || {}
  const persona = (x) => ({ nombre: txt(obj(x)?.nombre), cedula: txt(obj(x)?.cedula) })
  const p = obj(s.periodo) || {}
  const periodoOk =
    Number.isInteger(p.anio) && Number.isInteger(p.mes) && p.mes >= 1 && p.mes <= 12 && (p.quincena === 1 || p.quincena === 2)
  const periodo = periodoOk
    ? { ...corteSugerido(p.anio, p.mes, p.quincena), ...p, desde: txt(p.desde) || corteSugerido(p.anio, p.mes, p.quincena).desde, hasta: txt(p.hasta) || corteSugerido(p.anio, p.mes, p.quincena).hasta }
    : base.periodo
  const h = obj(s.horario)
  const horario = h && Array.isArray(h.tecnicos) && obj(h.porTecnico) ? h : null
  const m = obj(s.marcaje)
  const marcaje = m && Array.isArray(m.marcas) && Array.isArray(m.empleados) ? m : null
  return {
    ...base,
    tecnico: { nombre: txt(t.nombre), cedula: txt(t.cedula), codigo: txt(t.codigo) },
    firmantes: { revisor1: persona(f.revisor1), revisor2: persona(f.revisor2), aprobador: persona(f.aprobador) },
    periodo,
    horario,
    columna: horario && horario.tecnicos.includes(s.columna) ? s.columna : '',
    marcaje,
    empleado: marcaje && marcaje.empleados.some((e) => e.codigo === s.empleado) ? s.empleado : '',
    ajustes: obj(s.ajustes) || {},
    generado: obj(s.generado),
  }
}
