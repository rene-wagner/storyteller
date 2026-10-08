export interface MediaStorage {
  /** Stores a byte stream and returns an opaque storage key, never a local path. */
  save(data: AsyncIterable<Uint8Array>): Promise<string>;
  /** Returns a byte stream; missing keys fail rather than returning empty content. */
  get(key: string): Promise<AsyncIterable<Uint8Array>>;
  /** Deletes the stored bytes; missing keys fail rather than reporting success. */
  delete(key: string): Promise<void>;
}
