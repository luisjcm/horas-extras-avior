// Formato nuevo del Bioadmin: Código = cédula, Núm. Identificación = código de empleado.
// Los datos del técnico se toman del marcaje.
import { describe, expect, it } from 'vitest'
import { sugerirTecnico } from '../src/lib/horario.js'
import { interpretarMarcaje, nombrePropio, tecnicoDesdeMarcaje } from '../src/lib/marcaje.js'

const CAB_NUEVA = ['Código', 'Nombre', 'Puesto', 'Hora Marca', 'Núm. Identificación']
const fila = (cod, nom, hm, idn) => [cod, nom, 'Analista de Help Desk', hm, idn]

describe('interpretarMarcaje con Núm. Identificación', () => {
  it('lee el código de empleado de cada trabajador', () => {
    const m = interpretarMarcaje([
      CAB_NUEVA,
      fila(11111111, 'PRUEBA UNO, ANA MARIA', '15-11-2026 21:05:07', '10000001'),
      fila(11111111, 'PRUEBA UNO, ANA MARIA', '15-11-2026 13:29:47', '10000001'),
      fila(22222222, 'DOS DE LA CRUZ, JOSE', '15-11-2026 04:31:00', 10000002),
    ])
    expect(m.empleados).toEqual([
      expect.objectContaining({ codigo: '11111111', identificacion: '10000001', total: 2 }),
      expect.objectContaining({ codigo: '22222222', identificacion: '10000002', total: 1 }),
    ])
    expect(m.marcas).toHaveLength(3)
  })
  it('el formato viejo sigue funcionando, sin código de empleado', () => {
    const m = interpretarMarcaje([CAB_NUEVA.slice(0, 4), fila(1, 'X, Y', '15-11-2026 21:05:07').slice(0, 4)])
    expect(m.empleados[0].identificacion).toBe('')
  })
})

describe('nombrePropio', () => {
  it('"APELLIDOS, NOMBRES" → "Nombres Apellidos"', () => {
    expect(nombrePropio('PRUEBA UNO, ANA MARIA')).toBe('Ana Maria Prueba Uno')
  })
  it('partículas en minúscula, salvo al inicio', () => {
    expect(nombrePropio('DOS DE LA CRUZ, JOSE')).toBe('Jose Dos de la Cruz')
  })
  it('sin coma se respeta el orden y conserva la Ñ', () => {
    expect(nombrePropio('  ana   NUÑEZ ')).toBe('Ana Nuñez')
  })
})

describe('tecnicoDesdeMarcaje', () => {
  const emp = { codigo: '11111111', nombre: 'PRUEBA UNO, ANA MARIA', identificacion: '10000001' }
  it('toma nombre, cédula y código de empleado', () => {
    expect(tecnicoDesdeMarcaje(emp)).toEqual({ nombre: 'Ana Maria Prueba Uno', cedula: '11111111', codigo: '10000001' })
  })
  it('conserva las tildes que el técnico corrigió antes', () => {
    const actual = { nombre: 'Ana María Prueba Uno', cedula: 'V-11.111.111', codigo: 'x' }
    expect(tecnicoDesdeMarcaje(emp, actual)).toEqual({ nombre: 'Ana María Prueba Uno', cedula: '11111111', codigo: '10000001' })
  })
  it('otra persona reemplaza todo', () => {
    const actual = { nombre: 'Otro Nombre', cedula: '999', codigo: '5' }
    expect(tecnicoDesdeMarcaje(emp, actual)).toEqual({ nombre: 'Ana Maria Prueba Uno', cedula: '11111111', codigo: '10000001' })
  })
  it('formato viejo: conserva el código escrito por la misma persona', () => {
    const viejo = { ...emp, identificacion: '' }
    expect(tecnicoDesdeMarcaje(viejo, { nombre: 'Ana Maria Prueba Uno', cedula: '11111111', codigo: '777' }).codigo).toBe('777')
    expect(tecnicoDesdeMarcaje(viejo, { nombre: 'Otro', cedula: '2', codigo: '777' }).codigo).toBe('')
  })
  it('el nombre resultante sigue emparejando la columna del horario', () => {
    expect(sugerirTecnico(tecnicoDesdeMarcaje(emp).nombre, ['Ana Prueba', 'Pedro Otro'])).toBe('Ana Prueba')
  })
})
