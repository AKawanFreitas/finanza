import { useEffect, useState } from 'react';

const iniciais = nome => nome.trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();

// Foto da pessoa; sem foto (ou se ela não carregar), as iniciais do nome.
export default function Avatar({ user, className = '' }) {
  const [falhou, setFalhou] = useState(false);
  useEffect(() => setFalhou(false), [user.foto_url]);

  return (
    <span className={`avatar ${className}`} aria-hidden="true">
      {user.foto_url && !falhou
        ? <img src={user.foto_url} alt="" onError={() => setFalhou(true)} />
        : iniciais(user.nome)}
    </span>
  );
}
