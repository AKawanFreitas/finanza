import { useState, useRef, useEffect, useId } from 'react';
import { ChevronDown, Check } from 'lucide-react';

// Seletor com a mesma aparência em todo o app. Teclado: setas, Home/End, Enter/Espaço, Esc e digitar a inicial.
export default function Select({ value, onChange, options, prefix, label }) {
  const [open, setOpen] = useState(false);
  const [destaque, setDestaque] = useState(0);
  const ref = useRef(null);
  const botao = useRef(null);
  const listaId = useId();

  const indiceAtual = Math.max(0, options.findIndex(o => o.value === value));
  const selected = options[indiceAtual];

  useEffect(() => {
    if (!open) return;
    const fora = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, [open]);

  // Mantém a opção destacada visível ao navegar pelo teclado.
  useEffect(() => {
    if (open) ref.current?.querySelector(`[data-i="${destaque}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [open, destaque]);

  function abrir() { setDestaque(indiceAtual); setOpen(true); }
  function escolher(i) { onChange(options[i].value); setOpen(false); botao.current?.focus(); }

  function teclado(e) {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); abrir(); }
      return;
    }
    const n = options.length;
    if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setDestaque(d => (d + 1) % n); }
    else if (e.key === 'ArrowUp')   { e.preventDefault(); setDestaque(d => (d - 1 + n) % n); }
    else if (e.key === 'Home')      { e.preventDefault(); setDestaque(0); }
    else if (e.key === 'End')       { e.preventDefault(); setDestaque(n - 1); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); escolher(destaque); }
    else if (e.key === 'Tab') setOpen(false);
    else if (e.key.length === 1) {
      const letra = e.key.toLowerCase();
      const i = options.findIndex((o, k) => k > destaque && String(o.label).toLowerCase().startsWith(letra));
      const j = i >= 0 ? i : options.findIndex(o => String(o.label).toLowerCase().startsWith(letra));
      if (j >= 0) setDestaque(j);
    }
  }

  return (
    <div className="cselect" ref={ref} onKeyDown={teclado}>
      <button
        type="button"
        ref={botao}
        className={`cselect-trigger${open ? ' open' : ''}`}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listaId}
        aria-label={label}
        onClick={() => (open ? setOpen(false) : abrir())}
      >
        {prefix && <span className="cselect-prefix" aria-hidden="true">{prefix}</span>}
        {selected?.color && <span className="cselect-dot" style={{ background: selected.color }} aria-hidden="true" />}
        <span className="cselect-value">{selected?.label ?? value}</span>
        <ChevronDown size={14} strokeWidth={2} className="cselect-chevron" aria-hidden="true" />
      </button>

      {open && (
        <div className="cselect-menu" id={listaId} role="listbox">
          {options.map((opt, i) => {
            const active = opt.value === value;
            return (
              <div
                key={String(opt.value)}
                data-i={i}
                role="option"
                aria-selected={active}
                className={`cselect-option${active ? ' selected' : ''}${i === destaque ? ' destaque' : ''}`}
                onMouseEnter={() => setDestaque(i)}
                onClick={() => escolher(i)}
              >
                {opt.color && <span className="cselect-dot" style={{ background: opt.color }} aria-hidden="true" />}
                <span style={{ flex: 1 }}>{opt.label}</span>
                {active && <Check size={13} strokeWidth={2.5} className="cselect-check" aria-hidden="true" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
