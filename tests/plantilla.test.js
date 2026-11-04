// La plantilla del repositorio no debe contener datos de personas:
// técnico y firmantes se escriben en la app. Cargo, gerencia y sitio quedan fijos.
import { readFileSync } from 'node:fs'
import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { llenarFormato } from '../src/lib/formato.js'

const plantilla = () => new Uint8Array(readFileSync('src/assets/plantilla_horas_extras.xlsx'))
const celda = (xml, ref) => new RegExp(`<c r="${ref}"[^>]*?(/>|>([\\s\\S]*?)</c>)`).exec(xml)

describe('plantilla oficial', () => {
  it('no trae nombres ni cédulas precargados', async () => {
    const zip = await JSZip.loadAsync(plantilla())
    const hoja = await zip.file('xl/worksheets/sheet1.xml').async('string')
    for (const ref of ['A9', 'B9', 'E9', 'B35', 'B36', 'E35', 'E36', 'H35', 'H36', 'K35', 'K36']) {
      expect(celda(hoja, ref)[1], ref).toBe('/>')
    }
    const textos = (await zip.file('xl/sharedStrings.xml').async('string')).match(/<t[^>]*>[^<]*<\/t>/g).join(' ')
    expect(textos).not.toMatch(/V ?- ?\d/)
    for (const ref of ['G9', 'I9', 'K9']) expect(celda(hoja, ref)[1], ref).not.toBe('/>')
  })

  it('escribe técnico y firmantes con el formato de cédula del original', async () => {
    const salida = await llenarFormato(
      plantilla(),
      {
        tecnico: { nombre: 'Ana María Pérez Gómez', cedula: '12345678', codigo: '100' },
        firmantes: {
          revisor1: { nombre: 'Revisor Uno', cedula: 'V-11.111.111' },
          revisor2: { nombre: 'Revisor Dos', cedula: '2222222' },
          aprobador: { nombre: 'Aprobador Tres', cedula: '33333333' },
        },
        corte: { desde: '2026-10-15', hasta: '2026-10-31' },
        dias: [],
        totales: {},
      },
      'uint8array',
    )
    const hoja = await (await JSZip.loadAsync(salida)).file('xl/worksheets/sheet1.xml').async('string')
    const v = (ref) => /<t[^>]*>([^<]*)<\/t>/.exec(celda(hoja, ref)[2] || '')?.[1]
    expect(v('B35')).toBe('Ana Pérez')
    expect(v('E35')).toBe('Revisor Uno')
    expect(v('E36')).toBe('V - 11.111.111')
    expect(v('H36')).toBe('V - 2.222.222')
    expect(v('K35')).toBe('Aprobador Tres')
    expect(v('K36')).toBe('V - 33.333.333')
  })
})
