import { describe, expect, it } from 'vitest'
import { detectarCambio } from '../src/lib/guardia.js'
import { interpretarHorario, interpretarTurno } from '../src/lib/horario.js'
import { calcularDia, totalizar } from '../src/lib/motor.js'
import { armarQuincena, diasQuincena, textoCambiosGuardia } from '../src/lib/periodo.js'
import { ponerObservaciones } from '../src/lib/formato.js'

const M = { inicio: '04:30', fin: '12:30' }
const T = { inicio: '13:00', fin: '21:00' }
const HD = [M, T]
const MIQ = [{ inicio: '05:00', fin: '13:00' }, { inicio: '08:00', fin: '16:30' }, T]

describe('interpretarTurno', () => {
  it('"05:00 - 01:00" (formato 12 h) → 05:00–13:00 con nota', () => {
    const t = interpretarTurno('05:00 - 01:00')
    expect(t).toMatchObject({ inicio: '05:00', fin: '13:00' })
    expect(t.nota).toContain('05:00 - 01:00')
  })
  it('turno nocturno real de 8 h se respeta', () => {
    expect(interpretarTurno('21:00 - 05:00')).toEqual({ inicio: '21:00', fin: '05:00' })
  })
  it('turnos normales sin nota', () => {
    expect(interpretarTurno('04:30 - 12:30')).toEqual(M)
    expect(interpretarTurno('LIBRE')).toBeNull()
  })
})

describe('interpretarHorario: año corregido por los días de la semana', () => {
  // Caso real de MIQ: fechas con 2025 y columna de días que corresponde a 2026
  const serial = (y, m, d) => Date.UTC(y, m - 1, d) / 86400000 + 25569
  const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves']
  const filas = [
    [null, null, 'Alejandro De Sousa'],
    ...dias.map((n, i) => [n, serial(2025, 11, i + 1), i % 2 ? 'LIBRE' : '08:00 - 16:30']),
  ]
  it('ajusta 2025 → 2026', () => {
    const h = interpretarHorario(filas)
    expect(h.ajusteAnio).toEqual({ de: 2025, a: 2026 })
    expect(h.desde).toBe('2026-11-01')
    expect(h.porTecnico['Alejandro De Sousa']['2026-11-01']).toEqual({ inicio: '08:00', fin: '16:30' })
  })
  it('sin columna de días no toca el año', () => {
    const h = interpretarHorario(filas.map((f) => [null, ...f.slice(1)]))
    expect(h.ajusteAnio).toBeUndefined()
    expect(h.desde).toBe('2025-11-01')
  })
})

describe('detectarCambio', () => {
  it('Luis 07/11: asignado 04:30–12:30, marcó 13:24–21:09 → cambio automático a 13:00–21:00', () => {
    expect(detectarCambio(M, '13:24', '21:09', HD)).toMatchObject({ tipo: 'auto', turno: T })
  })
  it('Nelson 19/10: llegada tardía (08:39) no es cambio de guardia', () => {
    expect(detectarCambio(M, '08:39', '13:06', HD)).toBeNull()
  })
  it('salida normal con extra no es cambio', () => {
    expect(detectarCambio(M, '04:04', '13:08', HD)).toBeNull()
  })
  it('Alejandro 12/11: asignado 08:00–16:30, marcó 04:46–14:52 → sugiere 05:00–13:00', () => {
    expect(detectarCambio({ inicio: '08:00', fin: '16:30' }, '04:46', '14:52', MIQ)).toMatchObject({
      tipo: 'sugerido', turno: { inicio: '05:00', fin: '13:00' },
    })
  })
  it('Antonio 05/11: entrada temprana en turno de tarde no es cambio', () => {
    expect(detectarCambio(T, '11:51', '19:49', MIQ)).toBeNull()
  })
})

// Luis, 1.ª quincena de noviembre 2026 (Horario_HelpDesk + marcaje real)
const H_NOV = {
  '2026-11-01': M, '2026-11-02': M, '2026-11-03': T, '2026-11-04': T, '2026-11-05': null, '2026-11-06': null,
  '2026-11-07': M, '2026-11-08': M, '2026-11-09': T, '2026-11-10': T, '2026-11-11': null, '2026-11-12': null,
  '2026-11-13': M, '2026-11-14': M, '2026-11-15': T,
}
const MARCAS_NOV = {
  '2026-11-01': ['04:43', '04:45', '07:49', '13:05'], '2026-11-02': ['04:17', '04:20', '13:03'],
  '2026-11-03': ['13:01', '17:53', '21:02'], '2026-11-04': ['13:10', '21:02', '21:11'],
  '2026-11-07': ['13:24', '21:04', '21:09'], '2026-11-08': ['04:51', '04:52', '07:19', '07:21', '13:03'],
  '2026-11-09': ['12:55', '18:58', '21:02', '21:11'], '2026-11-10': ['13:51', '20:59', '21:09'],
  '2026-11-13': ['04:14', '04:44', '07:18', '07:53', '12:59'], '2026-11-14': ['04:15', '04:17', '13:03'],
  '2026-11-15': ['13:29', '20:59', '21:05'],
}
const quincenaNov = (ajustes = {}) => armarQuincena(diasQuincena(2026, 11, 1), H_NOV, MARCAS_NOV, ajustes, { catalogo: HD, feriados: [] })

describe('Luis, 1.ª quincena de noviembre 2026', () => {
  it('07/11 se calcula como cambio de guardia (13:00–21:00), sin horas extras', () => {
    const d = quincenaNov().find((x) => x.fecha === '2026-11-07')
    expect(d.cambio).toMatchObject({ auto: true, a: T })
    expect(d.resultado).toMatchObject({ bono: 2, diurnas: 0, mixtas: 0, nocturnas: 0 })
  })
  it('totales: 14,5 h bono, 2,5 h extras diurnas, 3 domingos', () => {
    const t = totalizar(quincenaNov().map((d) => d.resultado))
    expect(t).toMatchObject({ bono: 14.5, diurnas: 2.5, mixtas: 0, nocturnas: 0, domingo: 3, descanso: 0 })
  })
  it('"No fue cambio de guardia" vuelve al horario del Excel', () => {
    const d = quincenaNov({ '2026-11-07': { cambio: false } }).find((x) => x.fecha === '2026-11-07')
    expect(d.cambio).toBeNull()
    expect(d.resultado.estado).toBe('revisar') // marcas sin relación con 04:30–12:30
  })
  it('cambio manual del horario asignado', () => {
    const d = quincenaNov({ '2026-11-05': { asignado: T, entrada: '13:00', salida: '21:30' } }).find((x) => x.fecha === '2026-11-05')
    expect(d.cambio).toMatchObject({ auto: false, de: null, a: T })
    expect(d.resultado).toMatchObject({ bono: 2, nocturnas: 0.5, descanso: 0 })
  })
  it('feriado marcado a mano en un día laborado', () => {
    const d = quincenaNov({ '2026-11-03': { feriado: true } }).find((x) => x.fecha === '2026-11-03')
    expect(d.resultado.feriado).toBe(1)
  })
  it('línea de observación con los cambios de guardia', () => {
    expect(textoCambiosGuardia(quincenaNov())).toBe('Cambio de guardia: 07/11 tenía 04:30 a 12:30, laboró 13:00 a 21:00.')
  })
})

describe('casos especiales del motor', () => {
  it('turno que cruza la medianoche', () => {
    const r = calcularDia({ fecha: '2026-11-03', asignado: { inicio: '21:00', fin: '05:00' }, entrada: '20:58', salida: '05:40' })
    expect(r).toMatchObject({ estado: 'normal', bono: 8, diurnas: 0.5 })
  })
  it('marcas sin relación con el turno → revisar, sin calcular', () => {
    const r = calcularDia({ fecha: '2026-11-07', asignado: { inicio: '08:00', fin: '16:30' }, entrada: '04:14', salida: '05:45' })
    expect(r.estado).toBe('revisar')
    expect(r.mixtas + r.diurnas + r.nocturnas + r.bono).toBe(0)
  })
})

describe('observaciones en el formato', () => {
  const fila = '<row r="31" spans="1:11" ht="15" customHeight="1"><c r="A31" s="62" t="s"><v>34</v></c></row>'
  it('conserva la etiqueta y agranda la fila según el texto', () => {
    const x = ponerObservaciones(fila, 'a'.repeat(300))
    expect(x).toContain('20. Observaciones: aaa')
    expect(x).toMatch(/ht="26"/)
  })
  it('sin texto deja la etiqueta y el alto original', () => {
    const x = ponerObservaciones(fila, '')
    expect(x).toContain('>20. Observaciones: </t>')
    expect(x).toMatch(/ht="15"/)
  })
})
