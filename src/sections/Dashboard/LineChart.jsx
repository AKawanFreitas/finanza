import { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import { useFinance } from '../../context/FinanceContext';

const MONTH_ABBR = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

export default function LineChart() {
  const { transactions } = useFinance();
  const canvasRef = useRef(null);
  const chartRef  = useRef(null);

  useEffect(() => {
    const map = {};
    transactions.forEach(t => {
      const ym = t.data.slice(0, 7);
      if (!map[ym]) map[ym] = { receitas: 0, gastos: 0 };
      if (t.tipo === 'entrada') map[ym].receitas += t.valor;
      else                       map[ym].gastos   += t.valor;
    });

    const months = Object.keys(map).sort();
    if (!months.length) return;

    if (chartRef.current) chartRef.current.destroy();

    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: {
        labels:   months.map(ym => MONTH_ABBR[parseInt(ym.slice(5, 7)) - 1]),
        datasets: [
          {
            label: 'Receitas',
            data: months.map(ym => map[ym].receitas),
            borderColor: '#1d8f3e', borderWidth: 2.5,
            fill: false, tension: 0, pointRadius: 0, pointHoverRadius: 5,
            pointBackgroundColor: '#1d8f3e',
          },
          {
            label: 'Gastos',
            data: months.map(ym => map[ym].gastos),
            borderColor: '#0e1726', borderWidth: 2.5, borderDash: [6, 4],
            fill: false, tension: 0, pointRadius: 0, pointHoverRadius: 5,
            pointBackgroundColor: '#0e1726',
          },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0e1726', cornerRadius: 4, titleColor: '#fff', bodyColor: '#dde3ec', padding: 10,
            callbacks: { label: c => ` ${c.dataset.label}: R$ ${c.parsed.y.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` },
          },
        },
        scales: {
          y: {
            ticks: { callback: v => 'R$' + Math.round(v / 1000) + 'k', color: '#6f7a8c', font: { size: 12, family: 'Schibsted Grotesk' } },
            grid: { color: '#e8ecea' }, border: { display: false },
          },
          x: { ticks: { color: '#475266', font: { size: 13, family: 'Schibsted Grotesk' } }, grid: { display: false }, border: { display: false } },
        },
      },
    });

    return () => chartRef.current?.destroy();
  }, [transactions]);

  return <canvas ref={canvasRef} />;
}
