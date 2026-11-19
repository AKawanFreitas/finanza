import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export default function Select({ value, onChange, options, prefix, dark = false }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function close(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const selected = options.find(o => o.value === value) ?? options[0];

  return (
    <div className={`cselect${dark ? ' cselect-dark' : ''}`} ref={ref}>
      <button
        type="button"
        className={`cselect-trigger${open ? ' open' : ''}`}
        onClick={() => setOpen(o => !o)}
      >
        {prefix && <span className="cselect-prefix">{prefix}</span>}
        {selected?.color && (
          <span className="cselect-dot" style={{ background: selected.color }} />
        )}
        <span className="cselect-value">{selected?.label ?? value}</span>
        <ChevronDown size={13} strokeWidth={2} className="cselect-chevron" />
      </button>

      {open && (
        <div className="cselect-menu">
          {options.map(opt => {
            const active = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                className={`cselect-option${active ? ' selected' : ''}`}
                onClick={() => { onChange(opt.value); setOpen(false); }}
              >
                {opt.color && (
                  <span className="cselect-dot" style={{ background: opt.color }} />
                )}
                <span style={{ flex: 1 }}>{opt.label}</span>
                {active && <Check size={12} strokeWidth={2.5} className="cselect-check" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
