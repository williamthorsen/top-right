import { onTestFinished } from 'vitest';

/**
 * Gives every chart scroll container a client size from the moment it mounts, which patching a mounted element cannot
 * do, since the chart measures the container before the test can reach it.
 */
export function mockScrollAreaSize(size: { width: number; height: number }): void {
  const prototype = HTMLElement.prototype;
  // jsdom lays nothing out, so every other element keeps its client size of 0.
  Object.defineProperties(prototype, {
    clientWidth: {
      configurable: true,
      get(this: HTMLElement): number {
        return this.classList.contains('tr-chart-scroll') ? size.width : 0;
      },
    },
    clientHeight: {
      configurable: true,
      get(this: HTMLElement): number {
        return this.classList.contains('tr-chart-scroll') ? size.height : 0;
      },
    },
  });
  onTestFinished(() => {
    Reflect.deleteProperty(prototype, 'clientWidth');
    Reflect.deleteProperty(prototype, 'clientHeight');
  });
}
