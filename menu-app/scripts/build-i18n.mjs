// Merges src/app/i18n/parts/<namespace>.<lang>.json into public/i18n/<lang>.json (what the app loads)
// and warns about keys that English has but another language is missing (those show in English).
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const PARTS = 'src/app/i18n/parts';
const OUT = 'public/i18n';
const LANGS = ['en', 'hi', 'gu'];

const merged = Object.fromEntries(LANGS.map(l => [l, {}]));
for (const file of readdirSync(PARTS).filter(f => f.endsWith('.json')).sort()) {
  const [, lang] = file.match(/^.+\.(\w+)\.json$/) ?? [];
  if (!LANGS.includes(lang)) continue;
  const part = JSON.parse(readFileSync(join(PARTS, file), 'utf8'));
  for (const ns of Object.keys(part)) {
    if (merged[lang][ns]) throw new Error(`Namespace "${ns}" is defined twice for ${lang} (${file})`);
    merged[lang][ns] = part[ns];
  }
}

const keys = (obj, prefix = '') => Object.entries(obj).flatMap(([k, v]) =>
  v && typeof v === 'object' ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`]);
const english = new Set(keys(merged.en));
for (const lang of LANGS.filter(l => l !== 'en')) {
  const missing = [...english].filter(k => !new Set(keys(merged[lang])).has(k));
  if (missing.length) console.warn(`[i18n] ${lang}: ${missing.length} keys missing (shown in English): ${missing.slice(0, 10).join(', ')}${missing.length > 10 ? '…' : ''}`);
}

for (const lang of LANGS) writeFileSync(join(OUT, `${lang}.json`), JSON.stringify(merged[lang], null, 2) + '\n');
console.log(`[i18n] ${english.size} keys → ${OUT}/{${LANGS.join(',')}}.json`);
