import { Info } from 'lucide-react';

// Faixa verde de orientação no topo da página.
export default function InfoBanner({ children }) {
  return (
    <div className="banner-info" role="note">
      <Info size={20} strokeWidth={2.2} />
      <span>{children}</span>
    </div>
  );
}
