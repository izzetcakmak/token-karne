/* =============================================================
   TOKEN KARNESİ — Arc mainnet: karneyi zincire kaydet
   Contract: 0x3b6BB772b7Ac34d9f7357d6F66867C2c29f2034f (Arc, chain 5042)
   USDC (Arc): 0x3600000000000000000000000000000000000000
   Fee: 0.10 USDC per submitScore (100_000 — 6 decimals)

   Analiz ücretsiz; zincire kayıt ücretli. Kontratın submitScore'u ücreti
   transferFrom ile çeker, o yüzden önce approve, sonra submitScore.
   Sadece "AL" butonu da burada: tokenin zincirine göre dış linke gider.
   ============================================================= */

var ARC_CHAIN = {
  chainId: '0x13B2',                 // 5042
  chainName: 'Arc',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: ['https://rpc.mainnet.arc.io'],
  blockExplorerUrls: ['https://explorer.arc.io']
};
var ARC_RPC       = ARC_CHAIN.rpcUrls[0];
var ARC_EXPLORER  = ARC_CHAIN.blockExplorerUrls[0];
var CONTRACT_ADDR = '0x3b6BB772b7Ac34d9f7357d6F66867C2c29f2034f';
var USDC_ADDR     = '0x3600000000000000000000000000000000000000';
var FEE_FALLBACK  = BigInt('100000'); // 0.10 USDC; asıl değer kontrattan okunur

/* ---- minimal ABI encode ---- */
function arcWord(n) { return BigInt(n).toString(16).padStart(64, '0'); }
function arcAddrWord(a) { return a.replace('0x', '').toLowerCase().padStart(64, '0'); }

var ARC_SEL = {
  approve:     '0x095ea7b3', // approve(address,uint256)
  allowance:   '0xdd62ed3e', // allowance(address,address)
  balanceOf:   '0x70a08231', // balanceOf(address)
  fee:         '0xddca3f43', // fee()
  getScore:    '0xd47875d0', // getScore(address)
  submitScore: '0x76d946c2'  // submitScore(address,uint8[12],uint8)
};

/* submitScore(address tokenCA, uint8[12] scores, uint8 total) — hepsi statik,
   12 cevap art arda 12 kelime olarak gider */
function arcEncodeSubmitScore(tokenKey, scores, total) {
  return ARC_SEL.submitScore + arcAddrWord(tokenKey) + scores.map(arcWord).join('') + arcWord(total);
}

/* Kontrat token'ı 20 baytlık bir adresle anahtarlar. EVM adresi kendisi;
   Solana mint'i 32 bayt olduğundan sha256("solana:" + mint)'in ilk 20 baytı
   kullanılır — okuma ve yazma aynı anahtardan geçer. */
async function arcTokenKey(chain, ca) {
  if (/^0x[0-9a-fA-F]{40}$/.test(ca)) return ca.toLowerCase();
  var bytes = new TextEncoder().encode(chain + ':' + ca);
  var hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return '0x' + Array.from(hash.slice(0, 20)).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
}

/* Okumalar cüzdansız da çalışsın diye doğrudan RPC'ye gider; o cevap
   vermezse cüzdanın sağlayıcısı denenir. */
async function arcEthCall(to, data) {
  try {
    var res = await fetch(ARC_RPC, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: to, data: data }, 'latest'] })
    });
    var j = await res.json();
    if (j.result) return j.result;
  } catch (e) { /* RPC erişilemedi — cüzdana düş */ }
  if (!window.ethereum) return null;
  return await window.ethereum.request({ method: 'eth_call', params: [{ to: to, data: data }, 'latest'] });
}

async function arcReadFee() {
  try {
    var hex = await arcEthCall(CONTRACT_ADDR, ARC_SEL.fee);
    if (hex && hex !== '0x') return BigInt(hex);
  } catch (e) {}
  return FEE_FALLBACK;
}

function usdcFmt(raw) { return (Number(raw) / 1e6).toFixed(2); }

/* ── Cüzdan ─────────────────────────────────────────────────── */
var arcWalletAddr = null;

function arcLang() { return typeof LANG !== 'undefined' ? LANG : 'tr'; }

function detectWallet() {
  var p = window.ethereum;
  if (!p) return { name: 'EVM Cüzdan', icon: '🔗' };
  if (p.isRabby)     return { name: 'Rabby',    icon: '🐰' };
  if (p.isOkxWallet) return { name: 'OKX',      icon: '⭕' };
  if (p.isMetaMask)  return { name: 'MetaMask', icon: '🦊' };
  return { name: 'Cüzdan', icon: '🔗' };
}

async function arcSwitchToArc() {
  try {
    await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: ARC_CHAIN.chainId }] });
  } catch (e) {
    if (e.code === 4902 || (e.data && e.data.originalError && e.data.originalError.code === 4902)) {
      await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [ARC_CHAIN] });
    } else { throw e; }
  }
}

async function arcConnect() {
  if (!window.ethereum) {
    alert(arcLang() === 'tr'
      ? 'EVM cüzdanı bulunamadı. MetaMask, Rabby veya OKX Wallet yükleyin.'
      : 'No EVM wallet found. Please install MetaMask, Rabby or OKX Wallet.');
    return false;
  }
  var accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
  arcWalletAddr = accounts[0];
  await arcSwitchToArc();
  return true;
}

/* tx onaylanana kadar bekle; revert olduysa hata */
async function arcWaitForTx(txHash, maxMs) {
  maxMs = maxMs || 90000;
  var start = Date.now();
  while (Date.now() - start < maxMs) {
    var receipt = await window.ethereum.request({ method: 'eth_getTransactionReceipt', params: [txHash] });
    if (receipt && receipt.status) {
      if (receipt.status === '0x0') throw new Error((arcLang() === 'tr' ? 'İşlem başarısız: ' : 'Transaction failed: ') + txHash);
      return receipt;
    }
    await new Promise(function(r) { setTimeout(r, 1500); });
  }
  throw new Error('Tx timeout');
}

/* ── Zincirdeki skoru oku ───────────────────────────────────── */
async function arcRefreshScore(chain, ca) {
  var scoreBox = document.getElementById('arcChainScore');
  if (!scoreBox) return;
  var tr = arcLang() === 'tr';

  try {
    var key = await arcTokenKey(chain, ca);
    var hex = await arcEthCall(CONTRACT_ADDR, ARC_SEL.getScore + arcAddrWord(key));
    if (!hex || hex === '0x' || /^0x0*$/.test(hex)) {
      scoreBox.innerHTML = '<span class="arc-no-score">' +
        (tr ? 'Bu token için zincirde kayıtlı karne henüz yok.' : 'No scorecard recorded on-chain yet.') +
        '</span>';
      return;
    }
    /* ScoreRecord statik: submitter, 12 cevap, total, timestamp — 15 kelime */
    var raw = hex.slice(2);
    var w = function(i) { return raw.slice(i * 64, i * 64 + 64); };
    var submitter = '0x' + w(0).slice(24);
    var scoresArr = [];
    for (var i = 1; i <= 12; i++) scoresArr.push(parseInt(w(i).slice(56), 16));
    var total = parseInt(w(13).slice(56), 16);
    var ts    = parseInt(w(14), 16) * 1000;
    var dateStr = ts ? new Date(ts).toLocaleString(tr ? 'tr-TR' : 'en-US') : '—';
    var bars = scoresArr.map(function(v) { return '<span class="vb ' + (v === 1 ? 'y' : 'n') + '"></span>'; }).join('');

    scoreBox.innerHTML =
      '<div class="arc-score-card">' +
        '<div class="arc-score-title">⛓️ ' + (tr ? 'Zincirdeki Son Karne' : 'Last On-Chain Scorecard') + '</div>' +
        '<div class="arc-score-num">' + total + '<span>/12</span></div>' +
        '<div class="arc-score-bars">' + bars + '</div>' +
        '<div class="arc-score-meta">' +
          (tr ? 'Kaydeden: ' : 'By: ') +
          '<a href="' + ARC_EXPLORER + '/address/' + submitter + '" target="_blank" rel="noopener">' +
          submitter.slice(0, 6) + '…' + submitter.slice(-4) + '</a>' +
          ' · ' + dateStr +
        '</div>' +
      '</div>';
  } catch (e) {
    console.error('arcRefreshScore:', e);
    scoreBox.innerHTML = '<span class="arc-no-score">' + (tr ? 'Zincir okunamadı.' : 'Could not read the chain.') + '</span>';
  }
}

/* ── Karneyi zincire kaydet (approve + submitScore) ─────────── */
async function arcSaveScore(btn, statusEl) {
  var tr = arcLang() === 'tr';
  function setStatus(msg, err) { statusEl.textContent = msg; statusEl.className = 'arc-pay-status' + (err ? ' err' : ''); }
  function setBtn(txt, disabled) { btn.textContent = txt; btn.disabled = disabled; }
  var label = btn.textContent;

  try {
    if (!S || !S.ca) return;
    var scores = [];
    for (var n = 1; n <= 12; n++) scores.push(answerOf(n) === true ? 1 : 0);
    var total = scores.reduce(function(a, b) { return a + b; }, 0);
    var key = await arcTokenKey(S.chain, S.ca);

    setBtn(tr ? '⏳ Cüzdan bağlanıyor…' : '⏳ Connecting…', true);
    if (!(await arcConnect())) { setBtn(label, false); return; }

    var fee = await arcReadFee();
    var balHex = await arcEthCall(USDC_ADDR, ARC_SEL.balanceOf + arcAddrWord(arcWalletAddr));
    var bal = balHex && balHex !== '0x' ? BigInt(balHex) : 0n;
    if (bal < fee) {
      setStatus((tr ? 'Arc USDC bakiyen yetersiz: ' : 'Not enough USDC on Arc: ') + usdcFmt(bal) + ' / ' + usdcFmt(fee), true);
      setBtn(label, false);
      return;
    }

    var allowHex = await arcEthCall(USDC_ADDR, ARC_SEL.allowance + arcAddrWord(arcWalletAddr) + arcAddrWord(CONTRACT_ADDR));
    var allowance = allowHex && allowHex !== '0x' ? BigInt(allowHex) : 0n;
    if (allowance < fee) {
      setStatus(tr ? '1/2 USDC onayı (approve) bekleniyor…' : '1/2 Waiting for USDC approval…');
      setBtn(tr ? '⏳ Onay…' : '⏳ Approve…', true);
      var approveTx = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [{ from: arcWalletAddr, to: USDC_ADDR, data: ARC_SEL.approve + arcAddrWord(CONTRACT_ADDR) + arcWord(fee) }]
      });
      await arcWaitForTx(approveTx);
    }

    setStatus(tr ? '2/2 Karne gönderiliyor…' : '2/2 Submitting the scorecard…');
    setBtn(tr ? '⏳ Kaydediliyor…' : '⏳ Saving…', true);
    var tx = await window.ethereum.request({
      method: 'eth_sendTransaction',
      params: [{ from: arcWalletAddr, to: CONTRACT_ADDR, data: arcEncodeSubmitScore(key, scores, total) }]
    });
    await arcWaitForTx(tx);

    statusEl.innerHTML = '✅ ' + (tr ? 'Kaydedildi · ' : 'Recorded · ') +
      '<a href="' + ARC_EXPLORER + '/tx/' + tx + '" target="_blank" rel="noopener">tx ↗</a>';
    statusEl.className = 'arc-pay-status';
    setBtn(tr ? '✅ Zincirde' : '✅ On-chain', true);
    arcRefreshScore(S.chain, S.ca);
  } catch (e) {
    console.error('arcSaveScore:', e);
    setStatus(e.code === 4001
      ? (tr ? 'İşlem reddedildi.' : 'Transaction rejected.')
      : (tr ? 'Hata: ' : 'Error: ') + (e.message || String(e)), true);
    setBtn(label, false);
  }
}

/* ── Sonuç altındaki Arc bloğu ──────────────────────────────── */
function arcInjectResultBlock() {
  var box = document.getElementById('arcBlock');
  if (!box || !S) return;
  var tr = arcLang() === 'tr';
  var w = detectWallet();

  box.className = 'arc-block';
  box.innerHTML =
    '<div class="arc-header">' +
      '<span class="arc-logo">⛓️</span>' +
      '<span>' + (tr ? 'Arc — Zincir Kaydı' : 'Arc — On-Chain Record') + '</span>' +
    '</div>' +
    '<div id="arcChainScore" class="arc-chain-score">' +
      '<span class="arc-no-score">' + (tr ? 'Yükleniyor…' : 'Loading…') + '</span>' +
    '</div>' +
    '<button class="arc-save-btn" id="arcSaveBtn">' + w.icon + ' ' +
      (tr ? 'Bu karneyi zincire kaydet · 0.10 USDC' : 'Record this scorecard on-chain · 0.10 USDC') +
    '</button>' +
    '<div id="arcSaveStatus" class="arc-pay-status">' +
      (tr ? 'Ödeme Arc üzerinden USDC ile yapılır; cevapsız sorular 0 sayılır.'
          : 'Paid in USDC on Arc; unanswered questions count as 0.') +
    '</div>';
  box.style.display = '';

  document.getElementById('arcSaveBtn').onclick = function() {
    arcSaveScore(this, document.getElementById('arcSaveStatus'));
  };
  arcRefreshScore(S.chain, S.ca);
}

/* app.js her çizimde render() çağırır; bloğu da o anda tazeleriz, ama
   zinciri sadece token değişince okuruz */
var arcLastKey = null;
document.addEventListener('DOMContentLoaded', function() {
  if (typeof render !== 'function') return;
  var appRender = render;
  render = function() {
    appRender.apply(this, arguments);
    if (!S || !S.ca) return;
    var k = S.chain + ':' + S.ca;
    if (k === arcLastKey) return;
    arcLastKey = k;
    arcInjectResultBlock();
  };

  if (window.ethereum) {
    window.ethereum.request({ method: 'eth_accounts' }).then(function(a) {
      if (a && a[0]) arcWalletAddr = a[0];
    }).catch(function() {});
    window.ethereum.on('accountsChanged', function(a) { arcWalletAddr = a[0] || null; });
  }
});

/* ── AL butonu ──────────────────────────────────────────────── */
/* Site içinde swap yok: Arc tokenleri A NEW ONE'a, Solana tokenleri Jupiter'e,
   diğerleri tokenin DexScreener çiftine gider. (Arc USDC → Solana köprü akışı
   kaldırıldı; Solana tarafında mint adımı yoktu ve alıcı adresi yanlış türetiliyordu.) */
function arcOpenBuyModal(ca, sym, chain) {
  var url;
  if (chain === 'arc') url = anewoneUrl(ca);
  else if (chain === 'solana') url = 'https://jup.ag/swap/USDC-' + encodeURIComponent(ca);
  else if (S && S.D && S.D.best && S.D.best.url) url = S.D.best.url;
  else url = 'https://dexscreener.com/search?q=' + encodeURIComponent(ca);
  window.open(url, '_blank', 'noopener');
}
