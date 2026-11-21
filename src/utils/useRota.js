import { useCallback, useEffect, useState } from 'react';
import { ehSecao } from '../nav';

// "#/lancamento/novo" -> { secao: 'lancamento', param: 'novo' }
const lerHash = () => {
  const [id, param = ''] = window.location.hash.replace(/^#\/?/, '').split('/');
  return { secao: ehSecao(id) ? id : 'dashboard', param };
};

// A seção aberta vive na URL (#/metas): o botão voltar, o F5 e os links funcionam.
export function useRota() {
  const [rota, setRota] = useState(lerHash);

  useEffect(() => {
    const aoMudar = () => { setRota(lerHash()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', aoMudar);
    return () => window.removeEventListener('hashchange', aoMudar);
  }, []);

  const navegar = useCallback((id, param) => {
    const alvo = `#/${id}${param ? `/${param}` : ''}`;
    if (window.location.hash === alvo) window.scrollTo({ top: 0, behavior: 'smooth' });
    else window.location.hash = alvo;
  }, []);

  return [rota.secao, navegar, rota.param];
}
