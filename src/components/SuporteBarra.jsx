import { useEffect, useRef, useState } from 'react';
import { Headset, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const PING_MIN_MS = 2000;   // no máximo um aviso ao servidor a cada 2 s de atividade
const FOLGA_MS = 2000;      // a contagem da tela termina um pouco antes da do servidor, nunca depois
const EVENTOS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll'];

const formatar = ms => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

// Barra fixa no topo durante um acesso de suporte: mostra de quem é a conta, o motivo e quanto tempo falta.
// Qualquer movimento do administrador no sistema renova o prazo; sem atividade, o acesso se encerra sozinho.
export default function SuporteBarra() {
  const { user, sair, suporteExpirou } = useAuth();
  const s = user.suporte;
  const total = s.ocioso_ms;
  const deslocamento = Date.now() - Date.parse(s.agora); // diferença entre o relógio daqui e o do servidor
  const [fim, setFim] = useState(() => Date.parse(s.expira_em) + deslocamento - FOLGA_MS);
  const [agora, setAgora] = useState(Date.now());
  const ultimoPing = useRef(0);
  const fimRef = useRef(fim);
  const expirou = useRef(false);
  fimRef.current = fim;

  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const marcar = () => {
      const t = Date.now();
      if (expirou.current || fimRef.current <= t) return;
      setFim(t + total - FOLGA_MS);
      if (t - ultimoPing.current < PING_MIN_MS) return;
      ultimoPing.current = t;
      fetch('/api/suporte/renovar', { method: 'POST', credentials: 'same-origin' })
        .then(r => r.json())
        .then(d => { if (d.ativo) setFim(Date.parse(d.expira_em) + (Date.now() - Date.parse(d.agora)) - FOLGA_MS); })
        .catch(() => {});
    };
    EVENTOS.forEach(e => window.addEventListener(e, marcar, { passive: true, capture: true }));
    return () => EVENTOS.forEach(e => window.removeEventListener(e, marcar, { capture: true }));
  }, [total]);

  const restante = Math.max(0, fim - agora);
  useEffect(() => {
    if (restante > 0 || expirou.current) return undefined;
    expirou.current = true;
    // Dá tempo de o servidor fechar o chamado antes de perguntar quem está logado.
    const id = setTimeout(suporteExpirou, FOLGA_MS + 500);
    return () => clearTimeout(id);
  }, [restante, suporteExpirou]);

  const pct = Math.min(100, (restante / total) * 100);
  const critico = restante <= 15000;

  return (
    <div className={`suporte-barra${critico ? ' critico' : ''}`} role="status" aria-live="off">
      <span className="suporte-barra-icone" aria-hidden="true"><Headset size={18} strokeWidth={2.2} /></span>
      <div className="suporte-barra-texto">
        <strong>Acesso de suporte · {s.cliente.nome}</strong>
        <small>{s.cliente.email} · chamado nº {s.chamado_id} · {s.motivo}</small>
      </div>
      <div className="suporte-contador" aria-label={`O acesso expira em ${formatar(restante)} sem atividade`}>
        <span className="suporte-tempo">{formatar(restante)}</span>
        <span className="suporte-trilho" aria-hidden="true"><span style={{ width: `${pct}%` }} /></span>
        <small>sem atividade encerra</small>
      </div>
      <button className="btn btn-sm suporte-encerrar" onClick={sair}>
        <LogOut size={14} strokeWidth={2.4} /> Encerrar acesso
      </button>
    </div>
  );
}
