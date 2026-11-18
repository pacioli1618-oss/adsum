// Everything Adsum keeps on the device, in one versioned place. No component touches
// localStorage directly.
//
// Two different things live here:
//   * workplaces — client tokens of the workplaces this device manages (the server keeps hashes).
//   * notebook   — the provider's own days. It exists ONLY here: the server receives just the
//                  notices and month summaries the provider chooses to share.
//
// Browser only. Do not import from Server Components.

import {isThemeChoice, THEME_STORAGE_KEY, type ThemeChoice} from './theme';
import {isLateFor, toDateKey, toTimeKey, type ClientLink, type Entry, type NotebookClient} from './notebook';

const STORAGE_KEY = 'adsum';
const STORE_VERSION = 1;

export type StoredWorkplace = {
  slug: string;
  name: string;
  clientToken: string;
  lastOpenedAt: string;
};

/** A daily notice waiting for the connection to come back. Only today's are ever sent. */
export type QueuedNotice = {
  clientId: string;
  kind: 'check_in' | 'check_out';
  occurredAt: string;
};

export type DeviceStore = {
  version: typeof STORE_VERSION;
  /** Anonymous identity of this device, sent to the RPCs as p_device_id. */
  deviceId: string;
  workplaces: Record<string, StoredWorkplace>;
  clients: NotebookClient[];
  entries: Entry[];
  outbox: QueuedNotice[];
  /** Months ("YYYY-MM") already sent, per client id. */
  sentMonths: Record<string, string[]>;
};

function createEmptyStore(): DeviceStore {
  return {
    version: STORE_VERSION,
    deviceId: crypto.randomUUID(),
    workplaces: {},
    clients: [],
    entries: [],
    outbox: [],
    sentMonths: {},
  };
}

// When the format changes, bump STORE_VERSION and convert the previous version here.
function migrateStore(raw: unknown): DeviceStore | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Partial<DeviceStore>;
  if (data.version === STORE_VERSION && typeof data.deviceId === 'string') {
    return {...createEmptyStore(), ...data} as DeviceStore;
  }
  return null;
}

// localStorage may be missing or throw (private mode, WhatsApp's in-app browser):
// then the app keeps working in this tab's memory only.
let memoryStore: DeviceStore | null = null;
let isPersistent = true;

export function readStore(): DeviceStore {
  if (memoryStore) return memoryStore;
  try {
    const parsed = migrateStore(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null'));
    memoryStore = parsed ?? createEmptyStore();
    if (!parsed) writeStore(memoryStore);
  } catch {
    memoryStore = createEmptyStore();
    isPersistent = false;
  }
  return memoryStore;
}

function writeStore(store: DeviceStore) {
  memoryStore = store;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    isPersistent = true;
  } catch {
    isPersistent = false;
  }
  listeners.forEach((listener) => listener());
}

/** False when this browser can't keep data (private mode): the notebook would vanish. */
export function canPersist() {
  readStore();
  return isPersistent;
}

const listeners = new Set<() => void>();

/** Calls back when this tab or another tab changes the store. Returns the unsubscribe function. */
export function subscribeToStore(listener: () => void) {
  const handleStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    memoryStore = null; // another tab wrote: read again
    listener();
  };
  listeners.add(listener);
  window.addEventListener('storage', handleStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', handleStorage);
  };
}

export function getDeviceId(): string {
  return readStore().deviceId;
}

// ---------------------------------------------------------------------------
// Workplaces managed from this device (client side)
// ---------------------------------------------------------------------------

export function getStoredWorkplace(slug: string): StoredWorkplace | undefined {
  return readStore().workplaces[slug];
}

export function rememberWorkplace(workplace: Omit<StoredWorkplace, 'lastOpenedAt'>) {
  const store = readStore();
  writeStore({
    ...store,
    workplaces: {...store.workplaces, [workplace.slug]: {...workplace, lastOpenedAt: new Date().toISOString()}},
  });
}

export function updateStoredWorkplaceName(slug: string, name: string) {
  const store = readStore();
  const previous = store.workplaces[slug];
  if (!previous || previous.name === name) return;
  writeStore({...store, workplaces: {...store.workplaces, [slug]: {...previous, name}}});
}

export function forgetWorkplace(slug: string) {
  const store = readStore();
  const workplaces = {...store.workplaces};
  delete workplaces[slug];
  writeStore({...store, workplaces});
}

export function listWorkplaces(store: DeviceStore = readStore()): StoredWorkplace[] {
  return Object.values(store.workplaces).sort((a, b) => b.lastOpenedAt.localeCompare(a.lastOpenedAt));
}

// ---------------------------------------------------------------------------
// Notebook (provider side)
// ---------------------------------------------------------------------------

export function addClient(client: Omit<NotebookClient, 'id' | 'createdAt'>): NotebookClient {
  const store = readStore();
  const created: NotebookClient = {...client, id: crypto.randomUUID(), createdAt: new Date().toISOString()};
  writeStore({...store, clients: [...store.clients, created]});
  return created;
}

export function updateClient(id: string, patch: Partial<Omit<NotebookClient, 'id' | 'createdAt'>>) {
  const store = readStore();
  writeStore({...store, clients: store.clients.map((client) => (client.id === id ? {...client, ...patch} : client))});
}

/** Removes the client and every day written for them. */
export function removeClient(id: string) {
  const store = readStore();
  const sentMonths = {...store.sentMonths};
  delete sentMonths[id];
  writeStore({
    ...store,
    clients: store.clients.filter((client) => client.id !== id),
    entries: store.entries.filter((entry) => entry.clientId !== id),
    outbox: store.outbox.filter((notice) => notice.clientId !== id),
    sentMonths,
  });
}

/**
 * After accepting an invite: links the existing client with the same workplace, or creates one.
 * The rate comes from the client's invite; the provider can change the name later.
 */
export function linkClient(input: {name: string; rateAmount: number | null; rateUnit: NotebookClient['rateUnit']; currency: string; link: ClientLink}) {
  const store = readStore();
  const existing = store.clients.find((client) => client.link?.slug === input.link.slug);
  if (existing) {
    updateClient(existing.id, {link: input.link, rateAmount: input.rateAmount, rateUnit: input.rateUnit, currency: input.currency});
    return existing.id;
  }
  return addClient(input).id;
}

export function getEntry(store: DeviceStore, clientId: string, date: string) {
  return store.entries.find((entry) => entry.clientId === clientId && entry.date === date);
}

/** Creates or replaces the entry of one client on one day. */
export function saveEntry(input: Pick<Entry, 'clientId' | 'date' | 'checkIn' | 'checkOut' | 'note'>, options: {markLate?: boolean} = {}) {
  const store = readStore();
  const previous = getEntry(store, input.clientId, input.date);
  const today = toDateKey(new Date());
  const timesChanged = !previous || previous.checkIn !== input.checkIn || previous.checkOut !== input.checkOut;
  const isLate = (previous?.isLate ?? false) || (timesChanged && (options.markLate ?? isLateFor(input.date, today)));
  const entry: Entry = {
    id: previous?.id ?? crypto.randomUUID(),
    ...input,
    note: input.note.slice(0, 500),
    isLate,
    updatedAt: new Date().toISOString(),
  };
  writeStore({
    ...store,
    entries: previous ? store.entries.map((item) => (item.id === previous.id ? entry : item)) : [...store.entries, entry],
  });
  return entry;
}

export function deleteEntry(clientId: string, date: string) {
  const store = readStore();
  writeStore({...store, entries: store.entries.filter((entry) => !(entry.clientId === clientId && entry.date === date))});
}

/** "Cheguei" / "Saí" right now. Returns the time written. */
export function markNow(clientId: string, kind: 'check_in' | 'check_out', now = new Date()) {
  const store = readStore();
  const date = toDateKey(now);
  const time = toTimeKey(now);
  const previous = getEntry(store, clientId, date);
  saveEntry(
    {
      clientId,
      date,
      checkIn: kind === 'check_in' ? (previous?.checkIn ?? time) : (previous?.checkIn ?? null),
      checkOut: kind === 'check_out' ? time : null,
      note: previous?.note ?? '',
    },
    {markLate: false},
  );
  return time;
}

export function queueNotice(notice: QueuedNotice) {
  const store = readStore();
  writeStore({...store, outbox: [...store.outbox, notice]});
}

/** Drops notices that were sent (or can no longer be sent). */
export function removeFromOutbox(sent: QueuedNotice[]) {
  const store = readStore();
  writeStore({...store, outbox: store.outbox.filter((notice) => !sent.includes(notice))});
}

export function markMonthSent(clientId: string, month: string) {
  const store = readStore();
  const months = store.sentMonths[clientId] ?? [];
  if (months.includes(month)) return;
  writeStore({...store, sentMonths: {...store.sentMonths, [clientId]: [...months, month]}});
}

// ---------------------------------------------------------------------------
// Theme choice (src/lib/theme.ts). Its own key, read before the first paint by the inline script.
// ---------------------------------------------------------------------------

export function readThemeChoice(): ThemeChoice {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeChoice(value) ? value : 'auto';
  } catch {
    return 'auto';
  }
}

/** "auto" removes the key: the device decides again. */
export function writeThemeChoice(choice: ThemeChoice) {
  try {
    if (choice === 'auto') window.localStorage.removeItem(THEME_STORAGE_KEY);
    else window.localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // Nothing to do: this browser can't keep the choice, so the device setting stays in charge.
  }
}
