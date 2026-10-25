export interface StorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  withLock?<T>(key: string, action: () => Promise<T>, mode?: "read" | "write"): Promise<T>;
}

// All repositories in a native JS runtime share this queue. Web adapters also
// acquire a Web Lock so another tab cannot overwrite a transaction.
const queues = new Map<string, Promise<unknown>>();
export async function withStorageLock<T>(
  storage: StorageAdapter,
  key: string,
  action: () => Promise<T>,
  mode: "read" | "write" = "write",
): Promise<T> {
  const previous = queues.get(key) || Promise.resolve();
  const result = previous.catch(() => {}).then(() =>
    storage.withLock ? storage.withLock(key, action, mode) : action(),
  );
  queues.set(key, result);
  try {
    return await result;
  } finally {
    if (queues.get(key) === result) queues.delete(key);
  }
}

export async function withBrowserStorageLock<T>(
  locks: { request<R>(key: string, action: () => Promise<R>): Promise<R> } | undefined,
  key: string,
  action: () => Promise<T>,
  mode: "read" | "write" = "write",
): Promise<T> {
  if (locks) return locks.request(key, action);
  if (mode === "read") return action();
  throw new Error("This browser cannot safely save demo data. Open the app using HTTPS in an up-to-date browser.");
}
