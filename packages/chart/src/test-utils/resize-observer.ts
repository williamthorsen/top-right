/** The observers that are currently connected, so that a test can report a resize to them. */
const connected = new Set<FakeResizeObserver>();

/** A `ResizeObserver` that jsdom does not provide, which reports a resize only when a test calls `reportResize`. */
export class FakeResizeObserver implements ResizeObserver {
  private readonly callback: ResizeObserverCallback;
  private readonly targets = new Set<Element>();

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  /** Adds a target and connects the observer. */
  observe(target: Element): void {
    this.targets.add(target);
    connected.add(this);
  }

  /** Removes a target, and disconnects the observer once it has none. */
  unobserve(target: Element): void {
    this.targets.delete(target);
    if (this.targets.size === 0) connected.delete(this);
  }

  /** Removes every target and disconnects the observer. */
  disconnect(): void {
    this.targets.clear();
    connected.delete(this);
  }

  /** Calls the callback for the observed targets among `elements`, if any. */
  notify(elements: readonly Element[]): void {
    const entries = elements.filter((element) => this.targets.has(element)).map(buildEntry);
    if (entries.length > 0) this.callback(entries, this);
  }
}

/** Reports a resize of `element` to every connected observer of it, after a test has changed its mocked size. */
export function reportResize(element: Element): void {
  for (const observer of connected) observer.notify([element]);
}

// region | Helpers
/** Returns an entry that names the resized element; the observers under test read its size from the element itself. */
function buildEntry(target: Element): ResizeObserverEntry {
  const rect = target.getBoundingClientRect();
  const size = { inlineSize: rect.width, blockSize: rect.height };
  return {
    target,
    contentRect: rect,
    borderBoxSize: [size],
    contentBoxSize: [size],
    devicePixelContentBoxSize: [size],
  };
}
// endregion | Helpers
