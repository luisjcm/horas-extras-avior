import logo from '../assets/logo-avior-negro.png'
import { fmtHoras } from '../lib/motor.js'
import { formatoCedula, nombreCorto, textoHorario, textoLaborado } from '../lib/periodo.js'
import { isoADmy } from '../lib/tiempo.js'

const COLS = [
  ['bono', '12. Bono Nocturno'],
  ['diurnas', '13. H.E. Diurnas'],
  ['mixtas', '14. H.E. Mixtas'],
  ['nocturnas', '15. H.E. Nocturnas'],
  ['domingo', '16. Domingo'],
  ['descanso', '17. Descanso laborado'],
  ['feriado', '18. Feriado'],
]

const n = (v) => (v ? fmtHoras(v) : '')

function Total({ etiqueta, valor, destacado, unidad = 'h' }) {
  return (
    <div className={`rounded-lg border border-avior-line px-3 py-2 ${destacado ? 'bg-avior-field' : 'bg-avior-well'}`}>
      <p className="text-[11px] text-avior-muted">{etiqueta}</p>
      <p className={`text-xl font-bold ${valor ? 'text-avior-ink' : 'text-avior-muted/50'}`}>{fmtHoras(valor)} {unidad === 'h' ? 'h' : valor === 1 ? 'día' : 'días'}</p>
    </div>
  )
}

export default function VistaResultado({ estado, dias, totales, archivo }) {
  const { tecnico, periodo, firmantes } = estado
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Total etiqueta="Bono nocturno" valor={totales.bono} destacado />
        <Total etiqueta="Extras diurnas" valor={totales.diurnas} destacado />
        <Total etiqueta="Extras mixtas" valor={totales.mixtas} />
        <Total etiqueta="Extras nocturnas" valor={totales.nocturnas} destacado />
        <Total etiqueta="Domingos" valor={totales.domingo} unidad="d" />
        <Total etiqueta="Descansos laborados" valor={totales.descanso} unidad="d" />
        <Total etiqueta="Feriados" valor={totales.feriado} unidad="d" />
      </div>

      <p className="break-all text-xs text-avior-muted">Archivo: {archivo}</p>

      {/* Vista previa en papel (el archivo descargado es el formato oficial en Excel) */}
      <div className="overflow-x-auto rounded-lg border border-avior-line bg-white p-3 text-black">
        <div className="min-w-[680px] text-[10px] leading-tight">
          <div className="mb-2 flex items-center gap-3 border border-black p-2">
            <img src={logo} alt="Avior Airlines" className="h-5 w-auto" />
            <p className="flex-1 text-center text-xs font-bold">Reporte de Tiempo de Personal</p>
            <p className="text-[9px]">FO-VCH-038/16</p>
          </div>
          <div className="mb-2 grid grid-cols-4 border border-black">
            <p className="border-r border-black p-1"><b>Desde:</b> {isoADmy(periodo.desde)}</p>
            <p className="border-r border-black p-1"><b>Hasta:</b> {isoADmy(periodo.hasta)}</p>
            <p className="border-r border-black p-1"><b>ID:</b> {tecnico.codigo}</p>
            <p className="p-1"><b>Cédula:</b> {formatoCedula(tecnico.cedula)}</p>
            <p className="col-span-4 border-t border-black p-1"><b>Nombres y Apellidos:</b> {tecnico.nombre}</p>
          </div>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {['9. Fecha', '10. Horario asignado', '11. Horario laborado', ...COLS.map((c) => c[1])].map((h) => (
                  <th key={h} className="border border-black bg-neutral-200 px-1 py-1 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dias.map((d) => (
                <tr key={d.fecha}>
                  <td className="border border-black px-1 py-1 text-center">{isoADmy(d.fecha)}</td>
                  <td className="border border-black px-1 py-1 text-center">{textoHorario(d.asignado)}</td>
                  <td className="border border-black px-1 py-1 text-center">{textoLaborado(d)}</td>
                  {COLS.map(([k]) => (
                    <td key={k} className="border border-black px-1 py-1 text-center">{n(d.resultado[k])}</td>
                  ))}
                </tr>
              ))}
              <tr className="font-bold">
                <td colSpan={3} className="border border-black px-1 py-1 text-right">Totales</td>
                {COLS.map(([k]) => (
                  <td key={k} className="border border-black px-1 py-1 text-center">{fmtHoras(totales[k])}</td>
                ))}
              </tr>
            </tbody>
          </table>
          <div className="mt-2 grid grid-cols-4 border border-black">
            {[
              ['21. Elaborado por', { nombre: nombreCorto(tecnico.nombre), cedula: tecnico.cedula }],
              ['22. Revisado por', firmantes.revisor1],
              ['23. Revisado por', firmantes.revisor2],
              ['24. Aprobado por', firmantes.aprobador],
            ].map(([t, p], i) => (
              <div key={t} className={`p-1 ${i < 3 ? 'border-r border-black' : ''}`}>
                <p className="font-bold">{t}</p>
                <p>{p.nombre}</p>
                <p>{formatoCedula(p.cedula, ' - ')}</p>
                <p className="mt-3 border-t border-dashed border-neutral-400 pt-0.5 text-[8px] text-neutral-500">Firma</p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[9px] text-neutral-600">Firmas: se completan a mano sobre el documento impreso.</p>
        </div>
      </div>
    </div>
  )
}
