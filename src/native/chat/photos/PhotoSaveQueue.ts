import {photoFormat, type ChatPhoto} from './photoTypes';
export class PhotoSaveQueue {
  private pending = new Map<string, ChatPhoto>(); private seen = new Set<string>();
  private enabled: boolean | null = null; private disposed = false; private running = false; private loaded = false;
  private generation = 0;
  constructor(private options: {load: () => Promise<string[]>; remember: (ids: string[]) => Promise<void>; save: (photo: ChatPhoto, allowed: () => boolean) => Promise<boolean>; error: (error: unknown) => void;}) {}
  configure(enabled: boolean | null) {this.enabled = enabled; if (enabled === false) this.pending.clear(); void this.flush();}
  resume() {this.disposed = false; void this.flush();}
  enqueue(photo: ChatPhoto) {
    if (this.disposed || this.enabled === false || !photoFormat(photo.dataUrl) || this.seen.has(photo.id)) return;
    this.pending.set(photo.id, photo); void this.flush();
  }
  private async flush() {
    if (this.disposed || this.running || this.enabled !== true || !this.pending.size) return;
    this.running = true;
    const generation = this.generation;
    try {
      if (!this.loaded) {this.seen = new Set(await this.options.load()); this.loaded = true;}
      while (!this.disposed && generation === this.generation && this.enabled && this.pending.size) {
        const photo = this.pending.values().next().value!; this.pending.delete(photo.id);
        if (this.seen.has(photo.id)) continue;
        try {
          if (await this.options.save(photo, () => !this.disposed && generation === this.generation && this.enabled === true)) {
            this.seen.add(photo.id);
            const ids = [...this.seen].slice(-5000); this.seen = new Set(ids);
            await this.options.remember(ids);
          }
        } catch (cause) {if (!this.disposed) this.options.error(cause);}
      }
    } catch (cause) {if (!this.disposed) this.options.error(cause);}
    finally {this.running = false; if (generation !== this.generation && !this.disposed) void this.flush();}
  }
  dispose() {this.disposed = true; this.generation++; this.pending.clear();}
}
