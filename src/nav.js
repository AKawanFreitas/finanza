import {
  LayoutDashboard, ArrowLeftRight, Repeat, Tags, Shield, Wallet, FileUp,
  Target, CreditCard, PiggyBank, CalendarCheck, Settings,
} from 'lucide-react';

// Fonte única da navegação: o menu lateral, a barra do celular e as rotas leem daqui.
// `fixa` marca as 4 abas que ficam sempre visíveis na barra inferior do celular.
export const SECOES = [
  { id: 'dashboard',    label: 'Resumo',         Icon: LayoutDashboard, grupo: 'Visão geral',  fixa: true },
  { id: 'lancamento',   label: 'Lançamentos',    Icon: ArrowLeftRight,  grupo: 'Visão geral',  fixa: true },
  { id: 'contas',       label: 'Contas',         Icon: Wallet,          grupo: 'Dinheiro',     fixa: true },
  { id: 'cartoes',      label: 'Cartões',        Icon: CreditCard,      grupo: 'Dinheiro' },
  { id: 'contas-pagar', label: 'Contas a pagar', Icon: CalendarCheck,   grupo: 'Dinheiro',     fixa: true },
  { id: 'orcamentos',   label: 'Orçamentos',     Icon: Target,          grupo: 'Planejamento' },
  { id: 'metas',        label: 'Metas',          Icon: PiggyBank,       grupo: 'Planejamento' },
  { id: 'recorrentes',  label: 'Recorrentes',    Icon: Repeat,          grupo: 'Planejamento' },
  { id: 'importar',     label: 'Importar',       Icon: FileUp,          grupo: 'Ferramentas' },
  { id: 'categorias',   label: 'Categorias',     Icon: Tags,            grupo: 'Ferramentas' },
];

export const SECAO_CONFIG = { id: 'configuracoes', label: 'Configurações', Icon: Settings };
export const SECAO_ADMIN  = { id: 'admin', label: 'Administração', Icon: Shield, grupo: 'Sistema' };

const IDS = new Set([...SECOES, SECAO_CONFIG, SECAO_ADMIN].map(s => s.id));

export const ehSecao = id => IDS.has(id);

export function agrupar(secoes) {
  const grupos = [];
  for (const s of secoes) {
    let g = grupos.find(x => x.nome === s.grupo);
    if (!g) grupos.push(g = { nome: s.grupo, itens: [] });
    g.itens.push(s);
  }
  return grupos;
}
