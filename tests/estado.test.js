import { describe, expect, it } from 'vitest'
import { migrateState } from '../src/lib/estado.js'

describe('migrateState', () => {
  it('completa un estado guardado por la versión anterior (sin firmantes)', () => {
    const viejo = {
      v: 1,
      tecnico: { nombre: 'Luis', cedula: '1', codigo: '2' },
      periodo: { anio: 2026, mes: 10, quincena: 2, desde: '2026-10-15', hasta: '2026-10-31' },
      horario: null, columna: '', marcaje: null, empleado: '', ajustes: {}, generado: null,
    }
    const s = migrateState(viejo)
    expect(s.tecnico).toEqual({ nombre: 'Luis', cedula: '1', codigo: '2' })
    expect(s.firmantes.revisor1).toEqual({ nombre: '', cedula: '' })
    expect(s.firmantes.aprobador).toEqual({ nombre: '', cedula: '' })
    expect(s.periodo.desde).toBe('2026-10-15')
  })
  it('repara firmantes dañados', () => {
    const s = migrateState({ firmantes: { revisor1: 'x', revisor2: { nombre: 5 } } })
    expect(s.firmantes.revisor1).toEqual({ nombre: '', cedula: '' })
    expect(s.firmantes.revisor2).toEqual({ nombre: '', cedula: '' })
  })
  it('basura → estado inicial', () => {
    expect(migrateState('hola').tecnico.nombre).toBe('')
  })
})
