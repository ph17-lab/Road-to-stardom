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

// Em alguns contextos (arquivo aberto direto no celular) o acesso ao
// localStorage pode lançar SecurityError — nunca deixe isso derrubar o jogo.
function defaultStorage() {
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
}

// Wrappers de localStorage (a UI usa; os testes usam serialize/deserialize direto)
export function saveToStorage(G, storage = defaultStorage()) {
  if (!storage) return false;
  try {
    storage.setItem(SAVE_KEY, serialize(G));
    return true;
  } catch {
    return false;
  }
}

export function loadFromStorage(storage = defaultStorage()) {
  if (!storage) return null;
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (!raw) return null;
    return deserialize(raw);
  } catch {
    return null;
  }
}

export function clearStorage(storage = defaultStorage()) {
  try {
    if (storage) storage.removeItem(SAVE_KEY);
  } catch { /* sem armazenamento disponível */ }
}
