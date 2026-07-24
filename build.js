// Empacotador: gera um index.html AUTO-CONTIDO (CSS + JS embutidos).
// O arquivo gerado funciona aberto diretamente no celular/PC (file:// ou
// content://), sem servidor — e também servido por HTTP normalmente.
//
// Uso: npm run build  (rode após qualquer mudança em src/ ou css/)

import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';

// Ordem de concatenação respeitando as dependências entre módulos
const MODULES = [
  'src/core/rng.js',
  'src/data/names.js',
  'src/data/nations.js',
  'src/data/leagues.js',
  'src/core/attributes.js',
  'src/core/player.js',
  'src/core/world.js',
  'src/core/match.js',
  'src/core/academy.js',
  'src/core/development.js',
  'src/core/transfers.js',
  'src/core/competitions.js',
  'src/core/engine.js',
  'src/core/save.js',
  'src/game/match2d.js',
  'src/ui/app.js',
];

// Remove imports e a palavra-chave export (a concatenação vira um escopo único)
function transform(src, file) {
  let out = src;
  out = out.replace(/^import\s[\s\S]*?;\s*$/gm, '');
  out = out.replace(/^export\s*\{[\s\S]*?\};\s*$/gm, '');
  out = out.replace(/^export\s+(function|const|let|class)/gm, '$1');
  if (/^export\s/m.test(out)) {
    throw new Error(`Export não tratado em ${file}`);
  }
  if (/^import\s/m.test(out)) {
    throw new Error(`Import não tratado em ${file}`);
  }
  return `// ==== ${file} ====\n${out}`;
}

// Colisões de nomes top-level entre módulos quebrariam o bundle — detecta cedo.
function checkCollisions(parts) {
  const seen = new Map();
  for (const { file, code } of parts) {
    for (const m of code.matchAll(/^(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z_$][\w$]*)/gm)) {
      const name = m[1];
      if (seen.has(name)) {
        throw new Error(`Nome duplicado no bundle: "${name}" em ${seen.get(name)} e ${file}`);
      }
      seen.set(name, file);
    }
  }
}

const parts = MODULES.map((file) => ({ file, code: transform(readFileSync(file, 'utf8'), file) }));
checkCollisions(parts);

const js = parts.map((p) => p.code).join('\n');
const bundle = `(function () {\n'use strict';\n${js}\n})();`;

// Validação de sintaxe do bundle antes de gravar
new vm.Script(bundle, { filename: 'bundle.js' });

const css = readFileSync('css/style.css', 'utf8');
const template = readFileSync('src/ui/template.html', 'utf8');

if (!template.includes('<!--INLINE_CSS-->') || !template.includes('<!--INLINE_JS-->')) {
  throw new Error('Template sem placeholders INLINE_CSS/INLINE_JS');
}

const html = template
  .replace('<!--INLINE_CSS-->', () => `<style>\n${css}\n</style>`)
  .replace('<!--INLINE_JS-->', () => `<script>\n${bundle}\n</script>`);

writeFileSync('index.html', html);
console.log(`index.html gerado: ${(html.length / 1024).toFixed(0)} KB, auto-contido (funciona sem servidor).`);
