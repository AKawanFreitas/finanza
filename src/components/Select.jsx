import { useState, useRef, useEffect, useId } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import CategoriaIcone from './CategoriaIcone';

// Lista suspensa acessível (padrão "select-only combobox" do WAI-ARIA).
// Teclado: setas, Home/End, Enter/Espaço escolhem, Esc fecha, digitar salta para a opção.
// Uma opção pode trazer `color` (bolinha) ou `icone` + `color` (ícone da categoria no lugar da bolinha e do prefixo).
// Passe `id` (vem do <Field>) para ligar o rótulo, ou `aria-label` quando não há rótulo visível.
export default function Select({ value, onChange, options, prefix, id, 'aria-label': ariaLabel, 'aria-labelledby': labelledBy }) {
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [ativo, setAtivo] = useState(0);
  const ref = useRef(null);
  const triggerRef = useRef(null);
  const busca = useRef({ texto: '', timer: null });

  const indiceSelecionado = Math.max(0, options.findIndex(o => o.value === value));
  const selected = options[indiceSelecionado];

  useEffect(() => {
    if (!open) return;
    const fora = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, [open]);

  // Mantém a opção ativa visível na lista rolável.
  useEffect(() => {
    if (open) document.getElementById(`${uid}-${ativo}`)?.scrollIntoView({ block: 'nearest' });
  }, [open, ativo, uid]);

  const abrir = () => { setAtivo(indiceSelecionado); setOpen(true); };
  const fechar = () => { setOpen(false); triggerRef.current?.focus(); };
  const escolher = i => { onChange(options[i].value); fechar(); };

  function onKeyDown(e) {
    const ultimo = options.length - 1;
    const vai = i => { e.preventDefault(); if (!open) abrir(); setAtivo(i); };
    switch (e.key) {
      case 'ArrowDown': return open ? vai(Math.min(ativo + 1, ultimo)) : (e.preventDefault(), abrir());
      case 'ArrowUp':   return open ? vai(Math.max(ativo - 1, 0))      : (e.preventDefault(), abrir());
      case 'Home':      return vai(0);
      case 'End':       return vai(ultimo);
      case 'Enter':
      case ' ':
        e.preventDefault();
        return open ? escolher(ativo) : abrir();
      case 'Escape':
        if (open) { e.preventDefault(); e.stopPropagation(); fechar(); }
        return;
      case 'Tab':
        if (open) setOpen(false);
        return;
      default: {
        if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;
        clearTimeout(busca.current.timer);
        busca.current.texto += e.key.toLowerCase();
        busca.current.timer = setTimeout(() => { busca.current.texto = ''; }, 600);
        const i = options.findIndex(o => String(o.label).toLowerCase().startsWith(busca.current.texto));
        if (i >= 0) { if (!open) setOpen(true); setAtivo(i); }
      }
    }
  }

  return (
    <div className="cselect" ref={ref}>
      <button
        type="button"
        id={id}
        ref={triggerRef}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${uid}-lista`}
        aria-activedescendant={open ? `${uid}-${ativo}` : undefined}
        aria-label={ariaLabel}
        aria-labelledby={labelledBy}
        className={`cselect-trigger${open ? ' open' : ''}`}
        onClick={() => (open ? setOpen(false) : abrir())}
        onKeyDown={onKeyDown}
      >
        {selected?.icone
          ? <CategoriaIcone icone={selected.icone} cor={selected.color} tam={26} />
          : <>
            {prefix && <span className="cselect-prefix" aria-hidden="true">{prefix}</span>}
            {selected?.color && <span className="cselect-dot" aria-hidden="true" style={{ background: selected.color }} />}
          </>}
        <span className="cselect-value">{selected?.label ?? value}</span>
        <ChevronDown size={13} strokeWidth={2} className="cselect-chevron" aria-hidden="true" />
      </button>

      {open && (
        <div className="cselect-menu" role="listbox" id={`${uid}-lista`} aria-label={ariaLabel}>
          {options.map((opt, i) => {
            const marcada = opt.value === value;
            return (
              // Navegação por teclado fica no combobox (aria-activedescendant); o clique é só para o mouse.
              // eslint-disable-next-line jsx-a11y/click-events-have-key-events
              <div
                key={opt.value}
                id={`${uid}-${i}`}
                role="option"
                tabIndex={-1}
                aria-selected={marcada}
                className={`cselect-option${marcada ? ' selected' : ''}${i === ativo ? ' ativo' : ''}`}
                onMouseMove={() => setAtivo(i)}
                onMouseDown={e => e.preventDefault()}
                onClick={() => escolher(i)}
              >
                {opt.icone
                  ? <CategoriaIcone icone={opt.icone} cor={opt.color} tam={26} />
                  : opt.color && <span className="cselect-dot" aria-hidden="true" style={{ background: opt.color }} />}
                <span style={{ flex: 1 }}>{opt.label}</span>
                {marcada && <Check size={12} strokeWidth={2.5} className="cselect-check" aria-hidden="true" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
