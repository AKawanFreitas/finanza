import { useEffect, useId, useRef, useState } from 'react';
import { Palette, Plus, Check } from 'lucide-react';

// Grade de cores do painel: cada coluna é um matiz, cada linha um tom (do claro ao escuro), mais uma linha de cinzas.
const MATIZES = [0, 24, 45, 90, 150, 175, 200, 220, 265, 330];
const TONS = [76, 62, 50, 38, 28];
const CINZAS = ['#ffffff', '#f3f4f6', '#d1d5db', '#9ca3af', '#6b7280', '#4b5563', '#374151', '#1f2937', '#111827', '#000000'];

function hslParaHex(h, s, l) {
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const f = n => {
    const k = (n + h / 30) % 12;
    const c = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * c).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}
const GRADE = [...TONS.map(l => MATIZES.map(h => hslParaHex(h, 72, l))), CINZAS];
const HEX = /^#[0-9a-f]{6}$/i;

// Escolha de cor: cores prontas em bolinhas e um painel próprio para uma cor qualquer (grade ou código #RRGGBB).
// Cabe numa coluna do formulário; com `larga` ocupa a linha inteira (útil quando ficaria sozinho na última linha).
export default function CampoCor({ valor, onChange, cores, larga = false }) {
  const id = useId();
  const raiz = useRef(null);
  const botao = useRef(null);
  const [aberto, setAberto] = useState(false);
  const [codigo, setCodigo] = useState(valor);
  const personalizada = !cores.includes(valor.toLowerCase());

  useEffect(() => {
    if (!aberto) return undefined;
    const fora = e => { if (raiz.current && !raiz.current.contains(e.target)) setAberto(false); };
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, [aberto]);

  function aplicar(cor) { setCodigo(cor); onChange(cor.toLowerCase()); }
  function digitar(texto) {
    const t = texto.startsWith('#') ? texto : `#${texto}`;
    setCodigo(t.slice(0, 7));
    if (HEX.test(t)) onChange(t.toLowerCase());
  }
  function fechar() { setAberto(false); botao.current?.focus(); }

  return (
    <div className={`form-group${larga ? ' form-span-2' : ''}`} role="group" aria-labelledby={`${id}-rotulo`}>
      <span className="form-label" id={`${id}-rotulo`}><Palette size={16} />Cor</span>
      {/* O Esc fecha o painel; o resto do teclado é dos botões dentro dele. */}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div className="cor-linha" ref={raiz} onKeyDown={e => { if (aberto && e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fechar(); } }}>
        {cores.map(c => (
          <button
            key={c} type="button" title={c} aria-label={`Cor ${c}`} aria-pressed={valor.toLowerCase() === c}
            className={`color-preset-dot ${valor.toLowerCase() === c ? 'selected' : ''}`}
            style={{ background: c, '--cor-sel': c }} onClick={() => onChange(c)}
          />
        ))}
        <button
          type="button" ref={botao} title="Escolher outra cor" aria-label="Escolher outra cor"
          aria-haspopup="dialog" aria-expanded={aberto}
          className={`cor-personalizada${personalizada ? ' selected' : ''}`}
          style={personalizada ? { background: valor, '--cor-sel': valor } : undefined}
          onClick={() => { setCodigo(valor); setAberto(a => !a); }}
        >
          <Plus size={15} strokeWidth={3} aria-hidden="true" />
        </button>
        <span className="cor-codigo">{valor.toUpperCase()}</span>

        {aberto && (
          <div className="cor-painel" role="dialog" aria-label="Escolher outra cor">
            <div className="cor-grade">
              {GRADE.flat().map(c => (
                <button
                  key={c} type="button" title={c} aria-label={`Cor ${c}`}
                  className={`cor-amostra${valor.toLowerCase() === c ? ' selected' : ''}`}
                  style={{ background: c }} onClick={() => aplicar(c)}
                />
              ))}
            </div>
            <div className="cor-painel-base">
              <span className="cor-previa" style={{ background: HEX.test(codigo) ? codigo : valor }} aria-hidden="true" />
              <input
                className="form-control cor-hex" value={codigo} maxLength={7} spellCheck={false}
                aria-label="Código da cor (#RRGGBB)" aria-invalid={!HEX.test(codigo)}
                onChange={e => digitar(e.target.value.trim())}
              />
              <button type="button" className="btn btn-primary btn-sm" onClick={fechar}><Check size={14} strokeWidth={2.5} /> Pronto</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
