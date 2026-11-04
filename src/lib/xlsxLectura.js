// Lector mínimo de .xlsx en el navegador: devuelve la primera hoja como matriz.
// Todo se procesa localmente; el archivo no sale del dispositivo.
import JSZip from 'jszip'

const parser = () => new DOMParser()

function xml(texto) {
  return parser().parseFromString(texto, 'application/xml')
}

function textoDe(nodo) {
  // Une todos los <t> (incluye texto enriquecido <r><t>)
  const ts = nodo.getElementsByTagName('t')
  let s = ''
  for (const t of ts) s += t.textContent
  return s
}

function columnaIndice(ref) {
  const letras = /^[A-Z]+/.exec(ref)[0]
  let n = 0
  for (const ch of letras) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}

function resolverRuta(base, destino) {
  if (destino.startsWith('/')) return destino.slice(1)
  const partes = base.split('/').slice(0, -1)
  for (const p of destino.split('/')) {
    if (p === '..') partes.pop()
    else if (p !== '.') partes.push(p)
  }
  return partes.join('/')
}

export class ErrorArchivo extends Error {}

/** @returns {Promise<{ hoja: string, filas: any[][] }>} */
export async function leerPrimeraHoja(arrayBuffer) {
  let zip
  try {
    zip = await JSZip.loadAsync(arrayBuffer)
  } catch {
    throw new ErrorArchivo('El archivo no es un .xlsx válido. Si es .xls antiguo, ábrelo en Excel y guárdalo como .xlsx.')
  }
  const wbTxt = await zip.file('xl/workbook.xml')?.async('string')
  if (!wbTxt) throw new ErrorArchivo('El archivo no contiene un libro de Excel.')
  const wb = xml(wbTxt)
  const sheet = wb.getElementsByTagName('sheet')[0]
  const nombreHoja = sheet.getAttribute('name')
  const rid = sheet.getAttribute('r:id') || sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id')

  const rels = xml(await zip.file('xl/_rels/workbook.xml.rels').async('string'))
  let ruta = 'xl/worksheets/sheet1.xml'
  for (const rel of rels.getElementsByTagName('Relationship')) {
    if (rel.getAttribute('Id') === rid) ruta = resolverRuta('xl/workbook.xml', rel.getAttribute('Target'))
  }

  const compartidas = []
  const ssTxt = await zip.file('xl/sharedStrings.xml')?.async('string')
  if (ssTxt) for (const si of xml(ssTxt).getElementsByTagName('si')) compartidas.push(textoDe(si))

  const hojaTxt = await zip.file(ruta)?.async('string')
  if (!hojaTxt) throw new ErrorArchivo('No se encontró la primera hoja del archivo.')
  const filas = []
  for (const row of xml(hojaTxt).getElementsByTagName('row')) {
    const r = Number(row.getAttribute('r')) - 1
    const fila = []
    for (const c of row.getElementsByTagName('c')) {
      const ref = c.getAttribute('r')
      const tipo = c.getAttribute('t')
      const v = c.getElementsByTagName('v')[0]?.textContent
      let valor = null
      if (tipo === 's') valor = compartidas[Number(v)] ?? ''
      else if (tipo === 'inlineStr') valor = textoDe(c)
      else if (tipo === 'str' || tipo === 'e') valor = v ?? null
      else if (tipo === 'b') valor = v === '1'
      else if (v != null && v !== '') valor = Number(v)
      if (valor !== null && valor !== '') fila[columnaIndice(ref)] = valor
    }
    filas[r] = fila
  }
  for (let i = 0; i < filas.length; i++) if (!filas[i]) filas[i] = []
  return { hoja: nombreHoja, filas }
}
