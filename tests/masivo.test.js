// Modo masivo: varios marcajes, horario compartido, un formato por técnico.
import JSZip from 'jszip'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { migrateState } from '../src/lib/estado.js'
import { llenarFormato } from '../src/lib/formato.js'
import { marcasPorDia } from '../src/lib/marcaje.js'
import { columnasRepetidas, combinarMarcajes, nombresUnicos, nombreZip, sincronizarTecnicos } from '../src/lib/masivo.js'
import { totalizar } from '../src/lib/motor.js'
import { armarQuincena } from '../src/lib/periodo.js'

const emp = (codigo, nombre, identificacion = '') => ({ codigo, nombre, puesto: 'HD', identificacion, total: 0 })
const marca = (codigo, fecha, hora) => ({ codigo, fecha, hora })

const A = {
  archivo: 'ana.xlsx',
  empleados: [emp('111', 'UNO PRUEBA, ANA', '1001')],
  marcas: [marca('111', '2026-11-01', '04:25'), marca('111', '2026-11-01', '12:35')],
  ilegibles: 1,
}
const B = {
  archivo: 'beto.xlsx',
  empleados: [emp('222', 'DOS PRUEBA, BETO', '1002')],
  marcas: [marca('222', '2026-11-01', '12:58'), marca('222', '2026-11-01', '21:04')],
  ilegibles: 0,
}
// Archivo de todo el equipo que repite las marcas de Ana y trae a Carla
const TODOS = {
  archivo: 'todos.xlsx',
  empleados: [emp('111', 'UNO PRUEBA, ANA'), emp('333', 'TRES PRUEBA, CARLA', '1003')],
  marcas: [marca('111', '2026-11-01', '04:25'), marca('333', '2026-11-01', '04:31'), marca('333', '2026-11-01', '12:30')],
  ilegibles: 0,
}
const HORARIO = {
  tecnicos: ['Ana Uno', 'Beto Dos', 'Carla Tres'],
  porTecnico: {
    'Ana Uno': { '2026-11-01': { inicio: '04:30', fin: '12:30' } },
    'Beto Dos': { '2026-11-01': { inicio: '13:00', fin: '21:00' } },
    'Carla Tres': { '2026-11-01': { inicio: '04:30', fin: '12:30' } },
  },
}

describe('combinarMarcajes', () => {
  it('une empleados y marcas de varios archivos, sin duplicar marcas', () => {
    const c = combinarMarcajes([A, B, TODOS])
    expect(c.empleados.map((e) => e.codigo)).toEqual(['222', '333', '111']) // por nombre: Dos, Tres, Uno
    expect(c.marcas).toHaveLength(6)
    expect(c.empleados.find((e) => e.codigo === '111')).toMatchObject({ total: 2, identificacion: '1001' })
    expect(c.ilegibles).toBe(1)
    expect(c.archivo).toBe('ana.xlsx, beto.xlsx, todos.xlsx')
  })
  it('toma el Núm. Identificación del archivo que lo traiga', () => {
    const c = combinarMarcajes([TODOS, A])
    expect(c.empleados.find((e) => e.codigo === '111').identificacion).toBe('1001')
  })
  it('lista vacía', () => {
    expect(combinarMarcajes([])).toEqual({ archivo: '', empleados: [], marcas: [], ilegibles: 0 })
  })
})

describe('sincronizarTecnicos', () => {
  const c = combinarMarcajes([A, B, TODOS])
  it('crea una ficha por técnico con datos del marcaje y su columna del horario', () => {
    const f = sincronizarTecnicos(c, {}, HORARIO)
    expect(f['111']).toEqual({ incluir: true, nombre: 'Ana Uno Prueba', codigo: '1001', columna: 'Ana Uno', ajustes: {}, observaciones: '' })
    expect(f['222'].columna).toBe('Beto Dos')
    expect(f['333'].columna).toBe('Carla Tres')
  })
  it('sin horario la columna queda vacía', () => {
    expect(sincronizarTecnicos(c, {}, null)['111'].columna).toBe('')
  })
  it('conserva tildes, columna, ajustes, observaciones y exclusión ya hechos', () => {
    const previos = {
      '111': { incluir: false, nombre: 'Ána Uno Prueba', codigo: 'x', columna: 'Carla Tres', ajustes: { '2026-11-01': { feriado: true } }, observaciones: 'hola' },
    }
    expect(sincronizarTecnicos(c, previos, HORARIO)['111']).toEqual({
      incluir: false, nombre: 'Ána Uno Prueba', codigo: '1001', columna: 'Carla Tres', ajustes: { '2026-11-01': { feriado: true } }, observaciones: 'hola',
    })
  })
  it('una columna guardada que ya no existe en el horario se vuelve a sugerir', () => {
    const f = sincronizarTecnicos(c, { '111': { columna: 'Vieja' } }, HORARIO)
    expect(f['111'].columna).toBe('Ana Uno')
  })
  it('recuerda a técnicos que no están en los archivos actuales', () => {
    const f = sincronizarTecnicos(combinarMarcajes([A]), { '999': { nombre: 'Otro' } }, HORARIO)
    expect(f['999']).toEqual({ nombre: 'Otro' })
  })
  it('hereda las tildes corregidas en el modo individual para la misma cédula', () => {
    const f = sincronizarTecnicos(c, {}, HORARIO, { nombre: 'Ana Uno Prüeba', cedula: '111', codigo: '' })
    expect(f['111'].nombre).toBe('Ana Uno Prüeba')
  })
})

describe('utilidades', () => {
  it('detecta columnas repetidas entre técnicos incluidos', () => {
    const f = { a: { incluir: true, columna: 'X' }, b: { incluir: true, columna: 'X' }, c: { incluir: false, columna: 'X' } }
    expect(columnasRepetidas(f, ['a', 'b', 'c'])).toEqual({ X: ['a', 'b'] })
  })
  it('nombre del zip y nombres únicos', () => {
    expect(nombreZip(2026, 11, 1)).toBe('Horas_extras_al_15_de_Noviembre_Help_Desk.zip')
    expect(nombresUnicos(['a.xlsx', 'b.xlsx', 'a.xlsx'])).toEqual(['a.xlsx', 'b.xlsx', 'a_2.xlsx'])
  })
})

describe('un formato por técnico', () => {
  it('cada técnico sale con sus datos, su horario y sus marcas', async () => {
    const c = combinarMarcajes([A, B, TODOS])
    const fichas = sincronizarTecnicos(c, {}, HORARIO)
    const plantilla = readFileSync('src/assets/plantilla_horas_extras.xlsx')
    const hojas = {}
    for (const ced of ['111', '222']) {
      const f = fichas[ced]
      const dias = armarQuincena(['2026-11-01'], HORARIO.porTecnico[f.columna], marcasPorDia(c, ced), {}, { feriados: [] })
      const out = await llenarFormato(
        new Uint8Array(plantilla),
        { tecnico: { nombre: f.nombre, cedula: ced, codigo: f.codigo }, corte: { desde: '2026-11-01', hasta: '2026-11-15' }, dias, totales: totalizar(dias.map((d) => d.resultado)) },
        'uint8array',
      )
      hojas[ced] = await (await JSZip.loadAsync(out)).file('xl/worksheets/sheet1.xml').async('string')
    }
    expect(hojas['111']).toContain('Ana Uno Prueba')
    expect(hojas['111']).toContain('04:30 a 12:30')
    expect(hojas['222']).toContain('Beto Dos Prueba')
    expect(hojas['222']).toContain('13:00 a 21:00')
    expect(hojas['222']).not.toContain('Ana Uno Prueba')
  })
})

describe('migrateState: modo y masivo', () => {
  it('estado antiguo → modo individual y masivo vacío', () => {
    const s = migrateState({})
    expect(s.modo).toBe('individual')
    expect(s.masivo).toEqual({ marcajes: [], tecnicos: {}, generado: null })
  })
  it('conserva marcajes y fichas válidas y descarta lo dañado', () => {
    const s = migrateState({
      modo: 'masivo',
      masivo: {
        marcajes: [A, { basura: 1 }, null],
        tecnicos: {
          '111': { incluir: false, nombre: 'Ana', codigo: '1', columna: 'Ana Uno', ajustes: { '2026-11-01': { feriado: true, raro: 1 } }, observaciones: 'x' },
          '222': 'dañado',
        },
        generado: { en: 'hoy' },
      },
    })
    expect(s.modo).toBe('masivo')
    expect(s.masivo.marcajes).toEqual([A])
    expect(s.masivo.tecnicos).toEqual({
      '111': { incluir: false, nombre: 'Ana', codigo: '1', columna: 'Ana Uno', ajustes: { '2026-11-01': { feriado: true } }, observaciones: 'x' },
    })
    expect(s.masivo.generado).toEqual({ en: 'hoy' })
  })
  it('un modo desconocido vuelve a individual', () => {
    expect(migrateState({ modo: 'otro' }).modo).toBe('individual')
  })
})
