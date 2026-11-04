import { describe, expect, it } from 'vitest'
import { calcularDia, clasificarTramo, minutosNocturnos, redondearHoras, totalizar } from '../src/lib/motor.js'

const M = { inicio: '04:30', fin: '12:30' }
const T = { inicio: '13:00', fin: '21:00' }
const L = null

const resumen = (r) =>
  Object.entries({ D: r.bono, E: r.diurnas, F: r.mixtas, G: r.nocturnas, H: r.domingo, I: r.descanso, J: r.feriado })
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}${v}`)
    .join(' ')

// Caso real: Luis Curbata, 16–31/10/2026, formato corregido por la jefatura (03/11/2026)
const LUIS_OCTUBRE = [
  ['2026-10-16', T, '12:51', '21:09', 'D2'],
  ['2026-10-17', T, '12:54', '21:07', 'D2'],
  ['2026-10-18', L, null, null, ''],
  ['2026-10-19', L, null, null, ''],
  ['2026-10-20', M, '04:22', '13:07', 'D0.5 E0.5'],
  ['2026-10-21', M, '04:04', '13:08', 'D0.5 E0.5 G0.5'],
  ['2026-10-22', T, '12:50', '21:09', 'D2'],
  ['2026-10-23', T, '12:41', '21:06', 'D2'],
  ['2026-10-24', L, null, null, ''],
  ['2026-10-25', L, null, null, ''],
  ['2026-10-26', M, '04:27', '13:00', 'D0.5 E0.5'],
  ['2026-10-27', M, '03:58', '12:57', 'D0.5 E0.5 G0.5'],
  ['2026-10-28', T, '12:43', '21:01', 'D2'],
  ['2026-10-29', T, '13:00', '21:01', 'D2'],
  ['2026-10-30', L, null, null, ''],
  ['2026-10-31', L, null, null, ''],
]

describe('Luis Curbata, 2.ª quincena de octubre 2026 (formato corregido)', () => {
  for (const [fecha, asignado, entrada, salida, esperado] of LUIS_OCTUBRE) {
    it(`${fecha} ${entrada ?? 'libre'}–${salida ?? ''}`, () => {
      expect(resumen(calcularDia({ fecha, asignado, entrada, salida }))).toBe(esperado)
    })
  }
  it('totales: 14 h de bono, 2 h diurnas, 1 h nocturna', () => {
    const t = totalizar(LUIS_OCTUBRE.map(([fecha, asignado, entrada, salida]) => calcularDia({ fecha, asignado, entrada, salida })))
    expect(t).toMatchObject({ bono: 14, diurnas: 2, mixtas: 0, nocturnas: 1, domingo: 0, descanso: 0, feriado: 0 })
  })
})

describe('casos del formato de Juan Natera (columnas que no cambian con la corrección)', () => {
  it('domingo dentro de la rotación', () => {
    expect(resumen(calcularDia({ fecha: '2026-10-18', asignado: T, entrada: '12:43', salida: '21:05' }))).toBe('D2 H1')
  })
  it('día libre laborado → descanso legal, sin horas', () => {
    expect(resumen(calcularDia({ fecha: '2026-10-27', asignado: L, entrada: '12:40', salida: '16:30' }))).toBe('I1')
  })
  it('llegar tarde no reduce el bono nocturno', () => {
    expect(resumen(calcularDia({ fecha: '2026-10-28', asignado: M, entrada: '04:35', salida: '12:59' }))).toBe('D0.5 E0.5')
  })
  it('salida 24 min después cuenta 0,5', () => {
    expect(calcularDia({ fecha: '2026-10-29', asignado: M, entrada: '04:30', salida: '12:54' }).diurnas).toBe(0.5)
  })
})

describe('redondeo (umbral 20 min, pendiente de confirmar)', () => {
  it.each([
    [0, 0], [19, 0], [20, 0.5], [29, 0.5], [30, 0.5], [49, 0.5], [50, 1], [60, 1], [95, 1.5],
  ])('%i min → %f h', (min, h) => expect(redondearHoras(min, 20)).toBe(h))
})

describe('franjas', () => {
  it('turno de tarde tiene 120 min nocturnos', () => expect(minutosNocturnos(780, 1260)).toBe(120))
  it('turno de madrugada tiene 30 min nocturnos', () => expect(minutosNocturnos(270, 750)).toBe(30))
  it('cruce de medianoche', () => expect(minutosNocturnos(1320, 120)).toBe(240))
  it('tramo 21:00–23:00 es nocturno', () => expect(clasificarTramo(1260, 1380)).toBe('nocturnas'))
  it('tramo 12:30–14:00 es diurno', () => expect(clasificarTramo(750, 840)).toBe('diurnas'))
  it('tramo 17:00–21:00 es mixto', () => expect(clasificarTramo(1020, 1260)).toBe('mixtas'))
  it('quedarse hasta las 22:00 en turno de tarde → 1 h nocturna', () => {
    expect(resumen(calcularDia({ fecha: '2026-10-16', asignado: T, entrada: '13:00', salida: '22:00' }))).toBe('D2 G1')
  })
})

describe('estados a revisar', () => {
  it('turno sin marcaje', () => {
    const r = calcularDia({ fecha: '2026-10-16', asignado: T, entrada: null, salida: null })
    expect(r.estado).toBe('sin-marcaje')
    expect(r.bono).toBe(0)
  })
  it('una sola marca: da el bono pero no calcula extras', () => {
    const r = calcularDia({ fecha: '2026-10-16', asignado: T, entrada: '12:50', salida: null })
    expect(r.estado).toBe('incompleto')
    expect(resumen(r)).toBe('D2')
  })
  it('horario no reconocido', () => {
    expect(calcularDia({ fecha: '2026-10-16', asignado: { texto: 'VAC' }, entrada: null, salida: null }).estado).toBe('revisar')
  })
  it('feriado laborado', () => {
    expect(calcularDia({ fecha: '2026-10-16', asignado: T, entrada: '13:00', salida: '21:00', feriado: true }).feriado).toBe(1)
  })
})
