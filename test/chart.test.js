import { afterEach, describe, expect, it } from 'vitest';
import { renderChart } from '../src/chart.js';

class TestElement {
  constructor(name) {
    this.name = name;
    this.attributes = {};
    this.children = [];
    this.textContent = '';
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  append(...children) {
    this.children.push(...children);
  }

  replaceChildren(...children) {
    this.children = children;
  }
}

describe('renderChart', () => {
  const originalDocument = globalThis.document;

  afterEach(() => {
    globalThis.document = originalDocument;
  });

  it('scales the y-axis to include forecast values', () => {
    globalThis.document = { createElementNS: (_namespace, name) => new TestElement(name) };
    const container = new TestElement('div');

    renderChart(container, [
      { date: '2026-09-26', ideal: null, actual: null, projection: 2 },
      { date: '2026-09-28', ideal: 0, actual: null, projection: 0 },
    ], 0);

    const svg = container.children[0];
    const labels = svg.children.filter((child) => child.name === 'text').map((child) => child.textContent);
    expect(labels[0]).toBe('2 t');
  });

  it('draws the ideal line above the actual area fill', () => {
    globalThis.document = { createElementNS: (_namespace, name) => new TestElement(name) };
    const container = new TestElement('div');

    renderChart(container, [
      { date: '2026-09-24', ideal: 2, actual: 2, projection: null },
      { date: '2026-09-25', ideal: 1, actual: 2, projection: null },
    ], 2);

    const paths = container.children[0].children.filter((child) => child.name === 'path');
    const areaIndex = paths.findIndex((path) => path.attributes.class === 'actual-area');
    const idealIndex = paths.findIndex((path) => path.attributes.class === 'ideal-line');
    expect(areaIndex).toBeLessThan(idealIndex);
  });
});
