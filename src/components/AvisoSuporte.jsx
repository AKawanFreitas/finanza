import { useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { api } from '../utils/api';

const INTERVALO_MS = 8000;

// Faixa para o CLIENTE: enquanto um administrador está na conta dele por um chamado de suporte, ele vê quem é e por quê.
export default function AvisoSuporte() {
  const [aviso, setAviso] = useState(null);

  useEffect(() => {
    let vivo = true;
    const buscar = () => api('/suporte/aviso').then(({ ok, data }) => { if (vivo && ok) setAviso(data.aviso); }).catch(() => {});
    buscar();
    const id = setInterval(buscar, INTERVALO_MS);
    const aoVoltar = () => { if (!document.hidden) buscar(); };
    document.addEventListener('visibilitychange', aoVoltar);
    return () => { vivo = false; clearInterval(id); document.removeEventListener('visibilitychange', aoVoltar); };
  }, []);

  if (!aviso) return null;
  const hora = new Date(aviso.aberto_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return (
    <div className="aviso-suporte" role="status">
      <span className="aviso-suporte-ponto" aria-hidden="true" />
      <ShieldAlert size={20} strokeWidth={2.2} aria-hidden="true" />
      <span>
        <strong>O suporte está acessando a sua conta agora.</strong>{' '}
        {aviso.admin_nome} abriu um chamado às {hora}. Motivo: {aviso.motivo}
      </span>
    </div>
  );
}
