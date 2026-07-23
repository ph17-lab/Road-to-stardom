// Salvamento da carreira: serialização do estado completo + semente do RNG.

import { getSeed, seed } from './rng.js';

export const SAVE_KEY = 'road-to-stardom-save';

export function serialize(G) {
  return JSON.stringify({ rngSeed: getSeed(), state: G });
}

export function deserialize(json) {
  const data = JSON.parse(json);
  if (!data || !data.state) throw new Error('Save inválido');
  seed(data.rngSeed || 1);
  return data.state;
}

// Wrappers de localStorage (a UI usa; os testes usam serialize/deserialize direto)
export function saveToStorage(G, storage = globalThis.localStorage) {
  if (!storage) return false;
  storage.setItem(SAVE_KEY, serialize(G));
  return true;
}

export function loadFromStorage(storage = globalThis.localStorage) {
  if (!storage) return null;
  const raw = storage.getItem(SAVE_KEY);
  if (!raw) return null;
  try {
    return deserialize(raw);
  } catch {
    return null;
  }
}

export function clearStorage(storage = globalThis.localStorage) {
  if (storage) storage.removeItem(SAVE_KEY);
}
