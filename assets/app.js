/* =============================================================
   TOKEN KARNESI — app
   Veri: DexScreener (public) + GoPlus (public) + RugCheck (public)
   Hepsi tarayicidan dogrudan cagriliyor, backend yok.
   ============================================================= */
'use strict';

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

let LANG = localStorage.getItem('tk_lang') || 'tr';
let S = null;                    // aktif tarama state'i

/* ---------------- i18n ---------------- */
function T(key, vars) {
  let s = (I18N[LANG] && I18N[LANG][key]) || (I18N.tr[key]) || key;
  if (vars) for (const k in vars) s = s.replaceAll('{' + k + '}', vars[k]);
  return s;
}
function applyLang() {
  document.documentElement.lang = LANG;
  $$('[data-i18n]').forEach(el => { el.innerHTML = T(el.dataset.i18n); });
  $('#lang').textContent = LANG === 'tr' ? 'EN' : 'TR';
  $('#ca').placeholder = T('hero.ph');
  paintTitle();
  renderHowCards();
  renderQuestionList();
  /* notlar tarama aninda uretiliyor — dil degisince yeniden hesapla (ag istegi yok) */
  if (S) { S.checks = computeChecks(S.chain, S.ca, S.D, S.sec, S.X, S.RF); render(); }
}

/* ---------------- format helpers ---------------- */
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nf = n => new Intl.NumberFormat(LANG === 'tr' ? 'tr-TR' : 'en-US').format(n);

function usd(n) {
  if (n == null || isNaN(n)) return '—';
  if (n >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T';
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
  return '$' + n.toFixed(n < 1 ? 4 : 2);
}
function price(n) {
  if (!n && n !== 0) return '—';
  if (n >= 1) return '$' + n.toFixed(3);
  const s = n.toFixed(12).replace(/0+$/, '');
  const m = s.match(/^0\.(0*)(\d{1,4})/);
  if (!m) return '$' + s;
  return m[1].length >= 4 ? '$0.0{' + m[1].length + '}' + m[2] : '$' + s.slice(0, 10);
}
function compact(n) {
  if (n == null || isNaN(n)) return '—';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(Math.round(n));
}
function ago(ms) {
  const m = Math.floor(ms / 6e4), h = Math.floor(m / 60), d = Math.floor(h / 24);
  if (d > 0) return d + ' ' + T('s.d');
  if (h > 0) return h + ' ' + T('s.h');
  return Math.max(m, 1) + ' ' + T('s.m');
}
const short = a => !a ? '' : (a.length > 14 ? a.slice(0, 6) + '…' + a.slice(-4) : a);

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('on');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('on'), 2200);
}

/* ---------------- chain maps ---------------- */
const GOPLUS_CHAIN = {
  ethereum: '1', optimism: '10', cronos: '25', bsc: '56', okc: '66', gnosis: '100',
  huobi: '128', polygon: '137', fantom: '250', kcc: '321', zksync: '324', ethw: '10001',
  fon: '201022', arbitrum: '42161', avalanche: '43114', linea: '59144', base: '8453',
  mantle: '5000', opbnb: '204', scroll: '534352', zkevm: '1101', blast: '81457',
  sonic: '146', berachain: '80094', abstract: '2741', unichain: '130', solana: 'solana', tron: 'tron', sui: 'sui'
};
const BUBBLE_CHAIN = { ethereum: 'eth', bsc: 'bsc', fantom: 'ftm', avalanche: 'avax', cronos: 'cro', arbitrum: 'arbi', polygon: 'poly', base: 'base', solana: 'sol', sonic: 'sonic' };
const GMGN_CHAIN   = { solana: 'sol', ethereum: 'eth', base: 'base', bsc: 'bsc', tron: 'tron', blast: 'blast', arbitrum: 'arb', avalanche: 'avax' };
const EXPLORER = {
  ethereum: a => 'https://etherscan.io/address/' + a,
  base: a => 'https://basescan.org/address/' + a,
  bsc: a => 'https://bscscan.com/address/' + a,
  polygon: a => 'https://polygonscan.com/address/' + a,
  arbitrum: a => 'https://arbiscan.io/address/' + a,
  optimism: a => 'https://optimistic.etherscan.io/address/' + a,
  avalanche: a => 'https://snowscan.xyz/address/' + a,
  solana: a => 'https://solscan.io/account/' + a,
  blast: a => 'https://blastscan.io/address/' + a,
  robinhood: a => 'https://robinhoodchain.blockscout.com/address/' + a,
  sonic: a => 'https://sonicscan.org/address/' + a
};
const explorerUrl = (chain, a) => (EXPLORER[chain] ? EXPLORER[chain](a) : 'https://dexscreener.com/' + chain);

const BURN_ADDR = new Set([
  '0x0000000000000000000000000000000000000000',
  '0x000000000000000000000000000000000000dead',
  '0x0000000000000000000000000000000000000001',
  '11111111111111111111111111111111',
  '1nc1nerator11111111111111111111111111111111'
]);
/* Borsa / saklama / havuz cuzdanlari.
   Bunlar musteri parasi tutar, balina pozisyonu degildir; yogunlasma
   hesabina katilirsa PEPE gibi kurumsal tokenler haksiz yere "dagilim bozuk"
   cikar. Dislaniyor ama kullaniciya ayrica gosteriliyor.
   Liste ezberden degil OLCUMDEN cikti: 15 buyuk ETH tokeni (PEPE, SHIB, LINK,
   UNI, AAVE, CRV, LDO, APE, SAND, MANA, GRT, COMP, ENS...) ve 7 buyuk Solana
   tokeni (BONK, WIF, JUP, RAY, PYTH, JTO, POPCAT) tarandi; birbiriyle alakasiz
   en az 3 tokenin ilk 10'unda ayni anda gorunen adresler alindi. Tek bir balina
   bunu yapamaz — bunlar borsa/saklama/havuz cuzdanlaridir.
   Yanindaki sayi: kac buyuk tokenin ilk 10'unda gorundugu. */
const KNOWN_ENTITY = {
  /* --- Ethereum --- */
  '0x5a52e96bacdabb82fd05763e25335261b270efcb': 10,
  '0xf977814e90da44bfa03b6295a0616a897441acec': 9,
  '0x611f7bf868a6212f871e89f7e44684045ddfb09d': 5,
  '0x76ec5a0d3632b2133d9f1980903305b62678fbd3': 4,
  '0x1d48963dd8fada6ab5c2c7b92eba81ecc5030270': 4,
  /* --- Solana --- */
  '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM': 4,
  '3gd3dqgtJ4jWfBfLYTX67DALFetjc5iS72sCgRhCkW2u': 4,
  '4xLpwxgYuPwPvtQjE94RLS4WZ4aD8NJYYKr2AJk99Qdg': 3,
  '51yZyDSnec4xnUv7XLRVYcDyV4x3wUtzrDcRaYbmQU5j': 3
};
const entityOf = a => KNOWN_ENTITY[a] || KNOWN_ENTITY[String(a || '').toLowerCase()] || null;

/* bilinen Solana AMM / launchpad otoriteleri — top10 hesabindan dislanir */
const SOL_AMM = new Set([
  '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1', // Raydium authority V4
  '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', // Raydium authority
  'GThUX1Atko4tqhN2NaiTazWSeFWMuiUvfFnyJyUghFMz', // Raydium
  '39azUYFWPz3VHgKCf3VChUwbpURdCHRxjWVowf5jUJjg', // pump.fun fee/curve
  '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j',
  'HTppa1CkPZbeWx9SjeVaBpeTVNVhPXjyxNoTHwFWTLPy',
  'DjVE6JNiYqPL2QXyCUUh8rNjHrbz9hXHNYt99MQ59qw1', // Orca
  '4qRJ7YnFRSHFAgYbnrfxAJKV3XTMhOSNfg6vBhLGGGpX'
]);

/* ---------------- fetch layer ---------------- */
async function jget(url, ms = 15000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, { signal: c.signal, headers: { accept: 'application/json' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}

async function fetchDex(ca) {
  const d = await jget('https://api.dexscreener.com/latest/dex/tokens/' + encodeURIComponent(ca));
  return (d && d.pairs) || [];
}

/* X hesabi: fxtwitter herkese acik ve CORS * veriyor (anahtar gerekmiyor).
   Dusunce: hesap yasi (soru 8) ve takipci kalitesi (soru 9) buradan cikiyor. */
async function fetchSocial(handle) {
  if (!handle) return null;
  const norm = u => ({
    ok: true, handle: u.screen_name || handle,
    id: u.id, followers: u.followers, following: u.following,
    tweets: u.tweets, likes: u.likes, name: u.name, avatar: u.avatar_url,
    joined: u.joined ? new Date(u.joined) : null,
    verified: !!(u.verification && u.verification.verified),
    vtype: (u.verification && u.verification.type) || null,
    site: (u.website && u.website.url) || null
  });
  try {
    const d = await jget('https://api.fxtwitter.com/' + encodeURIComponent(handle), 12000);
    if (d && d.user) return norm(d.user);
    return { ok: false, handle, missing: true };
  } catch (e) {
    /* yedek: vxtwitter */
    try {
      const v = await jget('https://api.vxtwitter.com/' + encodeURIComponent(handle), 10000);
      if (v && v.id) return {
        ok: true, handle: v.screen_name || handle, id: String(v.id),
        followers: v.followers_count, following: v.following_count, tweets: v.tweets_count || null,
        name: v.name, avatar: v.profile_image_url,
        joined: v.created_at ? new Date(v.created_at) : null, verified: !!v.verified, vtype: null, site: null
      };
    } catch (e2) {}
    return { ok: false, handle, missing: /404/.test(String(e)) };
  }
}

/* RugCheck tam raporu (Solana): dev gecmisi + insider kumeleri.
   Taze memecoinlerde 10-60KB; dev tokenlerde buyuyebilir, o yuzden timeout'lu. */
async function fetchRugFull(ca) {
  try {
    const d = await jget('https://api.rugcheck.xyz/v1/tokens/' + ca + '/report', 20000);
    if (!d) return null;
    return {
      creator: d.creator || null,
      creatorTokens: Array.isArray(d.creatorTokens) ? d.creatorTokens : [],
      insiders: Number(d.graphInsidersDetected || 0),
      networks: Array.isArray(d.insiderNetworks) ? d.insiderNetworks : [],
      launchpad: (d.launchpad && d.launchpad.name) || null,
      totalHolders: d.totalHolders || null,
      rugged: !!d.rugged,
      topHolders: Array.isArray(d.topHolders) ? d.topHolders : []
    };
  } catch (e) { return null; }
}

/* ============================================================
   ZINCIRDEN OKUMA (GoPlus'in kapsamadigi EVM aglari icin)
   GoPlus her agi desteklemiyor. Desteklemedigi yerde "veri yok" deyip
   kullaniciya birakmak yerine dogrudan zincire soruyoruz:
   - eth_getCode + selector taramasi -> mint / pause / blacklist var mi
   - owner() -> sahiplik birakilmis mi (yetkiler cagrilabilir mi)
   - LP pair totalSupply/balanceOf -> LP yakilmis mi (sadece V2 tipi havuz)
   - Blockscout -> ilk 50 holder ve holder sayisi
   ============================================================ */
/* Blockscout limitine takilirsan oturum icinde son basarili veriyi kullan */
const OC_CACHE = {};
const ONCHAIN = {
  robinhood: { rpc: 'https://rpc.mainnet.chain.robinhood.com', scout: 'https://robinhoodchain.blockscout.com' }
};

/* Solidity dispatcher tablosunda PUSH4 olarak duran fonksiyon imzalari */
const SEL = {
  mint: ['40c10f19', 'a0712d68', '6a627842', '449a52f8'],
  freeze: ['8456cb59', 'f9f92be4', '0ecb93c0', 'e4997dc5', 'd936547e', '1e89d545'],
  owner: ['8da5cb5b', '893d20e8'],
  renounce: ['715018a6']
};

async function rpc(url, method, params, ms = 12000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, {
      method: 'POST', signal: c.signal,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
    });
    const d = await r.json();
    return d && d.result != null ? d.result : null;
  } catch (e) { return null; } finally { clearTimeout(t); }
}
const ethCall = (url, to, data) => rpc(url, 'eth_call', [{ to, data }, 'latest']);

/* Blockscout ornekleri yogunlukta 500 dondurebiliyor — bir kez daha dene */
async function jgetRetry(url, ms = 12000, tries = 2) {
  for (let i = 0; i < tries; i++) {
    try { return await jget(url, ms); }
    catch (e) { if (i === tries - 1) throw e; await new Promise(r => setTimeout(r, 700)); }
  }
}
const isZeroWord = h => !h || /^0x0*$/.test(h);

async function fetchOnChain(chain, ca, pairs) {
  const cfg = ONCHAIN[chain];
  if (!cfg) return null;
  const out = { ok: false, sources: [], flags: [], supported: true, onchain: true,
                pairSet: new Set((pairs || []).map(p => String(p.pairAddress || '').toLowerCase())) };

  /* --- 1) kontrat bytecode'u: hangi tehlikeli fonksiyonlar var --- */
  const code = (await rpc(cfg.rpc, 'eth_getCode', [ca, 'latest'])) || '';
  if (code && code.length > 4) {
    out.ok = true; out.sources.push(LANG === 'tr' ? 'zincir' : 'on-chain');
    const lc = code.toLowerCase();
    const has = list => list.some(s => lc.includes(s));
    out.mintableCode = has(SEL.mint);
    out.freezableCode = has(SEL.freeze);
    const hasOwner = has(SEL.owner);
    out.proxyLike = code.length < 400;   /* minimal proxy / delege eden kontrat */

    /* --- 2) sahiplik birakilmis mi --- */
    let renounced = !hasOwner;           /* owner() yoksa cagrilacak yetki de yok */
    if (hasOwner) {
      const o = await ethCall(cfg.rpc, ca, '0x8da5cb5b') || await ethCall(cfg.rpc, ca, '0x893d20e8');
      out.owner = o && o.length >= 42 ? '0x' + o.slice(-40) : null;
      renounced = isZeroWord(o) || (out.owner && BURN_ADDR.has(out.owner.toLowerCase()));
    }
    out.ownerRenounced = renounced;
    out.mintable  = !!out.mintableCode && !renounced;
    out.freezable = !!out.freezableCode && !renounced;
    if (out.proxyLike) out.flags.push({ lvl: 'warn', k: 'fl.proxy' });
  }

  /* --- 3) LP: sadece V2 tipi havuzlarda LP token vardir --- */
  const v2 = (pairs || []).filter(p => !(p.labels || []).some(l => /v3|v4/i.test(l)) && /^0x[a-fA-F0-9]{40}$/.test(p.pairAddress))
    .sort((a, b) => liqOf(b) - liqOf(a))[0];
  const anyPair = (pairs || []).slice().sort((a, b) => liqOf(b) - liqOf(a))[0];
  if (v2) {
    const [ts, dead, zero] = await Promise.all([
      ethCall(cfg.rpc, v2.pairAddress, '0x18160ddd'),
      ethCall(cfg.rpc, v2.pairAddress, '0x70a08231000000000000000000000000000000000000000000000000000000000000dead'),
      ethCall(cfg.rpc, v2.pairAddress, '0x70a082310000000000000000000000000000000000000000000000000000000000000000')
    ]);
    const n = h => (h && h !== '0x') ? Number(BigInt(h)) : 0;
    const total = n(ts);
    if (total > 0) out.lpLockedPct = Math.min(((n(dead) + n(zero)) / total) * 100, 100);
  }
  /* V2 okunamadiysa ve havuzlar konsantre likidite tipindeyse LP token yok demektir */
  if (out.lpLockedPct == null && anyPair && (pairs || []).some(p => (p.labels || []).some(l => /v3|v4/i.test(l)))) {
    out.concentratedLp = true;
  }

  /* --- 4) Blockscout: holder listesi ve sayisi --- */
  if (cfg.scout) {
    try {
      /* Blockscout uclari ara ara 500 donuyor; her birini ayri ayri degerlendir
         ve toplam arzi zincirden oku ki holder yuzdeleri tek uca bagli kalmasin. */
      const [tokR, holdR, addrR, supR] = await Promise.allSettled([
        jgetRetry(cfg.scout + '/api/v2/tokens/' + ca, 12000),
        jgetRetry(cfg.scout + '/api/v2/tokens/' + ca + '/holders', 12000),
        jgetRetry(cfg.scout + '/api/v2/addresses/' + ca, 12000),
        ethCall(cfg.rpc, ca, '0x18160ddd')
      ]);
      const val = r => r.status === 'fulfilled' ? r.value : null;
      const tok = val(tokR), hold = val(holdR), addr = val(addrR), supHex = val(supR);

      if (addr) {
        out.creator = addr.creator_address_hash || null;
        if (addr.is_verified === false) out.flags.push({ lvl: 'warn', k: 'fl.notopen' });
      }
      if (tok) {
        if (tok.holders_count != null) out.holderCount = Number(tok.holders_count);
        else if (tok.holders != null) out.holderCount = Number(tok.holders);
      }
      let supply = 0;
      if (supHex && supHex !== '0x') { try { supply = Number(BigInt(supHex)); } catch (e) {} }
      if (!supply && tok && tok.total_supply) supply = Number(tok.total_supply);

      if (hold && Array.isArray(hold.items) && supply > 0) {
        out.ok = true;
        out.sources.push('Blockscout');
        out.topHolders = hold.items.map(h => {
          const a = (h.address || {});
          return {
            addr: a.hash, pct: (Number(h.value) / supply) * 100,
            contract: !!a.is_contract, tag: a.name || a.implementation_name || '',
            locked: /lock|vest|vesting|timelock/i.test(a.name || '')
          };
        });
        /* holder sayisi okunamadiysa en azindan listeden bir alt sinir ver */
        if (out.holderCount == null && hold.next_page_params) out.holderCount = null;
      }
    } catch (e) {}
  }
  /* Blockscout bir istekte 500 donerse onceki basarili veriye dus */
  const key = chain + ':' + String(ca).toLowerCase();
  const prev = OC_CACHE[key];
  if (prev) {
    if (!(out.topHolders || []).length && (prev.topHolders || []).length) {
      out.topHolders = prev.topHolders;
      if (!out.sources.includes('Blockscout')) out.sources.push('Blockscout');
    }
    if (out.holderCount == null) out.holderCount = prev.holderCount;
    if (!out.creator) out.creator = prev.creator;
  }
  if ((out.topHolders || []).length || out.holderCount != null || out.creator) {
    OC_CACHE[key] = { topHolders: out.topHolders, holderCount: out.holderCount, creator: out.creator };
  }
  return out.ok ? out : null;
}

/* GoPlus + RugCheck -> tek bir normalize guvenlik objesi */
/* ilk 10 cuzdan — LP / yakma / kilit / borsa adresleri haric */
function finishHolders(out, ca) {
  const cex = [];
  const selfAddr = String(ca).toLowerCase();
  const clean = out.topHolders.filter(h => {
    const a = String(h.addr || '').toLowerCase();
    if (BURN_ADDR.has(a) || BURN_ADDR.has(h.addr)) return false;
    if (a === selfAddr) return false;                       /* tokenin kendi kontrati */
    if (h.isLp || h.locked) return false;
    if (out.pairSet && out.pairSet.has(a)) return false;
    if (SOL_AMM.has(h.addr)) return false;
    const ent = entityOf(h.addr);
    if (ent) { cex.push({ addr: h.addr, pct: h.pct, name: null, seen: ent }); return false; }
    if (/uniswap|pancake|raydium|orca|meteora|pool|lock|burn|null|vault|binance|coinbase|okx|kraken|bybit|kucoin|gate|bitfinex|huobi|exchange/i.test(h.tag)) {
      cex.push({ addr: h.addr, pct: h.pct, name: h.tag });
      return false;
    }
    return true;
  });
  out.cleanHolders = clean;
  out.cexHolders = cex;
  if (clean.length) out.top10Pct = clean.slice(0, 10).reduce((s, h) => s + (h.pct || 0), 0);
  return out;
}

async function fetchSecurity(chain, ca, pairs) {
  const out = {
    ok: false, sources: [], mintable: null, freezable: null, lpLockedPct: null,
    top10Pct: null, topHolders: [], holderCount: null, creator: null,
    creatorHoneypots: null, creatorPct: null, flags: [], supported: true
  };
  const gp = GOPLUS_CHAIN[chain];
  if (!gp) {
    /* GoPlus bu agi kapsamiyor -> zincirden kendimiz okuyalim */
    const oc = await fetchOnChain(chain, ca, pairs);
    if (!oc) { out.supported = false; return out; }
    Object.assign(out, oc);
    return finishHolders(out, ca);
  }

  if (chain === 'solana') {
    const [g, r] = await Promise.allSettled([
      jget('https://api.gopluslabs.io/api/v1/solana/token_security?contract_addresses=' + ca),
      jget('https://api.rugcheck.xyz/v1/tokens/' + ca + '/report/summary')
    ]);
    if (g.status === 'fulfilled' && g.value && g.value.result) {
      const k = Object.keys(g.value.result)[0];
      const t = k ? g.value.result[k] : null;
      if (t) {
        out.ok = true; out.sources.push('GoPlus');
        out.mintable  = String((t.mintable  || {}).status) === '1';
        out.freezable = String((t.freezable || {}).status) === '1';
        out.holderCount = t.holder_count != null ? Number(t.holder_count) : null;
        if (Array.isArray(t.creators) && t.creators.length) out.creator = t.creators[0].address || null;
        /* LP: en yuksek TVL'li havuzun burn yuzdesi */
        let best = null;
        (t.dex || []).forEach(d => {
          if (d.burn_percent == null) return;
          const tvl = Number(d.tvl || 0);
          if (!best || tvl > best.tvl) best = { tvl, pct: Number(d.burn_percent), name: d.dex_name };
        });
        if (best) { out.lpLockedPct = best.pct; out.lpPool = best.name; }
        out.topHolders = (t.holders || []).map(h => ({
          addr: h.account, pct: Number(h.percent) * 100,
          locked: String(h.is_locked) === '1', tag: h.tag || ''
        }));
        if (String((t.metadata_mutable || {}).status) === '1') out.flags.push({ lvl: 'warn', k: 'fl.mutable' });
        if (String((t.closable || {}).status) === '1') out.flags.push({ lvl: 'warn', k: 'fl.selfdestruct' });
        if (String((t.transfer_fee_upgradable || {}).status) === '1') out.flags.push({ lvl: 'warn', k: 'fl.slippage' });
      }
    }
    if (r.status === 'fulfilled' && r.value) {
      out.sources.push('RugCheck');
      const rc = r.value;
      if (rc.lpLockedPct != null && (out.lpLockedPct == null || rc.lpLockedPct > out.lpLockedPct)) out.lpLockedPct = rc.lpLockedPct;
      (rc.risks || []).forEach(risk => {
        const n = String(risk.name || '').toLowerCase();
        if (n.includes('rug')) out.flags.push({ lvl: 'bad', k: 'fl.rugged' });
        else if (n.includes('mutable')) { if (!out.flags.some(f => f.k === 'fl.mutable')) out.flags.push({ lvl: 'warn', k: 'fl.mutable' }); }
        else if (risk.level === 'danger') out.flags.push({ lvl: 'bad', raw: risk.name });
        else if (n.includes('holder') || n.includes('insider') || n.includes('bundle') || n.includes('copycat')) out.flags.push({ lvl: 'warn', raw: risk.name });
      });
      out.rcRisks = rc.risks || [];
    }
  } else {
    const g = await jget('https://api.gopluslabs.io/api/v1/token_security/' + gp + '?contract_addresses=' + ca);
    const key = Object.keys((g && g.result) || {})[0];
    const t = key ? g.result[key] : null;
    if (t) {
      out.ok = true; out.sources.push('GoPlus');
      const on = v => String(v) === '1';
      /* Sahiplik sifir adrese birakildiysa owner'a bagli yetkiler (mint,
         blacklist, pause) kodda dursa bile cagrilamaz. GoPlus fonksiyonun
         VARLIGINI bildiriyor, kullanilabilirligini degil. */
      const ownerAddr = String(t.owner_address || '').toLowerCase();
      const renounced = (ownerAddr === '' || BURN_ADDR.has(ownerAddr)) &&
                        !on(t.can_take_back_ownership) && !on(t.hidden_owner);
      out.ownerRenounced = renounced;
      out.mintableCode  = on(t.is_mintable);
      out.freezableCode = on(t.transfer_pausable) || on(t.is_blacklisted);
      out.mintable  = out.mintableCode && !renounced;
      /* cannot_sell_all / trading_cooldown owner'a bagli degil, her hâlükârda sayilir */
      out.freezable = (out.freezableCode && !renounced) || on(t.cannot_sell_all) || on(t.trading_cooldown);
      out.holderCount = t.holder_count != null ? Number(t.holder_count) : null;
      out.creator = t.creator_address || null;
      out.creatorPct = t.creator_percent != null ? Number(t.creator_percent) * 100 : null;
      out.creatorHoneypots = t.honeypot_with_same_creator != null ? Number(t.honeypot_with_same_creator) : null;

      const pairs = new Set((t.dex || []).map(d => String(d.pair || '').toLowerCase()));
      out.pairSet = pairs;
      out.topHolders = (t.holders || []).map(h => ({
        addr: h.address, pct: Number(h.percent) * 100,
        locked: String(h.is_locked) === '1', contract: String(h.is_contract) === '1',
        tag: h.tag || '', isLp: pairs.has(String(h.address || '').toLowerCase())
      }));
      /* LP kilit: kilitli + yakilmis + tokenin KENDI kontratinda duran LP.
         Sonuncusu yaygin bir yakma deseni (orn. PEPE): LP tokenleri token
         kontratina gonderilir, cekecek fonksiyon olmadigi icin fiilen olur. */
      let lp = 0, sawLp = false, selfLp = 0;
      const self = String(ca).toLowerCase();
      (t.lp_holders || []).forEach(h => {
        sawLp = true;
        const p = Number(h.percent) * 100;
        const a = String(h.address || '').toLowerCase();
        if (a === self) { selfLp += p; lp += p; return; }
        if (String(h.is_locked) === '1' || BURN_ADDR.has(a) || /burn|lock|null/i.test(h.tag || '')) lp += p;
      });
      if (sawLp) { out.lpLockedPct = Math.min(lp, 100); out.lpSelfPct = selfLp; }

      const F = out.flags;
      if (on(t.is_honeypot)) F.push({ lvl: 'bad', k: 'fl.honeypot' });
      if (Number(t.buy_tax) > 0.05) F.push({ lvl: 'warn', k: 'fl.buytax', v: (Number(t.buy_tax) * 100).toFixed(1) });
      if (Number(t.sell_tax) > 0.05) F.push({ lvl: 'warn', k: 'fl.selltax', v: (Number(t.sell_tax) * 100).toFixed(1) });
      if (on(t.transfer_pausable)) F.push({ lvl: 'warn', k: 'fl.pausable' });
      if (on(t.is_blacklisted)) F.push({ lvl: 'warn', k: 'fl.blacklist' });
      if (on(t.is_proxy)) F.push({ lvl: 'warn', k: 'fl.proxy' });
      if (String(t.is_open_source) === '0') F.push({ lvl: 'bad', k: 'fl.notopen' });
      if (on(t.can_take_back_ownership)) F.push({ lvl: 'bad', k: 'fl.ownerback' });
      if (on(t.hidden_owner)) F.push({ lvl: 'bad', k: 'fl.hiddenowner' });
      if (on(t.slippage_modifiable)) F.push({ lvl: 'warn', k: 'fl.slippage' });
      if (on(t.selfdestruct)) F.push({ lvl: 'bad', k: 'fl.selfdestruct' });
      if (out.creatorHoneypots > 0) F.push({ lvl: 'bad', k: 'fl.creatorhp', v: out.creatorHoneypots });
    }
  }

  return finishHolders(out, ca);
}
/* ---------------- dex aggregation ---------------- */
/* Sahte likidite tuzagi: bir havuz degersiz bir token ile eslenirse
   DexScreener oraya milyonlarca dolarlik "likidite" ve sacma bir fiyat yazar.
   Bu yuzden sadece taninan quote tokenlerle acilmis havuzlari sayiyoruz. */
const TRUSTED_QUOTES = new Set([
  'SOL', 'WSOL', 'ETH', 'WETH', 'CBETH', 'WSTETH', 'BNB', 'WBNB', 'AVAX', 'WAVAX',
  'MATIC', 'WMATIC', 'POL', 'WPOL', 'FTM', 'WFTM', 'S', 'WS', 'CRO', 'WCRO', 'MNT', 'WMNT',
  'BERA', 'WBERA', 'HYPE', 'WHYPE', 'TRX', 'WTRX', 'SUI', 'APT', 'ARB', 'OP',
  'USDC', 'USDC.E', 'USDBC', 'USDT', 'USDT.E', 'USDT0', 'DAI', 'XDAI', 'WXDAI', 'BUSD',
  'FDUSD', 'PYUSD', 'EURC', 'USDS', 'USDE', 'SUSDE', 'FRAX', 'LUSD', 'USD1',
  'WBTC', 'CBBTC', 'TBTC', 'BTCB'
]);
const liqOf = p => (p.liquidity && p.liquidity.usd) || 0;
const volOf = p => (p.volume && p.volume.h24) || 0;

function aggregate(allPairs) {
  const trusted = allPairs.filter(p => TRUSTED_QUOTES.has(String((p.quoteToken || {}).symbol || '').toUpperCase()));
  const pairs = trusted.length ? trusted : allPairs;
  const ghostLiq = allPairs.reduce((s, p) => s + liqOf(p), 0) - pairs.reduce((s, p) => s + liqOf(p), 0);

  const liq = pairs.reduce((s, p) => s + liqOf(p), 0);
  const vol = pairs.reduce((s, p) => s + volOf(p), 0);
  const buys = pairs.reduce((s, p) => s + ((p.txns && p.txns.h24 && p.txns.h24.buys) || 0), 0);
  const sells = pairs.reduce((s, p) => s + ((p.txns && p.txns.h24 && p.txns.h24.sells) || 0), 0);
  /* referans havuz: once hacim, sonra likidite — fiyat/mcap buradan okunur */
  const best = pairs.slice().sort((a, b) => (volOf(b) - volOf(a)) || (liqOf(b) - liqOf(a)))[0];
  const created = pairs.reduce((m, p) => Math.min(m, p.pairCreatedAt || Infinity), Infinity);
  const info = (pairs.find(p => p.info && (p.info.socials || p.info.imageUrl)) || {}).info || {};
  const socials = info.socials || [];
  /* x.com/i/communities/... , /intent/... , /search?... gibi linkler profil degil */
  const RESERVED = new Set(['i', 'intent', 'search', 'hashtag', 'home', 'explore', 'messages', 'notifications', 'share', 'status', 'compose']);
  const twAll = socials.filter(s => /twitter|^x$/i.test(s.type || '') || /(twitter|x)\.com/i.test(s.url || ''));
  let handle = null, community = null, tw = null;
  twAll.forEach(s => {
    const m = String(s.url || '').match(/(?:twitter|x)\.com\/(@?[A-Za-z0-9_]{1,15})(?:[/?#]|$)/i);
    if (!m) return;
    const h = m[1].replace('@', '');
    if (RESERVED.has(h.toLowerCase())) { if (/communit/i.test(s.url)) community = s.url; return; }
    if (!handle) { handle = h; tw = s; }
  });
  return {
    liq, vol, buys, sells, best, info, socials, twitter: tw ? tw.url : null, handle, community,
    pairCount: pairs.length, ghostPairs: allPairs.length - pairs.length, ghostLiq,
    created: created === Infinity ? null : created,
    price: best ? Number(best.priceUsd) : null,
    chg: best && best.priceChange ? best.priceChange.h24 : null,
    mcap: best ? (best.marketCap || best.fdv) : null,
    sym: best ? best.baseToken.symbol : '?',
    name: best ? best.baseToken.name : '',
    img: info.imageUrl || null,
    website: (info.websites && info.websites[0] && info.websites[0].url) || null
  };
}

/* ---------------- scoring ---------------- */
/* Olgun varlik testi: buyuk piyasa degeri + eski havuz + cok holder */
function isMature(D, sec) {
  const ageDays = D.created ? (Date.now() - D.created) / 864e5 : 0;
  return (D.mcap || 0) > 5e7 && ageDays > 180 && (sec.holderCount || 0) > 20000;
}

function snapKey(chain, ca) { return 'tk_snap_' + chain + '_' + ca.toLowerCase(); }
function ansKey(chain, ca)  { return 'tk_ans_'  + chain + '_' + ca.toLowerCase(); }

function computeChecks(chain, ca, D, sec, X, RF) {
  const C = {};
  const put = (n, v, note, opt) => { C[n] = Object.assign({ n, v, note, kind: 'auto' }, opt || {}); };

  /* 1 — likidite */
  put(1, D.liq > 0 ? D.liq > 30000 : null,
      D.liq > 0 ? T('n.liq', { v: usd(D.liq) }) : T('n.liq.none'),
      { link: D.best ? D.best.url : null, linkLabel: 'DexScreener' });

  /* Zincir guvenlik API'lerinin kapsaminda degilse 2-7 arasi sorular icin
     "okunamadi" degil, "bu zincirde veri yok" demek gerekiyor. */
  const noSec = sec.supported === false;
  const unk = noSec ? T('n.nosec', { c: chain }) : T('n.lp.unknown');

  /* 2 — LP kilit / burn */
  const lp = sec.lpLockedPct;
  let n2;
  if (lp == null && sec.concentratedLp) n2 = T('n.lp.v3');
  else if (lp == null) n2 = unk;
  else if (lp < 50) n2 = T('n.lp.no');
  else if (sec.lpSelfPct > 40) n2 = T('n.lp.self', { v: lp.toFixed(1) });
  else n2 = T('n.lp.burn', { v: lp.toFixed(1) });
  put(2, lp == null ? null : lp >= 50, n2,
      { link: chain === 'solana' ? 'https://rugcheck.xyz/tokens/' + ca : null, linkLabel: chain === 'solana' ? 'RugCheck' : 'GoPlus' });

  /* 3 — mint (sahiplik birakildiysa koddaki fonksiyon cagrilamaz) */
  put(3, sec.mintable == null ? null : !sec.mintable,
      sec.mintable == null ? unk
        : sec.mintable ? T('n.mint.on')
        : (sec.onchain && !sec.mintableCode) ? T('n.mint.nocode')
        : (sec.mintableCode && sec.ownerRenounced ? T('n.mint.renounced') : T('n.mint.off')),
      { linkLabel: sec.sources.join(' + ') || null });

  /* 4 — freeze / pause */
  put(4, sec.freezable == null ? null : !sec.freezable,
      sec.freezable == null ? unk
        : sec.freezable ? T('n.freeze.on')
        : (sec.onchain && !sec.freezableCode) ? T('n.freeze.nocode')
        : (sec.freezableCode && sec.ownerRenounced ? T('n.freeze.renounced') : T('n.freeze.off')),
      { linkLabel: sec.sources.join(' + ') || null });

  /* 5 — ilk 10 cuzdan (borsa cuzdanlari haric) */
  const t10 = sec.top10Pct;
  const cexN = (sec.cexHolders || []).length;
  put(5, t10 == null ? null : t10 < 20,
      t10 == null ? (noSec ? unk : T('n.top10.no'))
        : T('n.top10', { v: t10.toFixed(1) }) + (cexN ? ' ' + T('n.top10.cex', { n: cexN }) : ''),
      { holders: (sec.cleanHolders || []).slice(0, 3), cex: (sec.cexHolders || []).slice(0, 4) });

  /* 6 — dagilim / kumelenme: RugCheck insider grafigi + kumelenme heuristigi */
  let r6 = [], v6 = null;
  const ch = sec.cleanHolders || [];
  if (RF && RF.insiders > 0) {
    const biggest = RF.networks.reduce((m, n) => Math.max(m, n.size || n.activeAccounts || 0), 0);
    r6.push(T('r6.insiders', { n: nf(RF.insiders), s: nf(biggest) }));
  }
  if (RF && RF.topHolders && RF.topHolders.some(h => h.insider)) {
    const c = RF.topHolders.filter(h => h.insider).length;
    r6.push(T('r6.insiderTop', { n: c }));
  }
  if (ch.length) {
    const big = ch[0].pct;
    if (big > 20) r6.push((LANG === 'tr' ? 'tek cüzdanda %' : 'one wallet at ') + big.toFixed(1) + (LANG === 'tr' ? '' : '%'));
    const sizable = ch.filter(h => h.pct >= 0.8).slice(0, 10);
    let cluster = 0;
    for (let i = 0; i < sizable.length; i++) {
      let c = 1;
      for (let j = 0; j < sizable.length; j++) {
        if (i !== j && Math.abs(sizable[i].pct - sizable[j].pct) / Math.max(sizable[i].pct, 0.01) < 0.12) c++;
      }
      cluster = Math.max(cluster, c);
    }
    if (cluster >= 3) r6.push(cluster + (LANG === 'tr' ? ' cüzdan neredeyse aynı miktarı tutuyor' : ' wallets hold nearly identical amounts'));
    if (sec.creatorPct != null && sec.creatorPct > 3) r6.push((LANG === 'tr' ? 'dev %' : 'dev holds ') + sec.creatorPct.toFixed(1) + (LANG === 'tr' ? ' tutuyor' : '%'));
  }
  /* elde gercek bir sinyal yoksa "temiz" deme — bos veri iyi haber degildir */
  const has6 = ch.length > 0 || (RF && (RF.insiders > 0 || (RF.topHolders && RF.topHolders.length > 0)));
  if (has6) v6 = r6.length === 0;
  const bub = BUBBLE_CHAIN[chain];
  put(6, v6,
      v6 === null ? (noSec ? unk : T('n.top10.no'))
        : (v6 ? (ch.length ? T('n.bubble.ok', { v: ch[0].pct.toFixed(1) }) : T('n.bubble.ok2'))
              : T('n.bubble.bad', { r: r6.join(', ') })),
      { kind: RF && RF.insiders > 0 ? 'auto' : 'guess',
        link: bub ? 'https://app.bubblemaps.io/' + bub + '/token/' + ca : 'https://app.bubblemaps.io/', linkLabel: 'Bubblemaps' });

  /* 7 — dev gecmisi: Solana'da RugCheck'in creatorTokens listesi, EVM'de GoPlus honeypot sayaci */
  const gm = GMGN_CHAIN[chain];
  const gmgnUrl = gm ? 'https://gmgn.ai/' + gm + '/token/' + ca : 'https://gmgn.ai/';
  const devUrl = sec.creator ? (gm ? 'https://gmgn.ai/' + gm + '/address/' + sec.creator : gmgnUrl) : gmgnUrl;
  const devExtra = sec.creator
    ? { extraLink: explorerUrl(chain, sec.creator), extraLabel: short(sec.creator) }
    : {};
  if (sec.creatorHoneypots != null && sec.creatorHoneypots > 0) {
    put(7, false, T('n.dev.hp', { v: sec.creatorHoneypots }), Object.assign({ link: devUrl, linkLabel: 'GMGN' }, devExtra));
  } else if (RF && RF.creatorTokens && RF.creatorTokens.length) {
    /* onceki tokenler: 20 bin dolarin altina dusmusler "olmus" sayilir */
    const prev = RF.creatorTokens.slice().sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0));
    const dead = prev.filter(t => (t.marketCap || 0) < 20000);
    const best = prev[0];
    const ok = dead.length === 0 && prev.length < 3;
    put(7, ok,
        T(ok ? 'n.dev.prevok' : 'n.dev.prevbad', {
          n: prev.length, d: dead.length, m: usd(best.marketCap || 0)
        }),
        Object.assign({ link: devUrl, linkLabel: 'GMGN', prevTokens: prev.slice(0, 4) }, devExtra));
  } else if (RF) {
    put(7, true, T('n.dev.first', { v: short(sec.creator || '') }), Object.assign({ link: devUrl, linkLabel: 'GMGN' }, devExtra));
  } else if (sec.creatorHoneypots === 0) {
    put(7, true, T('n.dev.nohp'), Object.assign({ kind: 'guess', link: devUrl, linkLabel: 'GMGN' }, devExtra));
  } else {
    put(7, null, T('n.dev.unknown'), { kind: 'you', link: gmgnUrl, linkLabel: 'GMGN' });
  }

  /* 8 / 9 — X hesabi: yas ve takipci kalitesi (fxtwitter) */
  const tsUrl = D.handle ? 'https://app.tweetscout.io/search?q=' + D.handle : 'https://app.tweetscout.io/';
  const xLinks = D.handle
    ? { link: tsUrl, linkLabel: 'TweetScout', extraLink: 'https://x.com/' + D.handle, extraLabel: '@' + D.handle }
    : { linkLabel: 'DexScreener' };

  if (!D.handle) {
    /* Yeni bir launch'ta "sosyal yok" delildir: puan yok.
       5 yillik, yuz binlerce holder'i olan bir tokende ise bu delil degil,
       DexScreener'da kayit olmamasidir — cevabi kullaniciya birak. */
    const key = D.community ? 'n.x.community' : (isMature(D, sec) ? 'n.x.nodata' : 'n.x.none');
    const cl = D.community ? { link: D.community, linkLabel: 'X Community' } : xLinks;
    const v = isMature(D, sec) && !D.community ? null : false;
    put(8, v, T(key), Object.assign({ kind: v === null ? 'you' : 'auto' }, cl));
    put(9, v, T(key), Object.assign({ kind: v === null ? 'you' : 'auto' }, cl));
  } else if (!X || X.ok === false) {
    /* hesap cekilemedi: silinmis/askida olabilir -> kirmizi, ama elle cevrilebilir */
    const missing = X && X.missing;
    put(8, missing ? false : null, T(missing ? 'n.x.gone' : 'n.x.err', { v: '@' + D.handle }), Object.assign({ kind: missing ? 'auto' : 'you' }, xLinks));
    put(9, missing ? false : null, T(missing ? 'n.x.gone' : 'n.x.err', { v: '@' + D.handle }), Object.assign({ kind: missing ? 'auto' : 'you' }, xLinks));
  } else {
    const ageDays = X.joined ? (Date.now() - X.joined.getTime()) / 864e5 : null;
    const joinedTxt = X.joined ? X.joined.toLocaleDateString(LANG === 'tr' ? 'tr-TR' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
    put(8, ageDays == null ? null : ageDays >= 7,
        T(ageDays == null ? 'n.x.err' : (ageDays >= 7 ? 'n.x.old' : 'n.x.new'),
          { v: '@' + X.handle, d: ageDays == null ? '—' : Math.floor(ageDays), j: joinedTxt }),
        Object.assign({ x: X }, xLinks));

    /* takipci kalitesi heuristigi */
    /* Not: kucuk hesap != bot hesap. Soru "takipciler gercek mi", "cok mu" degil —
       o yuzden sadece satin alinmis takipci desenleri cezalandiriliyor. */
    const r9 = [];
    const fpd = ageDays ? X.followers / Math.max(ageDays, 1) : null;
    const orgVerified = X.verified && (X.vtype === 'organization' || X.vtype === 'government');
    if (fpd && fpd > 3000 && X.followers > 20000 && ageDays < 90 && !orgVerified) r9.push(T('r9.fast', { v: nf(Math.round(fpd)) }));
    if (X.tweets != null && X.tweets < 15 && X.followers > 5000) r9.push(T('r9.notweets', { t: nf(X.tweets), f: nf(X.followers) }));
    if (X.following > 2000 && X.following > X.followers * 1.5) r9.push(T('r9.followfarm', { v: nf(X.following) }));
    const v9 = r9.length === 0;
    put(9, v9,
        T(v9 ? 'n.x.real' : 'n.x.bots', {
          f: nf(X.followers), g: nf(X.following), t: X.tweets != null ? nf(X.tweets) : '—',
          p: fpd ? nf(Math.round(fpd)) : '—', r: r9.join(', ')
        }),
        Object.assign({ kind: 'guess', x: X }, xLinks));
  }

  /* 10 — holder artisi (snapshot varsa gercek, yoksa 24s akis proxy) */
  const hc = sec.holderCount;
  let snap = null;
  try { snap = JSON.parse(localStorage.getItem(snapKey(chain, ca)) || 'null'); } catch (e) {}
  if (hc != null && snap && snap.h && Date.now() - snap.t > 36e5) {
    const up = hc > snap.h;
    put(10, up, T(up ? 'n.holders.up' : 'n.holders.down', { a: nf(snap.h), b: nf(hc), t: ago(Date.now() - snap.t) }));
  } else if (D.buys + D.sells > 0) {
    put(10, D.buys > D.sells * 1.05, T('n.holders.proxy', { b: nf(D.buys), s: nf(D.sells), h: hc != null ? nf(hc) : '—' }), { kind: 'guess' });
  } else {
    put(10, null, T('n.holders.none'), { kind: 'guess' });
  }
  if (hc != null && (!snap || Date.now() - snap.t > 36e5)) {
    try { localStorage.setItem(snapKey(chain, ca), JSON.stringify({ h: hc, t: Date.now() })); } catch (e) {}
  }

  /* 11 — hacim / likidite */
  const ratio = D.liq > 0 ? D.vol / D.liq : null;
  put(11, ratio == null ? null : ratio >= 0.5,
      ratio == null ? T('n.liq.none') : T('n.vol', { v: usd(D.vol), l: usd(D.liq), r: ratio.toFixed(2) }),
      { link: D.best ? D.best.url : null, linkLabel: 'DexScreener' });

  /* 12 — hikaye */
  put(12, null, T('n.story'), { kind: 'you', link: D.website || (D.twitter || null), linkLabel: D.website ? (LANG === 'tr' ? 'Site' : 'Website') : (D.twitter ? 'X' : null) });

  return C;
}

/* ---------------- run ---------------- */
const isEvm = a => /^0x[a-fA-F0-9]{40}$/.test(a);
const isSol = a => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a);

async function run(caRaw, forcedChain) {
  const ca = String(caRaw || '').trim();
  $('#err').hidden = true;
  if (!ca) return showErr(T('e.empty'));
  if (!isEvm(ca) && !isSol(ca)) return showErr(T('e.format'));

  $('#go').disabled = true;
  $('#result').hidden = true;
  showSteps();
  try {
    step(0);
    const all = await fetchDex(ca);
    if (!all.length) { $('#loading').hidden = true; $('#go').disabled = false; return showErr(T('e.notfound')); }

    /* SADECE tokenin base tarafinda oldugu havuzlar: aksi halde fiyat/mcap
       karsi tokene ait olur (BONK/xyz havuzunda mcap xyz'nin olur) */
    const lc = ca.toLowerCase();
    const baseSide = all.filter(p => p.baseToken && String(p.baseToken.address).toLowerCase() === lc);
    const pairs = baseSide.length ? baseSide : all;

    /* zincire gore grupla, en likit zinciri sec */
    const byChain = {};
    pairs.forEach(p => { (byChain[p.chainId] = byChain[p.chainId] || []).push(p); });
    const chains = Object.keys(byChain).sort((a, b) =>
      byChain[b].reduce((s, p) => s + ((p.liquidity && p.liquidity.usd) || 0), 0) -
      byChain[a].reduce((s, p) => s + ((p.liquidity && p.liquidity.usd) || 0), 0));
    const chain = forcedChain && byChain[forcedChain] ? forcedChain : chains[0];

    step(1);
    const D = aggregate(byChain[chain]);
    const [secR, xR, rfR] = await Promise.allSettled([
      fetchSecurity(chain, ca, byChain[chain]),
      (step(2), fetchSocial(D.handle)),
      chain === 'solana' ? fetchRugFull(ca) : Promise.resolve(null)
    ]);
    const sec = secR.status === 'fulfilled' ? secR.value
      : { ok: false, sources: [], mintable: null, freezable: null, lpLockedPct: null, top10Pct: null, topHolders: [], cleanHolders: [], holderCount: null, creator: null, creatorHoneypots: null, flags: [], supported: !!GOPLUS_CHAIN[chain] };
    const X = xR.status === 'fulfilled' ? xR.value : null;
    const RF = rfR.status === 'fulfilled' ? rfR.value : null;

    /* rugcheck tam raporu gelirse dev adresi ve holder sayisi ondan tamamlanir */
    if (RF) {
      if (!sec.creator && RF.creator) sec.creator = RF.creator;
      if (sec.holderCount == null && RF.totalHolders) sec.holderCount = RF.totalHolders;
      if (RF.rugged) sec.flags.push({ lvl: 'bad', k: 'fl.rugged' });
      sec.launchpad = RF.launchpad;
    }
    if (X && X.ok === false) sec.flags.push({ lvl: 'bad', k: 'fl.xgone' });

    step(3);
    const checks = computeChecks(chain, ca, D, sec, X, RF);
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(ansKey(chain, ca)) || '{}'); } catch (e) {}

    S = { ca, chain, chains, byChain, D, sec, X, RF, checks, overrides: saved };
    pushHistory();
    setUrl(ca, chain);
    await new Promise(r => setTimeout(r, 220));
    $('#loading').hidden = true;
    $('#result').hidden = false;
    render();
    $('#result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) {
    console.error(e);
    $('#loading').hidden = true;
    showErr(T('e.net'));
  } finally {
    $('#go').disabled = false;
  }
}

function showErr(m) { const e = $('#err'); e.textContent = m; e.hidden = false; }
function showSteps() {
  $('#loading').hidden = false;
  $('#steps').innerHTML = ['st.dex', 'st.sec', 'st.social', 'st.calc']
    .map(k => '<li><span class="dot"></span>' + T(k) + '</li>').join('');
}
function step(i) {
  $$('#steps li').forEach((li, idx) => {
    li.classList.toggle('on', idx === i);
    li.classList.toggle('done', idx < i);
  });
}
function setUrl(ca, chain) {
  const u = new URL(location.href);
  u.searchParams.set('ca', ca); u.searchParams.set('chain', chain);
  history.replaceState(null, '', u);
}

/* ---------------- answers + score ---------------- */
function answerOf(n) {
  if (!S) return null;
  if (Object.prototype.hasOwnProperty.call(S.overrides, n)) return S.overrides[n];
  return S.checks[n].v;
}
function scoreNow() {
  let yes = 0, unknown = 0;
  for (let n = 1; n <= 12; n++) {
    const a = answerOf(n);
    if (a === true) yes++;
    else if (a === null || a === undefined) unknown++;
  }
  return { yes, unknown, max: yes + unknown };
}
function verdictOf(s) {
  if (s >= 11) return { key: 'rare',  bg: 'var(--lime)',    fg: 'var(--black)' };
  if (s >= 9)  return { key: 'clean', bg: 'var(--cyan)',    fg: 'var(--black)' };
  if (s >= 7)  return { key: 'risky', bg: 'var(--yellow)',  fg: 'var(--black)' };
  return          { key: 'skip',  bg: 'var(--magenta)', fg: '#fff' };
}
function setAnswer(n, v) {
  const cur = answerOf(n);
  if (cur === v) delete S.overrides[n]; else S.overrides[n] = v;
  try { localStorage.setItem(ansKey(S.chain, S.ca), JSON.stringify(S.overrides)); } catch (e) {}
  render();
  pushHistory();
}

/* ---------------- render ---------------- */
function render() {
  if (!S) return;
  renderToken();
  renderChains();
  renderVerdict();
  renderQuestions();
  renderFlags();
  renderHistory();
}

function renderToken() {
  const { D, chain, ca, sec } = S;
  const logo = D.img
    ? '<img class="tc-logo" src="' + esc(D.img) + '" alt="" onerror="this.remove()">'
    : '<div class="tc-logo ph">' + esc((D.sym || '?').slice(0, 3)) + '</div>';
  const age = D.created ? ago(Date.now() - D.created) : '—';
  const chg = D.chg == null ? '' :
    '<div class="chg ' + (D.chg >= 0 ? 'up' : 'dn') + '">' + (D.chg >= 0 ? '▲ ' : '▼ ') + Math.abs(D.chg).toFixed(1) + '%</div>';

  const badges = [];
  badges.push('<span class="chip">' + esc(chain) + '</span>');
  if (D.best && D.best.dexId) badges.push('<span class="chip v">' + esc(D.best.dexId) + '</span>');
  if (sec.launchpad) badges.push('<span class="chip o">🚀 ' + esc(sec.launchpad) + '</span>');
  if (sec.sources.length) badges.push('<span class="chip l">' + esc(sec.sources.join(' + ')) + '</span>');
  if (D.handle) badges.push('<span class="chip y">@' + esc(D.handle) + '</span>');
  if (!sec.supported) badges.push('<span class="chip r">' + (LANG === 'tr' ? 'güvenlik verisi yok' : 'no security data') + '</span>');

  const links = [];
  if (D.best) links.push(l(D.best.url, '📈 DexScreener'));
  if (chain === 'solana') links.push(l('https://rugcheck.xyz/tokens/' + ca, '🛡️ RugCheck'));
  if (BUBBLE_CHAIN[chain]) links.push(l('https://app.bubblemaps.io/' + BUBBLE_CHAIN[chain] + '/token/' + ca, '🫧 Bubblemaps'));
  if (GMGN_CHAIN[chain]) links.push(l('https://gmgn.ai/' + GMGN_CHAIN[chain] + '/token/' + ca, '🐸 GMGN'));
  if (D.handle) links.push(l('https://app.tweetscout.io/search?q=' + D.handle, '🐦 TweetScout'));
  if (D.website) links.push(l(D.website, '🌐 ' + (LANG === 'tr' ? 'Site' : 'Website')));
  links.push(l(explorerUrl(chain, ca), '🔎 Explorer'));

  $('#tokencard').innerHTML =
    '<div class="tokencard">' +
      '<div class="tc-top">' + logo +
        '<div class="tc-id"><div class="tc-sym">' + esc(D.sym) + '</div>' +
          '<div class="tc-name">' + esc(D.name) + '</div>' +
          '<div class="tc-badges">' + badges.join('') + '</div></div>' +
        '<div class="tc-price"><div class="p">' + price(D.price) + '</div>' + chg + '</div>' +
      '</div>' +
      '<div class="tc-stats">' +
        stat(T('s.liq'), usd(D.liq)) + stat(T('s.vol'), usd(D.vol)) +
        stat(T('s.mcap'), usd(D.mcap)) +
        stat(T('s.holders'), sec.holderCount != null ? compact(sec.holderCount) : '—') +
        stat(T('s.age'), age) +
        stat(T('s.pair'), D.pairCount + (D.ghostPairs ? '<span style="opacity:.5;font-size:14px"> +' + D.ghostPairs + '?</span>' : '')) +
      '</div>' +
      '<div class="tc-links">' + links.join('') + '</div>' +
      '<div class="ca-line"><span>' + esc(ca) + '</span><button class="copy" id="copyCa">COPY</button></div>' +
    '</div>';
  $('#copyCa').onclick = () => { navigator.clipboard.writeText(ca); toast(T('toast.copy')); };
}
const l = (href, txt) => '<a class="lnk" href="' + esc(href) + '" target="_blank" rel="noopener">' + txt + '</a>';
const stat = (k, v) => '<div class="stat"><div class="k">' + k + '</div><div class="v">' + v + '</div></div>';

function renderChains() {
  const c = $('#chains');
  if (!S.chains || S.chains.length < 2) { c.hidden = true; return; }
  c.hidden = false;
  c.innerHTML = '<span>' + (LANG === 'tr' ? 'Bu token birden fazla zincirde:' : 'This token lives on several chains:') + '</span>' +
    S.chains.map(ch => '<button class="chain-btn' + (ch === S.chain ? ' sel' : '') + '" data-ch="' + esc(ch) + '">' + esc(ch) + '</button>').join('');
  $$('#chains .chain-btn').forEach(b => b.onclick = () => { if (b.dataset.ch !== S.chain) run(S.ca, b.dataset.ch); });
}

/* Bu 12 soru YENI cikmis memecoinleri elemek icin tasarlandi. Olgun bir
   varlik ya da kopru tokeni tarandiginda bazi maddeler dogasi geregi "hayir"
   doner (LP kilidi, hacim/likidite orani, sosyal hesap yasi). Skoru degistirmiyoruz
   — kullaniciya baglami soyluyoruz. */
function contextNotes() {
  const { D, sec } = S;
  const ageDays = D.created ? (Date.now() - D.created) / 864e5 : 0;
  const out = [];
  /* Adinda "Peg/Wrapped/Bridged" gecmeyen kopru tokenleri de var
     (BSC'deki "XRP Token" gibi). Baska zincirin yerli varligi olan bir
     sembol EVM'de goruluyorsa o bir sarmalayicidir. */
  const FOREIGN = new Set(['XRP', 'ADA', 'DOT', 'LTC', 'BCH', 'ATOM', 'TRX', 'XLM', 'ALGO', 'VET',
    'FIL', 'ICP', 'ETC', 'NEAR', 'HBAR', 'XMR', 'DASH', 'ZEC', 'BTC', 'BTCB', 'WBTC', 'CBBTC',
    'DOGE', 'SOL', 'TON', 'SUI', 'APT', 'KAS', 'XTZ', 'EOS', 'IOTA']);
  const symU = String(D.sym || '').toUpperCase();
  const nativeHere = (symU === 'SOL' && S.chain === 'solana') || (symU === 'TRX' && S.chain === 'tron');
  const bridged = /\bwrapped\b|\bbridged\b|-peg\b|\bpeg\b/i.test((D.name || '') + ' ' + (D.sym || '')) ||
                  (FOREIGN.has(symU) && !nativeHere);
  const mature = (D.mcap || 0) > 5e7 && ageDays > 180 && (sec.holderCount || 0) > 20000;
  if (sec.supported === false) out.push(T('ctx.nosec', { c: S.chain }));
  if (mature) out.push(T('ctx.mature', { m: usd(D.mcap), d: nf(Math.round(ageDays)), h: compact(sec.holderCount) }));
  if (bridged) out.push(T('ctx.bridged'));
  return out;
}

function renderVerdict() {
  const { yes, unknown, max } = scoreNow();
  const v = verdictOf(yes);
  const bars = [];
  for (let n = 1; n <= 12; n++) {
    const a = answerOf(n);
    bars.push('<span class="vb ' + (a === true ? 'y' : a === false ? 'n' : 'u') + '" title="' + n + '"></span>');
  }
  const todo = unknown > 0
    ? '<div class="todo-note">⚠️ ' + unknown + ' ' + T(unknown === 1 ? 'v.todo1' : 'v.todo') +
      (max !== yes ? ' <b>(' + (LANG === 'tr' ? 'en fazla' : 'up to') + ' ' + max + '/12)</b>' : '') + '</div>'
    : '';

  /* Cok sayida soru cevapsizsa ortada hüküm verecek veri yok demektir;
     "GEÇ" damgasi basmak veri yoklugunu suclama gibi gosterir. */
  const tooMany = unknown >= 4;
  const V = tooMany
    ? { key: 'nodata', bg: 'var(--violet)', fg: '#fff' }
    : v;

  const ctx = contextNotes();
  const ctxHtml = ctx.length
    ? '<div class="ctx-note"><span class="ctx-ico">🧭</span><div>' + ctx.join('<br><br>') + '</div></div>'
    : '';

  $('#verdict').innerHTML = ctxHtml +
    '<div class="verdict">' +
      '<div class="v-score" style="background:' + V.bg + '">' +
        '<div class="v-num"' + (tooMany ? ' style="color:#fff"' : '') + '>' + yes + '</div>' +
        '<div class="v-den"' + (tooMany ? ' style="color:#fff"' : '') + '>/ 12</div>' +
        '<div class="v-label"' + (tooMany ? ' style="color:#fff"' : '') + '>' + T('v.label') + '</div>' +
      '</div>' +
      '<div class="v-body">' +
        '<div class="v-stamp" style="background:' + V.bg + ';color:' + V.fg + '">' + T('v.' + V.key) + '</div>' +
        '<div class="v-bars">' + bars.join('') + '</div>' +
        '<div class="v-advice">' + T('v.' + V.key + '.a') + '</div>' + todo +
        '<div class="v-actions">' +
          '<button class="act x" id="shareX">𝕏 ' + T('act.x') + '</button>' +
          '<button class="act png" id="dlPng">⬇️ ' + T('act.png') + '</button>' +
          '<button class="act link" id="cpLink">🔗 ' + T('act.link') + '</button>' +
          '<button class="act" id="again">🔁 ' + T('act.again') + '</button>' +
        '</div>' +
      '</div>' +
    '</div>';

  $('#shareX').onclick = shareX;
  $('#dlPng').onclick = downloadPng;
  $('#cpLink').onclick = () => { navigator.clipboard.writeText(shareUrl()); toast(T('toast.copy')); };
  $('#again').onclick = () => { $('#ca').value = ''; $('#ca').focus(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  if (yes >= 11) confetti();
}

function renderQuestions() {
  $('#qgrid').innerHTML = QUESTIONS.map(q => {
    const c = S.checks[q.n];
    const a = answerOf(q.n);
    const cls = a === true ? 'yes' : a === false ? 'no' : 'unk';
    const ansTxt = a === true ? T('a.yes') : a === false ? T('a.no') : T('a.unk');
    const overridden = Object.prototype.hasOwnProperty.call(S.overrides, q.n);

    let srcChip;
    if (overridden) srcChip = '<span class="src own">' + (LANG === 'tr' ? 'senin cevabın' : 'your answer') + '</span>';
    else if (c.kind === 'you') srcChip = '<span class="src you">' + T('src.you') + '</span>';
    else if (c.kind === 'guess') srcChip = '<span class="src guess">' + T('src.guess') + '</span>';
    else srcChip = '<span class="src auto">' + T('src.auto') + '</span>';

    const links = [];
    if (c.link) links.push('<a class="src" href="' + esc(c.link) + '" target="_blank" rel="noopener">' + esc(c.linkLabel || 'link') + ' ↗</a>');
    if (c.extraLink) links.push('<a class="src" href="' + esc(c.extraLink) + '" target="_blank" rel="noopener">' + esc(c.extraLabel) + ' ↗</a>');

    let holders = '';
    if (c.holders && c.holders.length) {
      holders = '<div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:-4px">' + c.holders.map(h =>
        '<a class="src addr" href="' + esc(explorerUrl(S.chain, h.addr)) + '" target="_blank" rel="noopener">' +
        esc(short(h.addr)) + ' · ' + h.pct.toFixed(1) + '%</a>').join('') + '</div>';
    }
    /* yogunlasma hesabindan dislanan borsa cuzdanlari */
    if (c.cex && c.cex.length) {
      holders += '<div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:-4px">' + c.cex.map(h => {
        const why = h.seen ? T('cex.seen', { n: h.seen }) : esc(h.name || '');
        return '<a class="src addr" style="background:var(--ink-3);opacity:.8" title="' + esc(why) + '" href="' +
          esc(explorerUrl(S.chain, h.addr)) + '" target="_blank" rel="noopener">🏦 ' +
          esc(h.name || T('cex.label')) + ' · ' + h.pct.toFixed(1) + '%</a>';
      }).join('') + '</div>';
    }
    /* devin onceki tokenleri */
    if (c.prevTokens && c.prevTokens.length) {
      holders += '<div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:-4px">' + c.prevTokens.map(t => {
        const dead = (t.marketCap || 0) < 20000;
        const d = t.createdAt ? new Date(t.createdAt).toLocaleDateString(LANG === 'tr' ? 'tr-TR' : 'en-US', { month: 'short', year: '2-digit' }) : '';
        return '<a class="src addr" style="' + (dead ? 'background:var(--magenta);color:#fff' : 'background:var(--lime);color:#000') + '" href="' +
          esc('https://dexscreener.com/solana/' + t.mint) + '" target="_blank" rel="noopener">' +
          (dead ? '💀 ' : '✅ ') + esc(short(t.mint)) + ' · ' + usd(t.marketCap || 0) + (d ? ' · ' + d : '') + '</a>';
      }).join('') + '</div>';
    }
    /* X profil ozeti */
    if (c.x && c.x.ok) {
      const xj = c.x.joined ? c.x.joined.toLocaleDateString(LANG === 'tr' ? 'tr-TR' : 'en-US', { month: 'short', year: 'numeric' }) : '—';
      holders += '<div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:-4px">' +
        '<span class="src addr">👥 ' + nf(c.x.followers) + '</span>' +
        '<span class="src addr">➡️ ' + nf(c.x.following) + '</span>' +
        (c.x.tweets != null ? '<span class="src addr">✍️ ' + nf(c.x.tweets) + '</span>' : '') +
        '<span class="src addr">📅 ' + esc(xj) + '</span>' +
        (c.x.verified ? '<span class="src" style="background:var(--cyan);color:#000">✔ ' + esc(c.x.vtype || 'verified') + '</span>' : '') +
        '</div>';
    }

    return '<div class="q ' + cls + '" style="animation-delay:' + (q.n * 22) + 'ms">' +
      '<div class="q-top"><span class="q-num">' + q.n + '</span>' +
        '<span class="q-txt">' + esc(q[LANG] || q.tr) + '</span>' +
        '<span class="q-ans ' + cls + '">' + ansTxt + '</span></div>' +
      '<div class="q-note">' + c.note + '</div>' + holders +
      '<div class="q-foot">' + srcChip + links.join('') +
        '<span class="toggle">' +
          '<button data-n="' + q.n + '" data-v="1" class="' + (a === true ? 'on-y' : '') + '">' + T('a.yes') + '</button>' +
          '<button data-n="' + q.n + '" data-v="0" class="' + (a === false ? 'on-n' : '') + '">' + T('a.no') + '</button>' +
        '</span>' +
      '</div>' +
    '</div>';
  }).join('');
  $$('#qgrid .toggle button').forEach(b => b.onclick = () => setAnswer(+b.dataset.n, b.dataset.v === '1'));
}

function renderFlags() {
  const f = S.sec.flags || [];
  const items = f.map(x => {
    const label = x.k ? T(x.k) + (x.v != null ? ' ' + x.v : '') : esc(x.raw || '');
    return '<span class="flag ' + (x.lvl === 'bad' ? 'bad' : 'warn') + '">' + (x.lvl === 'bad' ? '🚨 ' : '⚠️ ') + label + '</span>';
  });
  if (S.D.created && Date.now() - S.D.created < 864e5) items.push('<span class="flag warn">⏱️ ' + T('fl.freshpool') + '</span>');
  if (S.D.liq < 10000) items.push('<span class="flag warn">💧 ' + T('fl.lowliq') + '</span>');
  if (S.D.ghostLiq > 25000 && S.D.ghostLiq > (S.D.liq + S.D.ghostLiq) * 0.25)
    items.push('<span class="flag warn">🫧 ' + T('fl.ghostliq') + ' ' + usd(S.D.ghostLiq) + '</span>');
  if (!items.length) items.push('<span class="flag ok">✅ ' + T('fl.none') + '</span>');
  $('#flags').innerHTML = '<div class="flags"><h3>' + T('fl.title') + '</h3><div class="flag-list">' + items.join('') + '</div></div>';
}

/* ---------------- history ---------------- */
function pushHistory() {
  if (!S) return;
  let h = [];
  try { h = JSON.parse(localStorage.getItem('tk_hist') || '[]'); } catch (e) {}
  h = h.filter(x => !(x.ca === S.ca && x.chain === S.chain));
  h.unshift({ ca: S.ca, chain: S.chain, sym: S.D.sym, score: scoreNow().yes, t: Date.now() });
  localStorage.setItem('tk_hist', JSON.stringify(h.slice(0, 12)));
}
function renderHistory() {
  let h = [];
  try { h = JSON.parse(localStorage.getItem('tk_hist') || '[]'); } catch (e) {}
  if (!h.length) { $('#history').hidden = true; return; }
  $('#history').hidden = false;
  $('#histList').innerHTML = h.map(x => {
    const v = verdictOf(x.score);
    return '<button class="hist" data-ca="' + esc(x.ca) + '" data-ch="' + esc(x.chain) + '">' +
      '<span class="s" style="background:' + v.bg + '">' + x.score + '</span>' + esc(x.sym || short(x.ca)) +
      '<span style="opacity:.5;font-weight:700">' + esc(x.chain) + '</span></button>';
  }).join('');
  $$('#histList .hist').forEach(b => b.onclick = () => { $('#ca').value = b.dataset.ca; run(b.dataset.ca, b.dataset.ch); });
}

/* ---------------- share ---------------- */
function shareUrl() {
  const u = new URL(location.origin + location.pathname);
  u.searchParams.set('ca', S.ca); u.searchParams.set('chain', S.chain);
  return u.toString();
}
function emojiLine() {
  let s = '';
  for (let n = 1; n <= 12; n++) { const a = answerOf(n); s += a === true ? '🟩' : a === false ? '🟥' : '⬜'; }
  return s;
}
function shareX() {
  const { yes } = scoreNow();
  const v = verdictOf(yes);
  const txt = T('share.text', {
    sym: '$' + S.D.sym, score: yes, verdict: T('v.' + v.key), lines: emojiLine()
  });
  window.open('https://twitter.com/intent/tweet?text=' + encodeURIComponent(txt) + '&url=' + encodeURIComponent(shareUrl()), '_blank', 'noopener');
}

/* ---------------- PNG karne ---------------- */
async function downloadPng() {
  try { await document.fonts.ready; } catch (e) {}
  const c = $('#pngCanvas'), x = c.getContext('2d');
  const W = c.width, H = c.height;
  const { yes, unknown } = scoreNow();
  const v = verdictOf(yes);
  const COL = { lime: '#B6FF3C', cyan: '#00F0FF', yellow: '#FFD93D', magenta: '#FF2D9B', ink: '#0A0416', ink2: '#150A2E', cream: '#FFF6E9', black: '#08040F' };
  const vc = { rare: COL.lime, clean: COL.cyan, risky: COL.yellow, skip: COL.magenta }[v.key];

  x.fillStyle = COL.ink; x.fillRect(0, 0, W, H);
  x.fillStyle = 'rgba(168,85,247,.30)'; x.beginPath(); x.arc(W * .9, H * .1, 260, 0, 7); x.fill();
  x.fillStyle = 'rgba(0,240,255,.16)'; x.beginPath(); x.arc(W * .08, H * .95, 240, 0, 7); x.fill();

  x.strokeStyle = COL.black; x.lineWidth = 10;
  x.fillStyle = COL.ink2; x.fillRect(40, 40, W - 80, H - 80); x.strokeRect(40, 40, W - 80, H - 80);

  x.fillStyle = COL.cream;
  x.font = '800 30px "Bricolage Grotesque",sans-serif';
  x.fillText('📋 TOKEN KARNESİ', 76, 108);
  x.font = '800 62px "Bricolage Grotesque",sans-serif';
  x.fillText('$' + (S.D.sym || '').slice(0, 14), 76, 186);
  x.font = '700 24px Manrope,sans-serif'; x.fillStyle = 'rgba(255,246,233,.72)';
  x.fillText(S.chain + '  ·  ' + usd(S.D.liq) + ' ' + T('s.liq').toLowerCase() + '  ·  ' + usd(S.D.vol) + ' ' + T('s.vol').toLowerCase(), 76, 224);

  /* skor kutusu */
  x.fillStyle = vc; x.fillRect(W - 400, 76, 324, 210); x.strokeRect(W - 400, 76, 324, 210);
  x.fillStyle = COL.black; x.textAlign = 'center';
  x.font = '800 128px "Bricolage Grotesque",sans-serif'; x.fillText(String(yes), W - 238, 206);
  x.font = '800 34px "Bricolage Grotesque",sans-serif'; x.fillText('/ 12', W - 238, 252);
  x.textAlign = 'left';

  /* damga */
  x.fillStyle = vc; x.fillRect(76, 262, 300, 78); x.strokeRect(76, 262, 300, 78);
  x.fillStyle = v.key === 'skip' ? '#fff' : COL.black;
  x.font = '800 46px "Bricolage Grotesque",sans-serif';
  x.textAlign = 'center'; x.fillText(T('v.' + v.key), 226, 318); x.textAlign = 'left';

  /* 12 soru satirlari */
  const startY = 384, colW = (W - 160) / 2;
  x.font = '700 21px Manrope,sans-serif'; x.lineWidth = 4;
  QUESTIONS.forEach((q, i) => {
    const a = answerOf(q.n);
    const cx = 76 + (i % 2) * colW, cy = startY + Math.floor(i / 2) * 40;
    x.fillStyle = a === true ? COL.lime : a === false ? COL.magenta : '#3a2a5a';
    x.fillRect(cx, cy - 20, 26, 26); x.strokeStyle = COL.black; x.strokeRect(cx, cy - 20, 26, 26);
    x.fillStyle = COL.black; x.font = '800 17px "Bricolage Grotesque",sans-serif';
    x.textAlign = 'center'; x.fillText(String(q.n), cx + 13, cy - 1); x.textAlign = 'left';
    x.fillStyle = a === null ? 'rgba(255,246,233,.55)' : COL.cream;
    x.font = '700 19px Manrope,sans-serif';
    let t = (q[LANG] || q.tr);
    if (t.length > 44) t = t.slice(0, 43) + '…';
    x.fillText(t, cx + 38, cy);
  });

  x.fillStyle = 'rgba(255,246,233,.6)'; x.font = '700 20px Manrope,sans-serif';
  x.fillText(location.host || 'tokenkarnesi', 76, H - 68);
  x.textAlign = 'right';
  x.fillStyle = COL.yellow;
  x.fillText(unknown ? unknown + ' ' + (LANG === 'tr' ? 'soru cevaplanmadı' : 'unanswered') : (LANG === 'tr' ? '12/12 soru cevaplandı' : 'all 12 answered'), W - 76, H - 68);
  x.textAlign = 'left';

  const a = document.createElement('a');
  a.download = 'karne-' + (S.D.sym || 'token') + '-' + yes + '-12.png';
  a.href = c.toDataURL('image/png');
  a.click();
  toast(T('toast.png'));
}

/* ---------------- confetti ---------------- */
function confetti() {
  if (confetti._done === S.ca) return;
  confetti._done = S.ca;
  const cols = ['#FF2D9B', '#00F0FF', '#B6FF3C', '#FFD93D', '#FF7A1A', '#A855F7'];
  for (let i = 0; i < 70; i++) {
    const d = document.createElement('div');
    d.className = 'confetti';
    d.style.left = Math.random() * 100 + 'vw';
    d.style.background = cols[i % cols.length];
    d.style.animationDuration = (1.6 + Math.random() * 1.6) + 's';
    d.style.animationDelay = (Math.random() * .5) + 's';
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 4000);
  }
}

/* ---------------- static bits ---------------- */
function renderHowCards() {
  const g = $('#howGrid'); if (!g) return;
  const em = ['📋', '🛰️', '🧠', '⚖️'];
  g.innerHTML = [1, 2, 3, 4].map(i =>
    '<div class="how-card"><span class="em">' + em[i - 1] + '</span>' +
    '<h4>' + T('how.c' + i + '.t') + '</h4><p>' + T('how.c' + i + '.d') + '</p></div>').join('');
}
/* landing sayfasindaki 12 soru listesi — hangi soruyu kim cevapliyor */
const HOW_SRC = {
  1: ['auto', 'DexScreener'], 2: ['auto', 'GoPlus · RugCheck'], 3: ['auto', 'GoPlus · RugCheck'],
  4: ['auto', 'GoPlus · RugCheck'], 5: ['auto', 'GoPlus'], 6: ['guess', 'RugCheck · Bubblemaps'],
  7: ['auto', 'RugCheck · GMGN'], 8: ['auto', 'X'], 9: ['guess', 'X · TweetScout'],
  10: ['guess', 'DexScreener'], 11: ['auto', 'DexScreener'], 12: ['you', null]
};
function renderQuestionList() {
  const el = $('#howQuestions'); if (!el) return;
  const cols = ['var(--magenta)', 'var(--cyan)', 'var(--lime)', 'var(--yellow)', 'var(--orange)', 'var(--violet)'];
  el.innerHTML = QUESTIONS.map(q => {
    const [kind, src] = HOW_SRC[q.n];
    const label = src || (LANG === 'tr' ? 'sen' : 'you');
    return '<div class="ql"><span class="n" style="background:' + cols[(q.n - 1) % 6] + '">' + q.n + '</span>' +
      '<span class="t">' + esc(q[LANG] || q.tr) + '</span>' +
      '<span class="s ' + kind + '">' + esc(label) + '</span></div>';
  }).join('');
}

function paintTitle() {
  const el = $('#bigtitle');
  const word = LANG === 'tr' ? 'KARNE' : 'SCORECARD';
  el.innerHTML = word.split('').map((ch, i) => '<span class="c' + ((i % 6) + 1) + '">' + ch + '</span>').join('');
}

/* ---------------- boot ---------------- */
function boot() {
  paintTitle();
  applyLang();
  renderHistory();

  $('#go').onclick = () => run($('#ca').value);
  $('#ca').addEventListener('keydown', e => { if (e.key === 'Enter') run($('#ca').value); });
  $('#ca').addEventListener('paste', () => setTimeout(() => { const v = $('#ca').value.trim(); if (isEvm(v) || isSol(v)) run(v); }, 30));
  $$('.ex').forEach(b => b.onclick = () => { $('#ca').value = b.dataset.ca; run(b.dataset.ca); });
  $('#lang').onclick = () => {
    LANG = LANG === 'tr' ? 'en' : 'tr';
    localStorage.setItem('tk_lang', LANG);
    applyLang();
  };

  const p = new URLSearchParams(location.search);
  const ca = p.get('ca');
  if (ca) { $('#ca').value = ca; run(ca, p.get('chain')); }
}
document.addEventListener('DOMContentLoaded', boot);
