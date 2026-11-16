// Días con turno y sin marcas en el Bioadmin (falla del biométrico, de luz o de la descarga):
// el técnico los completa a mano o indica una ausencia.
import { readFileSync } from 'node:fs'
import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { migrateState } from '../src/lib/estado.js'
import { llenarFormato } from '../src/lib/formato.js'
import { coberturaMarcaje } from '../src/lib/marcaje.js'
import { calcularDia, totalizar } from '../src/lib/motor.js'
import {
  armarQuincena, diagnosticoVacio, ESTADOS_PENDIENTES, lineasObservacion, textoAusencias, textoLaborado, textoMarcasManuales,
} from '../src/lib/periodo.js'

const M = { inicio: '04:30', fin: '12:30' }
const T = { inicio: '13:00', fin: '21:00' }
const DIAS = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06']
const H = { '2026-11-01': M, '2026-11-02': M, '2026-11-03': T, '2026-11-04': T, '2026-11-05': M, '2026-11-06': M }
// Marcas del 1 al 6 sin el 5 (el ejemplo del caso)
const MARCAS = {
  '2026-11-01': ['04:25', '12:35'], '2026-11-02': ['04:20', '12:31'], '2026-11-03': ['12:55', '21:02'],
  '2026-11-04': ['12:58', '21:05'], '2026-11-06': ['04:27', '12:40'],
}
const marcaje = (codigos) => ({
  empleados: codigos.map((codigo) => ({ codigo })),
  marcas: Object.entries(MARCAS).flatMap(([fecha, hs]) => hs.map((hora) => ({ codigo: codigos[0], fecha, hora }))),
})
const armar = (ajustes = {}, cobertura = coberturaMarcaje(marcaje(['1']))) =>
  armarQuincena(DIAS, H, MARCAS, ajustes, { catalogo: [M, T], feriados: [], cobertura })
const dia5 = (ajustes, cob) => armar(ajustes, cob).find((d) => d.fecha === '2026-11-05')

describe('día con turno y sin marcas', () => {
  it('queda pendiente y señalado como vacío', () => {
    const d = dia5()
    expect(d.resultado.estado).toBe('sin-marcaje')
    expect(ESTADOS_PENDIENTES).toContain('sin-marcaje')
    expect(d.vacio).toBe('propio')
    expect(d.resultado).toMatchObject({ bono: 0, diurnas: 0, nocturnas: 0 })
  })
  it('los días libres sin marcas no se señalan', () => {
    const d = armarQuincena(['2026-11-05'], { '2026-11-05': null }, {}, {}, { feriados: [] })[0]
    expect(d.vacio).toBeNull()
    expect(d.resultado.estado).toBe('libre')
  })
})

describe('diagnóstico del día vacío', () => {
  it('archivo con varios empleados y nadie marcó ese día → falla general', () => {
    expect(dia5({}, coberturaMarcaje(marcaje(['1', '2']))).vacio).toBe('general')
  })
  it('día fuera de la descarga → fuera', () => {
    expect(diagnosticoVacio('2026-11-07', coberturaMarcaje(marcaje(['1'])))).toBe('fuera')
    expect(diagnosticoVacio('2026-10-31', coberturaMarcaje(marcaje(['1'])))).toBe('fuera')
  })
  it('sin información de cobertura → propio', () => {
    expect(diagnosticoVacio('2026-11-05', null)).toBe('propio')
  })
})

describe('"Trabajé, no se registró"', () => {
  it('con el horario asignado: bono del turno y sin horas extras', () => {
    const d = dia5({ '2026-11-05': { sinRegistro: true, entrada: '04:30', salida: '12:30' } })
    expect(d.sinRegistro).toBe(true)
    expect(d.resultado.estado).toBe('normal')
    expect(d.resultado).toMatchObject({ bono: 0.5, diurnas: 0, mixtas: 0, nocturnas: 0 })
    expect(d.resultado.detalle[0]).toContain('cargadas a mano')
    expect(textoLaborado(d)).toBe('04:30 a 12:30')
  })
  it('con la hora real corregida calcula las extras como un día normal', () => {
    const d = dia5({ '2026-11-05': { sinRegistro: true, entrada: '04:30', salida: '13:10' } })
    expect(d.resultado).toMatchObject({ bono: 0.5, diurnas: 0.5 })
  })
  it('línea para observaciones', () => {
    const dias = armar({ '2026-11-05': { sinRegistro: true, entrada: '04:30', salida: '12:30' } })
    expect(textoMarcasManuales(dias)).toBe('Sin registro en el biométrico: 05/11 (laborado 04:30 a 12:30).')
  })
})

describe('"No trabajé": ausencia', () => {
  it('el motor no da bono ni extras y no queda pendiente', () => {
    const r = calcularDia({ fecha: '2026-11-05', asignado: M, entrada: null, salida: null, ausencia: { tipo: 'permiso', etiqueta: 'Permiso' } })
    expect(r).toMatchObject({ estado: 'ausencia', bono: 0, diurnas: 0, nocturnas: 0, domingo: 0 })
    expect(ESTADOS_PENDIENTES).not.toContain('ausencia')
  })
  it('se arma con tipo, nota y columna K; el laborado queda vacío', () => {
    const d = dia5({ '2026-11-05': { ausencia: { tipo: 'permiso', nota: 'cita médica' } } })
    expect(d.ausencia).toEqual({ tipo: 'permiso', etiqueta: 'Permiso', columnaK: 'Permiso', nota: 'cita médica' })
    expect(d.resultado.estado).toBe('ausencia')
    expect(textoLaborado(d)).toBe('')
  })
  it('un tipo desconocido se ignora y el día sigue pendiente', () => {
    expect(dia5({ '2026-11-05': { ausencia: { tipo: 'xyz' } } }).resultado.estado).toBe('sin-marcaje')
  })
  it('los totales no cambian por la ausencia', () => {
    const base = totalizar(armar().map((d) => d.resultado))
    const conAusencia = totalizar(armar({ '2026-11-05': { ausencia: { tipo: 'inasistencia' } } }).map((d) => d.resultado))
    expect(conAusencia).toEqual(base)
  })
  it('líneas para observaciones', () => {
    const dias = armar({ '2026-11-05': { ausencia: { tipo: 'reposo', nota: 'gripe' } } })
    expect(textoAusencias(dias)).toBe('Ausencia: 05/11 Reposo médico, gripe.')
    expect(lineasObservacion(dias)).toEqual(['Ausencia: 05/11 Reposo médico, gripe.'])
  })
})

describe('formato oficial', () => {
  it('escribe el tipo de ausencia en la columna K del día', async () => {
    const dias = armar({ '2026-11-05': { ausencia: { tipo: 'permiso' } } })
    const salida = await llenarFormato(
      new Uint8Array(readFileSync('src/assets/plantilla_horas_extras.xlsx')),
      { tecnico: { nombre: 'Prueba Uno', cedula: '1234567', codigo: '1' }, corte: { desde: DIAS[0], hasta: DIAS[5] }, dias, totales: totalizar(dias.map((d) => d.resultado)) },
      'uint8array',
    )
    const hoja = await (await JSZip.loadAsync(salida)).file('xl/worksheets/sheet1.xml').async('string')
    // 05/11 es el 5.º día → fila 18
    expect(hoja).toMatch(/<c r="K18"[^>]*t="inlineStr"><is><t[^>]*>Permiso<\/t>/)
    expect(hoja).toMatch(/<c r="K17"[^>]*\/>/)
  })
})

describe('migrateState: ajustes del mapa', () => {
  it('conserva los ajustes válidos, incluidos sinRegistro y ausencia', () => {
    const ajustes = {
      '2026-11-05': { sinRegistro: true, entrada: '04:30', salida: '12:30' },
      '2026-11-06': { ausencia: { tipo: 'permiso', nota: 'x' } },
      '2026-11-07': { asignado: null, cambio: false, feriado: true },
      '2026-11-08': { asignado: { inicio: '13:00', fin: '21:00' } },
    }
    expect(migrateState({ ajustes }).ajustes).toEqual({
      ...ajustes,
      '2026-11-06': { ausencia: { tipo: 'permiso', nota: 'x' } },
    })
  })
  it('descarta claves desconocidas, horas mal escritas y fechas inválidas', () => {
    const s = migrateState({
      ajustes: { '2026-11-05': { entrada: '4:30', salida: 99, foo: 1, ausencia: 'x' }, malo: { entrada: '04:30' }, '2026-11-06': 3 },
    })
    expect(s.ajustes).toEqual({})
  })
  it('estados guardados antes de las observaciones quedan con texto vacío', () => {
    expect(migrateState({ ajustes: {} }).observaciones).toBe('')
  })
})
