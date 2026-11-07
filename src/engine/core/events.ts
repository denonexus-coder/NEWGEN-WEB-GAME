type Handler = (payload?: unknown) => void;

/** Event bus minimalista (zero dependências) — desacopla módulos entre si */
export class EventBus {
  private map = new Map<string, Set<Handler>>();

  on(event: string, handler: Handler): () => void {
    let set = this.map.get(event);
    if (!set) {
      set = new Set();
      this.map.set(event, set);
    }
    set.add(handler);
    return () => this.off(event, handler);
  }

  once(event: string, handler: Handler): () => void {
    const off = this.on(event, (p) => {
      off();
      handler(p);
    });
    return off;
  }

  off(event: string, handler: Handler): void {
    this.map.get(event)?.delete(handler);
  }

  emit(event: string, payload?: unknown): void {
    const set = this.map.get(event);
    if (!set) return;
    for (const h of [...set]) {
      try {
        h(payload);
      } catch (err) {
        console.error(`[events] handler de "${event}" falhou:`, err);
      }
    }
  }

  clear(): void {
    this.map.clear();
  }
}
