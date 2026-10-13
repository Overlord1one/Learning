/**
 * Persistence boundary. The UI never touches storage directly, so the local
 * adapter can later be swapped for a remote one (e.g. Supabase) without
 * changing business logic.
 */
import { createInitialData } from '../domain/defaults';
import { migrate, validateAppData } from '../domain/schema';
import type { AppData } from '../domain/types';

export interface LoadResult {
  data: AppData;
  /** Set when stored data existed but could not be read. */
  warning: string | null;
}

export interface PersistenceAdapter {
  load(): LoadResult;
  save(data: AppData): { ok: true } | { ok: false; error: string };
  /** Notifies about changes made in another tab / client. */
  subscribe(onExternalChange: (data: AppData) => void): () => void;
}

const STORAGE_KEY = 'setup-quest:data';

function readJson(raw: string | null): unknown {
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

export function createLocalStorageAdapter(storage: Storage = window.localStorage): PersistenceAdapter {
  let lastWritten: string | null = null;

  return {
    load() {
      let raw: string | null = null;
      try {
        raw = storage.getItem(STORAGE_KEY);
      } catch {
        return { data: createInitialData(), warning: 'Der lokale Speicher ist nicht verfügbar. Fortschritt wird nicht gespeichert.' };
      }
      if (raw === null) return { data: createInitialData(), warning: null };
      const parsed = readJson(raw);
      const result = parsed === undefined ? null : validateAppData(migrate(parsed));
      if (result?.ok) {
        lastWritten = raw;
        return { data: result.value, warning: null };
      }
      // Keep the unreadable data as a backup instead of silently destroying it.
      try {
        storage.setItem(`${STORAGE_KEY}:backup-${Date.now()}`, raw);
      } catch {
        /* ignore */
      }
      return {
        data: createInitialData(),
        warning: 'Gespeicherte Daten waren beschädigt und wurden als Sicherung abgelegt. Die App startet neu.',
      };
    },

    save(data) {
      const raw = JSON.stringify(data);
      if (raw === lastWritten) return { ok: true };
      try {
        storage.setItem(STORAGE_KEY, raw);
        lastWritten = raw;
        return { ok: true };
      } catch {
        return { ok: false, error: 'Speichern fehlgeschlagen – der lokale Speicher ist voll. Entferne große Bilder aus eigenen Belohnungen.' };
      }
    },

    subscribe(onExternalChange) {
      const handler = (event: StorageEvent) => {
        if (event.key !== STORAGE_KEY || event.newValue === null || event.newValue === lastWritten) return;
        const parsed = readJson(event.newValue);
        if (parsed === undefined) return;
        const result = validateAppData(migrate(parsed));
        if (result.ok) {
          lastWritten = event.newValue;
          onExternalChange(result.value);
        }
      };
      window.addEventListener('storage', handler);
      return () => window.removeEventListener('storage', handler);
    },
  };
}
