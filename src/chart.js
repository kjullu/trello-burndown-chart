import { formatHours } from './model.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const dayFormat = new Intl.DateTimeFormat('da-DK', { day: 'numeric', month: 'short' });
const tooltipDayFormat = new Intl.DateTimeFormat('da-DK', { weekday: 'short', day: 'numeric', month: 'short' });

function svgElement(name, attrs = {}) {
  const element = document.createElementNS(SVG_NS, name);
  Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, value));
  return element;
}

function svgText(text, attrs) {
  const element = svgElement('text', attrs);
  element.textContent = text;
  return element;
}

function linePath(points, x, y, field) {
  const drawn = points.filter((point) => point[field] !== null);
  return drawn.map((point, index) => `${index ? 'L' : 'M'} ${x(points.indexOf(point))} ${y(point[field])}`).join(' ');
}

function pointDate(point) {
  return new Date(`${point.date}T12:00:00`);
}

function describePoint(point) {
  const value = point.actual !== null
    ? `Faktisk ${formatHours(point.actual)}`
    : point.projection !== null ? `Prognose ${formatHours(point.projection)}` : 'Ingen data';
  return point.ideal === null ? value : `${value} · Ideel ${formatHours(point.ideal)}`;
}

// Round the axis step to 1, 2, 2.5 or 5 times a power of ten so tick labels stay readable.
function niceStep(peak, steps) {
  const raw = peak / steps;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const factor = [1, 2, 2.5, 5, 10].find((candidate) => candidate * magnitude >= raw);
  return factor * magnitude;
}

function xLabelIndexes(count) {
  if (count <= 12) return [...Array(count).keys()];
  return [...new Set([0, Math.floor((count - 1) / 2), count - 1])];
}

export function renderChart(container, points, totalEstimate, { today = null } = {}) {
  container.replaceChildren();
  const width = 1000;
  const height = 360;
  const margin = { top: 28, right: 24, bottom: 40, left: 62 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const highest = Math.max(totalEstimate, ...points.flatMap((point) => [point.ideal ?? 0, point.actual ?? 0, point.projection ?? 0]), 1);
  const step = niceStep(highest, 4);
  const tickCount = Math.ceil(highest / step - 1e-9);
  const peak = step * tickCount;
  const svg = svgElement('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', tabindex: '0' });
  svg.setAttribute('aria-label', `Burndown-graf. ${points.map((point) => `${dayFormat.format(pointDate(point))}: ${describePoint(point)}`).join('. ')}`);

  const x = (index) => margin.left + (points.length <= 1 ? 0 : index / (points.length - 1)) * plotWidth;
  const y = (value) => margin.top + (1 - value / peak) * plotHeight;
  for (let tick = 0; tick <= tickCount; tick += 1) {
    const value = peak - tick * step;
    const lineY = y(value);
    svg.append(svgElement('line', { x1: margin.left, x2: width - margin.right, y1: lineY, y2: lineY, class: 'grid-line' }));
    svg.append(svgText(formatHours(value), { x: margin.left - 14, y: lineY + 4, class: 'axis-label', 'text-anchor': 'end' }));
  }

  const idealPath = linePath(points, x, y, 'ideal');
  const actualPoints = points.filter((point) => point.actual !== null);
  const actualPath = linePath(points, x, y, 'actual');
  const projectionPath = linePath(points, x, y, 'projection');
  const areaPath = actualPoints.length ? `${actualPath} L ${x(points.indexOf(actualPoints.at(-1)))} ${y(0)} L ${x(points.indexOf(actualPoints[0]))} ${y(0)} Z` : '';
  if (areaPath) svg.append(svgElement('path', { d: areaPath, class: 'actual-area' }));
  svg.append(svgElement('path', { d: idealPath, class: 'ideal-line' }));
  if (projectionPath) svg.append(svgElement('path', { d: projectionPath, class: 'projection-line' }));
  if (actualPath) svg.append(svgElement('path', { d: actualPath, class: 'actual-line' }));
  actualPoints.forEach((point) => svg.append(svgElement('circle', { cx: x(points.indexOf(point)), cy: y(point.actual), r: 4, class: 'actual-dot' })));

  // Work added mid-sprint makes the actual line rise; label each rise with its size.
  points.forEach((point, index) => {
    const previous = points[index - 1];
    if (!previous || point.actual === null || previous.actual === null || point.actual <= previous.actual) return;
    const markerY = y(point.actual) - 12;
    svg.append(svgElement('path', { d: `M ${x(index)} ${markerY} l 5 -8 h -10 z`, class: 'added-marker' }));
    svg.append(svgText(`+${formatHours(point.actual - previous.actual)} tilføjet`, { x: x(index), y: markerY - 14, class: 'added-label', 'text-anchor': 'middle' }));
  });

  const todayIndex = today ? points.findIndex((point) => point.date === today) : -1;
  if (todayIndex !== -1) {
    svg.append(svgElement('line', { x1: x(todayIndex), x2: x(todayIndex), y1: margin.top - 8, y2: y(0), class: 'today-line' }));
    svg.append(svgText('I DAG', { x: x(todayIndex) + 6, y: margin.top - 2, class: 'today-label' }));
  }

  xLabelIndexes(points.length).forEach((index) => {
    const anchor = index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle';
    svg.append(svgText(dayFormat.format(pointDate(points[index])), { x: x(index), y: height - 12, class: 'axis-label', 'text-anchor': anchor }));
  });

  const cursor = svgElement('line', { y1: margin.top, y2: y(0), class: 'chart-cursor' });
  const tooltip = svgElement('g', { class: 'chart-tooltip', 'aria-hidden': 'true' });
  const tooltipBox = svgElement('rect', { width: 200, height: 46, rx: 6, class: 'chart-tooltip-box' });
  const tooltipDay = svgText('', { x: 10, y: 18, class: 'chart-tooltip-day' });
  const tooltipValue = svgText('', { x: 10, y: 36, class: 'chart-tooltip-value' });
  tooltip.append(tooltipBox, tooltipDay, tooltipValue);
  svg.append(cursor, tooltip);
  container.append(svg);

  if (!points.length || typeof svg.addEventListener !== 'function') return;
  let current = todayIndex !== -1 ? todayIndex : Math.max(0, actualPoints.length - 1);
  const show = (index) => {
    current = Math.max(0, Math.min(points.length - 1, index));
    const point = points[current];
    const value = point.actual ?? point.projection ?? point.ideal ?? 0;
    cursor.setAttribute('x1', x(current));
    cursor.setAttribute('x2', x(current));
    tooltipDay.textContent = tooltipDayFormat.format(pointDate(point));
    tooltipValue.textContent = describePoint(point);
    const boxX = Math.min(Math.max(x(current) - 100, margin.left), width - margin.right - 200);
    const below = y(value) + 16;
    const boxY = below + 46 <= y(0) ? below : Math.max(y(value) - 62, 0);
    tooltip.setAttribute('transform', `translate(${boxX} ${boxY})`);
    svg.classList.add('is-inspecting');
  };
  const hide = () => svg.classList.remove('is-inspecting');
  svg.addEventListener('pointermove', (event) => {
    const box = svg.getBoundingClientRect();
    const viewX = ((event.clientX - box.left) / box.width) * width;
    show(Math.round(((viewX - margin.left) / plotWidth) * (points.length - 1)));
  });
  svg.addEventListener('pointerleave', hide);
  svg.addEventListener('focus', () => show(current));
  svg.addEventListener('blur', hide);
  svg.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    show(current + (event.key === 'ArrowRight' ? 1 : -1));
  });
}
