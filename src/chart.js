import { formatHours } from './model.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function svgElement(name, attrs = {}) {
  const element = document.createElementNS(SVG_NS, name);
  Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, value));
  return element;
}

export function renderChart(container, points, totalEstimate) {
  container.replaceChildren();
  const width = 1000;
  const height = 430;
  const margin = { top: 25, right: 28, bottom: 54, left: 66 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const max = Math.max(totalEstimate, 1);
  const svg = svgElement('svg', { viewBox: `0 0 ${width} ${height}`, 'aria-hidden': 'true' });

  const x = (index) => margin.left + (points.length <= 1 ? 0 : index / (points.length - 1)) * plotWidth;
  const y = (value) => margin.top + (1 - value / max) * plotHeight;
  for (let step = 0; step <= 4; step += 1) {
    const value = max * (1 - step / 4);
    const lineY = margin.top + step * (plotHeight / 4);
    svg.append(svgElement('line', { x1: margin.left, x2: width - margin.right, y1: lineY, y2: lineY, class: 'grid-line' }));
    const label = svgElement('text', { x: margin.left - 14, y: lineY + 4, class: 'axis-label', 'text-anchor': 'end' });
    label.textContent = formatHours(value);
    svg.append(label);
  }

  const idealPath = points.map((point, index) => `${index ? 'L' : 'M'} ${x(index)} ${y(point.ideal)}`).join(' ');
  const actualPoints = points.filter((point) => point.actual !== null);
  const actualPath = actualPoints.map((point, index) => `${index ? 'L' : 'M'} ${x(points.indexOf(point))} ${y(point.actual)}`).join(' ');
  const areaPath = actualPoints.length ? `${actualPath} L ${x(points.indexOf(actualPoints.at(-1)))} ${y(0)} L ${x(0)} ${y(0)} Z` : '';
  svg.append(svgElement('path', { d: idealPath, class: 'ideal-line' }));
  if (areaPath) svg.append(svgElement('path', { d: areaPath, class: 'actual-area' }));
  if (actualPath) svg.append(svgElement('path', { d: actualPath, class: 'actual-line' }));
  actualPoints.forEach((point) => svg.append(svgElement('circle', { cx: x(points.indexOf(point)), cy: y(point.actual), r: 5, class: 'actual-dot' })));

  const labelIndexes = [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])];
  labelIndexes.forEach((index) => {
    const date = new Date(`${points[index].date}T12:00:00`);
    const label = svgElement('text', { x: x(index), y: height - 18, class: 'axis-label', 'text-anchor': index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle' });
    label.textContent = new Intl.DateTimeFormat('da-DK', { day: 'numeric', month: 'short' }).format(date);
    svg.append(label);
  });
  container.append(svg);
}
