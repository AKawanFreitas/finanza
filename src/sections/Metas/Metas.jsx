import { useEffect, useState } from 'react';
import { PiggyBank, Target, Info } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import { useFinance } from '../../context/FinanceContext';
import { api } from '../../utils/api';
import { fmt } from '../../utils/formatters';
import MetaForm from './MetaForm';
import MetaCard from './MetaCard';

export default function Metas() {
  const { versao } = useFinance();
  const [metas, setMetas] = useState(null);
  const [editando, setEditando] = useState(null);
  const [recarregar, setRecarregar] = useState(0);
  const atualizar = () => setRecarregar(n => n + 1);

  useEffect(() => {
    let cancelado = false;
    api('/metas').then(({ ok, data }) => { if (ok && !cancelado) setMetas(data); });
    return () => { cancelado = true; };
  }, [versao, recarregar]);

  const ativas = (metas ?? []).filter(m => !m.arquivada);
  const guardado = ativas.reduce((a, m) => a + m.atual, 0);

  return (
    <div className="section-enter">
      <PageHeader Icon={PiggyBank} titulo="Metas" subtitulo="Reservas e objetivos, com quanto guardar por mês">
        {ativas.length > 0 && (
          <div className="saldo-total"><small>Guardado nas metas</small><strong>{fmt(guardado)}</strong></div>
        )}
      </PageHeader>

      <MetaForm editando={editando} onCancelar={() => setEditando(null)} onSalvo={() => { setEditando(null); atualizar(); }} />

      <div className="hist-wrap">
        <div className="card-head">
          <div className="card-title"><Target size={20} />Suas metas</div>
          <div className="card-sub pill">{ativas.length} {ativas.length === 1 ? 'ativa' : 'ativas'}</div>
        </div>
        {!metas ? <div className="empty">Carregando...</div> : metas.length === 0 ? (
          <div className="empty form-dica"><Info size={14} />Nenhuma meta ainda. Crie a primeira acima, por exemplo uma reserva de emergência.</div>
        ) : <div className="orc-grid">{metas.map(m => (
          <MetaCard key={m.id} meta={m} onEditar={meta => { setEditando(meta); window.scrollTo({ top: 0, behavior: 'smooth' }); }} onMudou={atualizar} />
        ))}</div>}
      </div>
    </div>
  );
}
