import { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import { getCatColor } from '../../utils/formatters';

export default function DonutChart({ sorted, categorias }) {
  const canvasRef = useRef(null);
  const chartRef  = useRef(null);

  useEffect(() => {
    if (chartRef.current) chartRef.current.destroy();

    const top = sorted.slice(0, 5);
    if (!top.length) return;

    chartRef.current = new Chart(canvasRef.current, {
      type: 'doughnut',
      data: {
        labels: top.map(c => c[0]),
        datasets: [{
          data: top.map(c => Math.round(c[1])),
          backgroundColor: top.map(c => getCatColor(categorias, c[0])),
          borderWidth: 0, hoverOffset: 4,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#8b90a0', font: { size: 11 }, boxWidth: 8, padding: 10, usePointStyle: true },
          },
          tooltip: {
            backgroundColor: '#1a1e29', borderColor: 'rgba(255,255,255,0.08)',
            borderWidth: 1, titleColor: '#f0f2f8', bodyColor: '#8b90a0', padding: 10,
          },
        },
        cutout: '68%',
      },
    });

    return () => chartRef.current?.destroy();
  }, [sorted, categorias]);

  return <canvas ref={canvasRef} />;
}
