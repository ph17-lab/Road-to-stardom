// Gerador de números pseudo-aleatórios (xorshift32) com semente controlável.
// Permite reprodutibilidade nos testes e é serializado junto com o save.

let s = 88675123;

export function seed(n) {
  s = (n >>> 0) || 1;
}

export function getSeed() {
  return s;
}

export function rand() {
  s ^= s << 13;
  s ^= s >>> 17;
  s ^= s << 5;
  s >>>= 0;
  return s / 4294967296;
}

// inteiro aleatório em [a, b] inclusivo
export function ri(a, b) {
  return a + Math.floor(rand() * (b - a + 1));
}

export function choice(arr) {
  return arr[Math.floor(rand() * arr.length)];
}

export function chance(p) {
  return rand() < p;
}

// distribuição normal (Box-Muller)
export function gauss(mean, sd) {
  let u = 0;
  let v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function clamp(x, min, max) {
  return Math.max(min, Math.min(max, x));
}

// escolha ponderada: items = array, weightFn(item) => peso
export function weightedChoice(items, weightFn) {
  const weights = items.map(weightFn);
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rand() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

export function poisson(lambda) {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rand();
  } while (p > L);
  return k - 1;
}

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
