import { CategoryScale, Chart, Legend, LinearScale, Tooltip } from 'chart.js';
import { MatrixController, MatrixElement } from 'chartjs-chart-matrix';
import ChartDataLabels from 'chartjs-plugin-datalabels';

/**
 * Register required Chart.js pieces for the heatmap.
 * Safe to call multiple times.
 */
export function ensureHeatmapChartRegistered() {
  Chart.register(
    CategoryScale,
    LinearScale,
    Tooltip,
    Legend,
    MatrixController,
    MatrixElement,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ChartDataLabels as any
  );
}
