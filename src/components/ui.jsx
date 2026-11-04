import { forwardRef, useRef } from 'react'
import { Upload } from 'lucide-react'

export function Seccion({ icono: Icono, titulo, estado, children, id }) {
  return (
    <section id={id} className="overflow-hidden rounded-xl border border-avior-line bg-metal shadow-lg shadow-black/40">
      <header className="flex items-center gap-2 border-b border-avior-line bg-brushed px-4 py-2.5">
        {Icono && <Icono className="h-4 w-4 shrink-0 text-avior-light" aria-hidden />}
        <h2 className="flex-1 text-sm font-semibold tracking-wide text-avior-light">{titulo}</h2>
        {estado}
      </header>
      <div className="space-y-3 p-4">{children}</div>
    </section>
  )
}

export const Campo = forwardRef(function Campo(
  { etiqueta, obligatorio, error, ayuda, className = '', as = 'input', children, ...props },
  ref,
) {
  const Tag = as
  return (
    <label className={`block min-w-0 ${error ? 'animate-shake' : ''}`}>
      <span className="mb-1 block text-xs font-medium text-avior-muted">
        {etiqueta}
        {obligatorio && <span className="ml-0.5 text-avior-light">*</span>}
      </span>
      <Tag
        ref={ref}
        className={`w-full min-w-0 rounded-lg border bg-avior-well px-3 py-3 text-sm text-avior-ink placeholder:text-avior-muted/60 focus:outline-none focus:ring-2 focus:ring-avior-bright disabled:opacity-60 sm:text-base ${
          error ? 'border-red-500' : 'border-avior-line'
        } ${className}`}
        aria-invalid={Boolean(error)}
        {...props}
      >
        {children}
      </Tag>
      {error ? (
        <span className="mt-1 block text-xs font-medium text-red-400">{error}</span>
      ) : (
        ayuda && <span className="mt-1 block text-xs text-avior-muted">{ayuda}</span>
      )}
    </label>
  )
})

export function BotonArchivo({ etiqueta, archivo, onArchivo, error, disabled, id }) {
  const input = useRef(null)
  return (
    <div id={id} className={error ? 'animate-shake' : ''}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => input.current?.click()}
        className={`flex min-h-[56px] w-full items-center gap-3 rounded-lg border border-dashed bg-avior-well px-4 py-3 text-left transition active:scale-[0.98] disabled:opacity-60 ${
          error ? 'border-red-500' : 'border-avior-line hover:brightness-110'
        }`}
      >
        <Upload className="h-5 w-5 shrink-0 text-avior-light" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-avior-ink">{archivo || etiqueta}</span>
          <span className="block text-xs text-avior-muted">{archivo ? 'Toca para cambiar el archivo' : 'Archivo .xlsx'}</span>
        </span>
      </button>
      <input
        ref={input}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) onArchivo(f)
        }}
      />
      {error && <span className="mt-1 block text-xs font-medium text-red-400">{error}</span>}
    </div>
  )
}

const VARIANTES = {
  primario: 'bg-avior-bright text-white',
  secundario: 'bg-avior-nav text-avior-ink border border-avior-line',
}

export function Boton({ variante = 'primario', icono: Icono, children, className = '', ...props }) {
  return (
    <button
      type="button"
      className={`flex min-h-[52px] items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold shadow-md shadow-black/30 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50 sm:text-base ${VARIANTES[variante]} ${className}`}
      {...props}
    >
      {Icono && <Icono className="h-5 w-5" aria-hidden />}
      {children}
    </button>
  )
}

export function Insignia({ tono = 'neutro', children }) {
  const t = {
    neutro: 'bg-avior-nav text-avior-muted',
    ok: 'bg-emerald-900/60 text-emerald-300',
    aviso: 'bg-amber-900/50 text-amber-300',
    error: 'bg-red-900/60 text-red-300',
  }[tono]
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${t}`}>{children}</span>
}
