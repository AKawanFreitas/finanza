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
          borderWidth: 2, borderColor: '#ffffff', hoverOffset: 4,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#475266', font: { size: 13, family: 'Schibsted Grotesk' }, boxWidth: 10, boxHeight: 10, padding: 12, usePointStyle: true, pointStyle: 'rect' },
          },
          tooltip: {
            backgroundColor: '#0e1726', cornerRadius: 4, titleColor: '#fff', bodyColor: '#dde3ec', padding: 10,
          },
        },
        cutout: '58%',
      },
    });

    return () => chartRef.current?.destroy();
  }, [sorted, categorias]);

  return <canvas ref={canvasRef} />;
}
