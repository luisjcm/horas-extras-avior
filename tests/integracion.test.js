// Prueba de punta a punta con archivos reales. Los archivos van en /datos
// (carpeta excluida de Git por contener datos personales); si no están, se omite.
import { existsSync, readFileSync } from 'node:fs'
import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { llenarFormato } from '../src/lib/formato.js'
import { interpretarHorario, sugerirTecnico } from '../src/lib/horario.js'
import { interpretarMarcaje, marcasPorDia, sugerirEmpleado } from '../src/lib/marcaje.js'
import { totalizar } from '../src/lib/motor.js'
import { armarQuincena, corteSugerido, diasQuincena } from '../src/lib/periodo.js'
import { leerPrimeraHoja } from '../src/lib/xlsxLectura.js'

// Uint8Array: el ArrayBuffer de Node no es reconocido por JSZip dentro de jsdom
const leer = (p) => new Uint8Array(readFileSync(p))
const hay = existsSync('datos/horario_octubre.xlsx') && existsSync('datos/marcaje.xlsx')

describe.skipIf(!hay)('octubre 2026 con archivos reales', () => {
  it('lee horario, marcaje y llena el formato', async () => {
    const h = interpretarHorario((await leerPrimeraHoja(leer('datos/horario_octubre.xlsx'))).filas)
    expect(h.tecnicos).toEqual(['Luis Curbata', 'Juan Natera', 'Nelson Guanipa'])
    const tecnico = { nombre: 'Luis Jesús Curbata Marcano', cedula: '25426448', codigo: '' }
    const firmantes = {
      revisor1: { nombre: 'Revisor Uno', cedula: '11111111' },
      revisor2: { nombre: 'Revisor Dos', cedula: '22222222' },
      aprobador: { nombre: 'Aprobador Tres', cedula: '33333333' },
    }
    const col = sugerirTecnico(tecnico.nombre, h.tecnicos)
    expect(col).toBe('Luis Curbata')
    expect(h.porTecnico[col]['2026-10-31']).toBeNull()

    const mj = interpretarMarcaje((await leerPrimeraHoja(leer('datos/marcaje.xlsx'))).filas)
    const cod = sugerirEmpleado(mj.empleados, tecnico.cedula, tecnico.nombre)
    expect(cod).toBe('25426448')
    const marcas = marcasPorDia(mj, cod)
    expect(marcas['2026-10-21']).toEqual(['04:04', '04:06', '06:51', '07:10', '13:08'])

    const dias = armarQuincena(diasQuincena(2026, 10, 2), h.porTecnico[col], marcas)
    const totales = totalizar(dias.map((d) => d.resultado))
    expect(totales).toMatchObject({ bono: 14, diurnas: 2, nocturnas: 1 })

    const blob = await llenarFormato(leer('src/assets/plantilla_horas_extras.xlsx'), {
      tecnico, firmantes, corte: corteSugerido(2026, 10, 2), dias, totales,
    }, 'uint8array')
    const zip = await JSZip.loadAsync(blob)
    expect(zip.file('xl/media/image1.png')).toBeTruthy()
    expect(zip.file('xl/comments1.xml')).toBeTruthy()
    const { writeFileSync } = await import('node:fs')
    writeFileSync('datos/salida_prueba.xlsx', blob)
  })
})
