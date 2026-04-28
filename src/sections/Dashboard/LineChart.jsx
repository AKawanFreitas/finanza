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
            borderColor: '#00d68f', backgroundColor: 'rgba(0,214,143,0.07)',
            fill: true, tension: 0.4, pointRadius: 4,
            pointBackgroundColor: '#00d68f', pointBorderColor: '#13161e', pointBorderWidth: 2,
          },
          {
            label: 'Gastos',
            data: months.map(ym => map[ym].gastos),
            borderColor: '#ff6b6b', backgroundColor: 'rgba(255,107,107,0.07)',
            fill: true, tension: 0.4, pointRadius: 4,
            pointBackgroundColor: '#ff6b6b', pointBorderColor: '#13161e', pointBorderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1a1e29', borderColor: 'rgba(255,255,255,0.08)',
            borderWidth: 1, titleColor: '#f0f2f8', bodyColor: '#8b90a0', padding: 10,
          },
        },
        scales: {
          y: {
            ticks: { callback: v => 'R$' + Math.round(v / 1000) + 'k', color: '#555a6e', font: { size: 10 } },
            grid: { color: 'rgba(255,255,255,0.04)' }, border: { display: false },
          },
          x: { ticks: { color: '#555a6e', font: { size: 11 } }, grid: { display: false }, border: { display: false } },
        },
      },
    });

    return () => chartRef.current?.destroy();
  }, [transactions]);

  return <canvas ref={canvasRef} />;
}
