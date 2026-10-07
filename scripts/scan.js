#!/usr/bin/env node
/* =============================================================
   TAHTA TARAYICISI
   DexScreener'in one cikan / yeni tokenlerini cekip sitenin KENDI
   puanlama motoruyla tarar, yuksek puan alanlari data/board.json'a yazar.
   GitHub Actions'ta calisir; site bu dosyayi okur.

   Puanlama motoru tarayicidaki dosyanin AYNISI (assets/app.js) —
   ikisi ayrisirsa liste ile karne birbirini tutmaz.
   ============================================================= */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'board.json');

/* --- tarayici ortami taklidi: app.js tarayici icin yazildi --- */
const store = {};
global.localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; }
};
global.document = { addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] };
global.location = { search: '', href: 'https://tokenkarnesi.xyz/', origin: 'https://tokenkarnesi.xyz', pathname: '/' };
global.history = { replaceState() {} };
/* navigator Node'da salt okunur; app.js sadece clipboard icin kullaniyor */
if (!global.navigator || !global.navigator.clipboard) {
  try { Object.defineProperty(global.navigator, 'clipboard', { value: { writeText() {} }, configurable: true }); }
  catch (e) { /* gerek yok: tarama sirasinda clipboard cagrilmiyor */ }
}

/* Sitenin motorunu global kapsamda calistir (strict mode'da eval kapsami sizdirmaz) */
for (const f of ['assets/i18n.js', 'assets/app.js']) {
  vm.runInThisContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), { filename: f });
}

const ESIK = Number(process.env.BOARD_MIN || 9);   /* tahtaya girme puani */
const LIMIT = Number(process.env.BOARD_LIMIT || 45); /* bir turda taranacak token */
const KEEP = Number(process.env.BOARD_KEEP || 24);   /* tahtada tutulacak token */
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function jsonOf(url) {
  const r = await fetch(url, { headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error(url + ' -> HTTP ' + r.status);
  return r.json();
}

/* --- aday havuzu: one cikarilan ve yeni profil acan tokenler --- */
async function candidates() {
  const seen = new Set(), list = [];
  const push = rows => (rows || []).forEach(x => {
    const ca = x.tokenAddress, ch = x.chainId;
    if (!ca || !ch) return;
    const k = ch + ':' + ca.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k); list.push({ ca, chain: ch });
  });
  for (const u of [
    'https://api.dexscreener.com/token-boosts/latest/v1',
    'https://api.dexscreener.com/token-boosts/top/v1',
    'https://api.dexscreener.com/token-profiles/latest/v1'
  ]) {
    try { push(await jsonOf(u)); } catch (e) { console.error('aday listesi alinamadi:', u, e.message); }
    await sleep(400);
  }
  return list;
}

/* --- onceki tahtayi da tekrar tara ki dususte olanlar dussun --- */
function previous() {
  try { return JSON.parse(fs.readFileSync(OUT, 'utf8')).items || []; }
  catch (e) { return []; }
}

async function scoreOne(ca, chain) {
  const A = await analyze(ca, chain);           // eslint-disable-line no-undef
  if (!A || A.notFound) return null;
  const s = autoScore(A.checks);                // eslint-disable-line no-undef
  const D = A.D, sec = A.sec;
  return {
    ca, chain: A.chain,
    sym: D.sym, name: D.name, img: D.img || null,
    score: s.yes, unknown: s.unknown,
    answers: Array.from({ length: 12 }, (_, i) => {
      const v = A.checks[i + 1] ? A.checks[i + 1].v : null;
      return v === true ? 1 : v === false ? 0 : null;
    }),
    liq: Math.round(D.liq || 0),
    vol: Math.round(D.vol || 0),
    mcap: Math.round(D.mcap || 0),
    holders: sec.holderCount || null,
    createdAt: D.created || null,
    handle: D.handle || null,
    launchpad: sec.launchpad || null,
    flags: (sec.flags || []).filter(f => f.lvl === 'bad').length,
    sources: sec.sources || [],
    url: D.best ? D.best.url : null,
    scannedAt: Date.now()
  };
}

(async function main() {
  const fresh = await candidates();
  const old = previous().map(x => ({ ca: x.ca, chain: x.chain }));
  const seen = new Set();
  const queue = [];
  for (const c of old.concat(fresh)) {           /* onceki tahta once: dususler hemen gorunsun */
    const k = c.chain + ':' + String(c.ca).toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k); queue.push(c);
  }
  console.log('aday sayisi:', queue.length, '| taranacak:', Math.min(queue.length, LIMIT));

  const results = [];
  for (const c of queue.slice(0, LIMIT)) {
    try {
      const r = await scoreOne(c.ca, c.chain);
      if (r) {
        results.push(r);
        console.log(`${r.score}/12 (?${r.unknown})  ${r.sym.padEnd(12)} ${r.chain}`);
      }
    } catch (e) {
      console.error('atlandi', c.chain, c.ca, '-', e.message);
    }
    await sleep(1200);   /* API'leri yormayalim */
  }

  /* Olu token tuzagi: likiditesi bitmis bir token guvenlik sorularini
     kolayca gecer (cekilecek bir sey kalmamistir) ve yuksek puan alir.
     Tahtaya girmek icin 1. soruyu (likidite esigi) gecmesi sart. */
  const items = results
    .filter(r => r.score >= ESIK && r.answers[0] === 1 && r.liq >= 30000)
    .sort((a, b) => b.score - a.score || b.liq - a.liq)
    .slice(0, KEEP);

  fs.mkdirSync(path.dirname(OUT), { recursive: true });

  /* Kaynak (DexScreener) cevap vermediginde tahtayi SILME.
     7 Eki 2026'da API bir sure bos dondu; her tur sifir sonuc yazdi ve site
     "baraji gecen cikmadi" dedi — yanlis bir mesaj, cunku kimse elenmemisti,
     veri yoktu. Boyle bir turda son basarili tahta korunur, sadece "bayat"
     isaretlenir; site de bunu kullaniciya soyler. */
  const attempted = Math.min(queue.length, LIMIT);
  const degraded = results.length === 0 || (items.length === 0 && results.length < attempted * 0.3);
  if (degraded) {
    let prev = null;
    try { prev = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch (e) {}
    if (prev && Array.isArray(prev.items) && prev.items.length) {
      prev.stale = true;
      prev.lastAttemptAt = Date.now();
      prev.lastAttemptScanned = results.length;
      fs.writeFileSync(OUT, JSON.stringify(prev, null, 1) + '\n');
      console.log(`\nUYARI: tarama sonucsuz (${results.length}/${attempted}); onceki tahta (${prev.items.length} token) korundu, bayat isaretlendi.`);
      return;
    }
  }

  fs.writeFileSync(OUT, JSON.stringify({
    updatedAt: Date.now(),
    threshold: ESIK,
    scanned: results.length,
    items
  }, null, 1) + '\n');

  console.log(`\ntarandi: ${results.length} | tahtaya giren (>=${ESIK}): ${items.length}`);
  console.log('yazildi:', path.relative(ROOT, OUT));
})();
