// Rellena la plantilla oficial FO-VCH-038/16 editando solo los valores de las celdas
// en el XML. Se conservan logo, comentarios, estilos, celdas combinadas, fórmulas
// y el área de firmas (las firmas se hacen a mano sobre el impreso).
import JSZip from 'jszip'
import { textoHorario, textoLaborado, formatoCedula, nombreCorto } from './periodo.js'
import { isoASerial } from './tiempo.js'

const HOJA = 'xl/worksheets/sheet1.xml'
const FILA_INICIAL = 14
const FILAS = 16 // filas 14 a 29
const COLS = { bono: 'D', diurnas: 'E', mixtas: 'F', nocturnas: 'G', domingo: 'H', descanso: 'I', feriado: 'J' }

const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function ponerCelda(xmlHoja, ref, valor) {
  const re = new RegExp(`<c r="${ref}"((?: [a-zA-Z:]+="[^"]*")*?)(\\/>|>[\\s\\S]*?<\\/c>)`)
  const m = re.exec(xmlHoja)
  if (!m) throw new Error(`La plantilla no tiene la celda ${ref}`)
  const estilo = /\ss="\d+"/.exec(m[1])?.[0] || ''
  let nueva
  if (valor == null || valor === '' || valor === 0) nueva = `<c r="${ref}"${estilo}/>`
  else if (typeof valor === 'number') nueva = `<c r="${ref}"${estilo}><v>${valor}</v></c>`
  else nueva = `<c r="${ref}"${estilo} t="inlineStr"><is><t xml:space="preserve">${esc(valor)}</t></is></c>`
  return xmlHoja.slice(0, m.index) + nueva + xmlHoja.slice(m.index + m[0].length)
}

function ponerTotal(xmlHoja, col, total) {
  const re = new RegExp(`(<c r="${col}30"[^>]*>(?:<f[^>]*\\/>|<f[^>]*>[^<]*<\\/f>))(?:<v>[^<]*<\\/v>)?`)
  return xmlHoja.replace(re, `$1<v>${total}</v>`)
}

/**
 * @param {ArrayBuffer} plantilla
 * @param {object} datos
 * @param {{nombre, cedula, codigo}} datos.tecnico
 * @param {{revisor1, revisor2, aprobador}} datos.firmantes cada uno {nombre, cedula}
 * @param {{desde:string, hasta:string}} datos.corte ISO
 * @param {Array} datos.dias resultado de armarQuincena
 * @param {object} datos.totales resultado de totalizar
 * @param {'blob'|'uint8array'} [tipo] salida (uint8array solo para pruebas)
 * @returns {Promise<Blob>}
 */
export async function llenarFormato(plantilla, { tecnico, firmantes = {}, corte, dias, totales }, tipo = 'blob') {
  if (dias.length > FILAS) throw new Error(`El formato admite ${FILAS} días y la quincena tiene ${dias.length}`)
  const zip = await JSZip.loadAsync(plantilla)
  let x = await zip.file(HOJA).async('string')

  x = ponerCelda(x, 'B5', corte.desde ? isoASerial(corte.desde) : null)
  x = ponerCelda(x, 'D5', corte.hasta ? isoASerial(corte.hasta) : null)
  const codigo = String(tecnico.codigo || '').trim()
  x = ponerCelda(x, 'A9', /^\d+$/.test(codigo) ? Number(codigo) : codigo)
  x = ponerCelda(x, 'B9', tecnico.nombre.trim())
  x = ponerCelda(x, 'E9', formatoCedula(tecnico.cedula, '-'))
  // 21. Elaborado por (el técnico) y 22–24. Revisado / Aprobado por
  x = ponerCelda(x, 'B35', nombreCorto(tecnico.nombre))
  x = ponerCelda(x, 'B36', formatoCedula(tecnico.cedula, ' - '))
  for (const [clave, col] of [['revisor1', 'E'], ['revisor2', 'H'], ['aprobador', 'K']]) {
    const p = firmantes[clave] || {}
    x = ponerCelda(x, `${col}35`, (p.nombre || '').trim())
    x = ponerCelda(x, `${col}36`, formatoCedula(p.cedula, ' - '))
  }

  for (let i = 0; i < FILAS; i++) {
    const fila = FILA_INICIAL + i
    const d = dias[i]
    x = ponerCelda(x, `A${fila}`, d ? isoASerial(d.fecha) : null)
    x = ponerCelda(x, `B${fila}`, d ? textoHorario(d.asignado) : null)
    x = ponerCelda(x, `C${fila}`, d ? textoLaborado(d) : null)
    for (const [k, col] of Object.entries(COLS)) x = ponerCelda(x, `${col}${fila}`, d ? d.resultado[k] : null)
    x = ponerCelda(x, `K${fila}`, null)
  }
  for (const [k, col] of Object.entries(COLS)) x = ponerTotal(x, col, totales[k] || 0)
  zip.file(HOJA, x)

  // Excel recalcula totales y =HOY() al abrir
  const wb = await zip.file('xl/workbook.xml').async('string')
  zip.file(
    'xl/workbook.xml',
    wb.replace(/<calcPr([^>]*?)\s*\/>/, (_, a) => `<calcPr${a.replace(/\s*fullCalcOnLoad="\d"/, '')} fullCalcOnLoad="1"/>`),
  )

  return zip.generateAsync({
    type: tipo,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    compression: 'DEFLATE',
  })
}
