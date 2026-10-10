/* =============================================================
   TOKEN KARNESİ — Arc Mainnet onchain entegrasyonu
   Contract: 0x3b6BB772b7Ac34d9f7357d6F66867C2c29f2034f (Arc Mainnet)
   USDC (Arc): 0x3600000000000000000000000000000000000000
   Fee: 0.10 USDC per query (100_000 — 6 decimals)
   ============================================================= */

var ARC_TESTNET = {
  chainId: '0x13B2',
  chainName: 'Arc',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: ['https://rpc.mainnet.arc.io'],
  blockExplorerUrls: ['https://explorer.arc.io']
};

var CONTRACT_ADDR = '0x3b6BB772b7Ac34d9f7357d6F66867C2c29f2034f';
var USDC_ADDR     = '0x3600000000000000000000000000000000000000';
var FEE_RAW       = BigInt('100000'); // 0.10 USDC (6 desimal)

/* ---- minimal ABI encode ---- */
function arcEncodeUint256(n) { return BigInt(n).toString(16).padStart(64, '0'); }
function arcEncodeAddress(a) { return a.replace('0x', '').toLowerCase().padStart(64, '0'); }

function arcEncodeApprove(spender, amount) {
  return '0x095ea7b3' + arcEncodeAddress(spender) + arcEncodeUint256(amount);
}

/* transfer(address to, uint256 amount) — USDC ERC-20 transfer */
function arcEncodeTransfer(to, amount) {
  return '0xa9059cbb' + arcEncodeAddress(to) + arcEncodeUint256(amount);
}

/* getScore(address tokenCA) */
function arcEncodeGetScore(tokenCA) {
  return '0x959e78d5' + arcEncodeAddress(tokenCA);
}

/* allowance(address owner, address spender) */
function arcEncodeAllowance(owner, spender) {
  return '0xdd62ed3e' + arcEncodeAddress(owner) + arcEncodeAddress(spender);
}

/* fee() */
function arcEncodeFee() { return '0xddca3f43'; }

async function arcEthCall(to, data) {
  // Her zaman cüzdan provider'ı üzerinden çağır (CORS sorunu yok)
  if (!window.ethereum) return null;
  return await window.ethereum.request({
    method: 'eth_call',
    params: [{ to: to, data: data }, 'latest']
  });
}

/* ── Cüzdan algılama ────────────────────────────────────────── */
function detectWallet() {
  var p = window.ethereum;
  if (!p) return { name: 'EVM Cüzdan', icon: '🔗' };
  if (p.isRabby)       return { name: 'Rabby',   icon: '🐰' };
  if (p.isOkxWallet)   return { name: 'OKX',     icon: '⭕' };
  if (p.isMetaMask)    return { name: 'MetaMask', icon: '🦊' };
  return { name: 'Cüzdan', icon: '🔗' };
}

/* tx onaylanana kadar bekle — provider üzerinden (CORS yok) */
async function arcWaitForTx(txHash, maxMs) {
  maxMs = maxMs || 60000;
  var start = Date.now();
  while (Date.now() - start < maxMs) {
    var receipt = await window.ethereum.request({
      method: 'eth_getTransactionReceipt',
      params: [txHash]
    });
    if (receipt && receipt.status) return receipt;
    await new Promise(function(r) { setTimeout(r, 1500); });
  }
  throw new Error('Tx timeout');
}

/* ---- cüzdan durumu ---- */
var arcWalletAddr = null;

function arcLang() { return typeof LANG !== 'undefined' ? LANG : 'tr'; }

async function arcSwitchToArc() {
  try {
    await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: ARC_TESTNET.chainId }] });
  } catch (e) {
    if (e.code === 4902) {
      await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [ARC_TESTNET] });
    } else { throw e; }
  }
}

async function arcConnect() {
  if (!window.ethereum) {
    alert(arcLang() === 'tr'
      ? 'EVM cüzdanı bulunamadı. MetaMask, Rabby veya OKX Web3 Wallet yükleyin.'
      : 'No EVM wallet found. Please install MetaMask, Rabby or OKX Web3 Wallet.');
    return false;
  }
  var accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
  arcWalletAddr = accounts[0];
  await arcSwitchToArc();
  return true;
}

/* ---- ödeme modal ---- */
function arcShowPayModal(caValue, onSuccess) {
  // Mevcut modal varsa kaldır
  var old = document.getElementById('arcPayModal');
  if (old) old.remove();

  var tr = arcLang() === 'tr';
  var modal = document.createElement('div');
  modal.id = 'arcPayModal';
  modal.className = 'arc-modal-overlay';
  modal.innerHTML =
    '<div class="arc-modal">' +
      '<div class="arc-modal-header">' +
        '<span>⛓️ ' + (tr ? 'Token Analizi — Ücretli Sorgu' : 'Token Analysis — Paid Query') + '</span>' +
        '<button class="arc-modal-close" id="arcModalClose">✕</button>' +
      '</div>' +
      '<div class="arc-modal-body">' +
        '<p>' + (tr
          ? 'Bu token karnesini görüntülemek için <strong>0.10 USDC</strong> ödemen gerekiyor. Ödeme Arc Testnet üzerinden yapılır ve sonuç zincire kaydedilir.'
          : 'Viewing this scorecard requires a <strong>0.10 USDC</strong> payment on Arc Testnet. The result is recorded on-chain.') + '</p>' +
        '<div class="arc-modal-ca">' + caValue + '</div>' +
        '<div id="arcPayStatus" class="arc-pay-status"></div>' +
      '</div>' +
      '<div class="arc-modal-footer">' +
        '<button id="arcPayBtn" class="arc-pay-btn">' +
          (detectWallet().icon + ' ' + (tr ? 'Cüzdanı Bağla ve 0.10 USDC Öde' : 'Connect Wallet & Pay 0.10 USDC')) +
        '</button>' +
      '</div>' +
    '</div>';

  document.body.appendChild(modal);

  document.getElementById('arcModalClose').onclick = function() { modal.remove(); };
  modal.onclick = function(e) { if (e.target === modal) modal.remove(); };

  document.getElementById('arcPayBtn').onclick = async function() {
    var btn = document.getElementById('arcPayBtn');
    var status = document.getElementById('arcPayStatus');
    var tr2 = arcLang() === 'tr';

    function setStatus(msg, err) {
      if (status) { status.textContent = msg; status.className = 'arc-pay-status' + (err ? ' err' : ''); }
    }
    function setBtn(txt, disabled) {
      if (btn) { btn.textContent = txt; btn.disabled = disabled; }
    }

    try {
      // 1. Cüzdanı bağla
      setBtn(tr2 ? '⏳ Cüzdan bağlanıyor…' : '⏳ Connecting…', true);
      var ok = await arcConnect();
      if (!ok) { setBtn(tr2 ? '🦊 Tekrar Dene' : '🦊 Try Again', false); return; }

      // 2. Ödeme — doğrudan USDC transfer (approve gerekmez)
      setStatus(tr2 ? 'Ödeme gönderiliyor…' : 'Sending payment…');
      setBtn(tr2 ? '⏳ Ödeme bekleniyor…' : '⏳ Waiting for payment…', true);
      var payTx = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [{ from: arcWalletAddr, to: USDC_ADDR, data: arcEncodeTransfer(CONTRACT_ADDR, FEE_RAW), gas: '0x20000' }]
      });
      setStatus(tr2 ? 'İşlem onaylanıyor…' : 'Confirming transaction…');
      await arcWaitForTx(payTx);

      // 4. Başarı
      setStatus(tr2 ? '✅ Ödeme tamamlandı!' : '✅ Payment complete!');
      setBtn(tr2 ? '✅ Analiz başlıyor…' : '✅ Starting analysis…', true);
      await new Promise(function(r) { setTimeout(r, 800); });
      modal.remove();
      onSuccess();
    } catch (e) {
      console.error('arcPayModal hata:', e);
      if (e.code === 4001) {
        setStatus(tr2 ? 'İşlem reddedildi.' : 'Transaction rejected.', true);
      } else {
        setStatus((tr2 ? 'Hata: ' : 'Error: ') + (e.message || String(e)), true);
      }
      setBtn(tr2 ? '🦊 Tekrar Dene' : '🦊 Try Again', false);
    }
  };
}

/* ---- zincirdeki skoru oku ve Arc bloğunu doldur ---- */
async function arcRefreshScore(ca) {
  var scoreBox = document.getElementById('arcChainScore');
  if (!scoreBox) return;
  var tr = arcLang() === 'tr';

  var hex = await arcEthCall(CONTRACT_ADDR, arcEncodeGetScore(ca));
  if (!hex || hex === '0x' || hex.replace('0x', '').replace(/0/g, '') === '') {
    scoreBox.innerHTML = '<span class="arc-no-score">' +
      (tr ? 'Bu token için zincirde kayıtlı skor henüz yok.' : 'No on-chain score recorded yet.') +
      '</span>';
    return;
  }

  try {
    var raw = hex.startsWith('0x') ? hex.slice(2) : hex;
    var submitter = '0x' + raw.slice(24, 64);
    var scoresArr = [];
    for (var i = 0; i < 12; i++) {
      scoresArr.push(parseInt(raw.slice(64 + i * 64 + 56, 64 + i * 64 + 64), 16));
    }
    var total   = parseInt(raw.slice(64 + 12 * 64 + 56, 64 + 12 * 64 + 64), 16);
    var tsHex   = raw.slice(64 + 13 * 64, 64 + 14 * 64);
    var ts      = parseInt(tsHex, 16) * 1000;
    var dateStr = ts ? new Date(ts).toLocaleString(tr ? 'tr-TR' : 'en-US') : '—';
    var bars    = scoresArr.map(function(v) {
      return '<span class="vb ' + (v === 1 ? 'y' : 'n') + '"></span>';
    }).join('');

    scoreBox.innerHTML =
      '<div class="arc-score-card">' +
        '<div class="arc-score-title">⛓️ ' + (tr ? 'Zincirdeki Son Skor' : 'On-Chain Score') + '</div>' +
        '<div class="arc-score-num">' + total + '<span>/12</span></div>' +
        '<div class="arc-score-bars">' + bars + '</div>' +
        '<div class="arc-score-meta">' +
          (tr ? 'Kaydeden: ' : 'By: ') +
          '<a href="https://explorer.arc.io/address/' + submitter + '" target="_blank" rel="noopener">' +
          submitter.slice(0, 6) + '…' + submitter.slice(-4) + '</a>' +
          ' · ' + dateStr +
        '</div>' +
      '</div>';
  } catch (e) {
    scoreBox.innerHTML = '<span class="arc-no-score">' + (tr ? 'Skor okunamadı.' : 'Could not read score.') + '</span>';
  }
}

/* ---- Arc sonuç bloğunu göster ---- */
function arcInjectResultBlock(ca) {
  var box = document.getElementById('arcBlock');
  if (!box) return;
  var tr = arcLang() === 'tr';

  box.className = 'arc-block';
  box.innerHTML =
    '<div class="arc-header">' +
      '<span class="arc-logo">⛓️</span>' +
      '<span>' + (tr ? 'Arc Testnet — Zincir Kaydı' : 'Arc Testnet — On-Chain Record') + '</span>' +
    '</div>' +
    '<div id="arcChainScore" class="arc-chain-score">' +
      '<span class="arc-no-score">' + (tr ? 'Yükleniyor…' : 'Loading…') + '</span>' +
    '</div>';

  box.style.display = '';
  arcRefreshScore(ca);
}

/* ---- boot: run() fonksiyonunu ücretli akışla intercept et ---- */
document.addEventListener('DOMContentLoaded', function () {

  // app.js boot() sonrası çalışmalıyız — kısa delay
  setTimeout(function() {
    var goBtn = document.getElementById('go');
    var caInput = document.getElementById('ca');
    if (!goBtn || !caInput) return;

    function arcInterceptRun(caRaw, forcedChain) {
      var ca = String(caRaw || '').trim();
      if (!ca) return;
      // Ödeme modalını göster, başarıda orijinal run() çağır
      arcShowPayModal(ca, function() {
        if (typeof run === 'function') {
          run(ca, forcedChain);
        }
      });
    }

    // #go onclick override
    goBtn.onclick = function() { arcInterceptRun(caInput.value); };

    // Enter ve paste override
    caInput.removeEventListener('keydown', caInput._arcKd);
    caInput._arcKd = function(e) {
      if (e.key === 'Enter') arcInterceptRun(caInput.value);
    };
    caInput.addEventListener('keydown', caInput._arcKd);

    caInput.removeEventListener('paste', caInput._arcPaste);
    caInput._arcPaste = function() {
      setTimeout(function() {
        var v = caInput.value.trim();
        if (v) arcInterceptRun(v);
      }, 30);
    };
    caInput.addEventListener('paste', caInput._arcPaste);

    // .ex örnek tokenler
    document.querySelectorAll('.ex').forEach(function(b) {
      b.onclick = function() {
        caInput.value = b.dataset.ca;
        arcInterceptRun(b.dataset.ca);
      };
    });

    // URL'den gelen CA (sayfa yüklenince otomatik)
    // app.js zaten run() çağırıyor — URL'den gelen için intercept etmiyoruz
    // çünkü onları da ücretli yapmak istersen bu kısmı aç:
    /*
    var p = new URLSearchParams(location.search);
    var urlCa = p.get('ca');
    if (urlCa) arcInterceptRun(urlCa, p.get('chain'));
    */

  }, 200);

  // Sonuç göründüğünde Arc bloğunu doldur
  var lastResultCa = null;
  setInterval(function() {
    var resultEl = document.getElementById('result');
    if (!resultEl || resultEl.hidden) return;
    if (typeof S === 'undefined' || !S || !S.ca) return;
    if (S.ca === lastResultCa) return;
    lastResultCa = S.ca;
    arcInjectResultBlock(S.ca);
  }, 400);

  // Cüzdan değişimleri
  if (window.ethereum) {
    window.ethereum.request({ method: 'eth_accounts' }).then(function(accounts) {
      if (accounts && accounts[0]) arcWalletAddr = accounts[0];
    }).catch(function(){});

    window.ethereum.on('accountsChanged', function(accounts) {
      arcWalletAddr = accounts[0] || null;
    });
  }
});

/* ============================================================
   arcOpenBuy — AL butonu
   Arc zinciri → swap modal (yakında)
   Diğer zincirler → DexScreener buy linki
   ============================================================ */
function arcOpenBuy(ca, chain, sym, dexUrl) {
  var tr = (typeof LANG !== 'undefined' && LANG === 'tr');
  var isArc = (chain === 'arc' || chain === 'arc-testnet' || chain === 'arc_testnet');

  if (isArc) {
    // Arc swap modal — cüzdan bağlı değilse önce bağla
    arcShowSwapModal(ca, sym);
  } else {
    // Diğer zincirler: DexScreener buy linkine yönlendir
    var url = dexUrl || ('https://dexscreener.com/search?q=' + encodeURIComponent(ca));
    window.open(url, '_blank', 'noopener');
  }
}

/* Arc swap modal */
function arcShowSwapModal(ca, sym) {
  var tr = (typeof LANG !== 'undefined' && LANG === 'tr');
  var existing = document.getElementById('arcSwapModal');
  if (existing) existing.remove();

  var modal = document.createElement('div');
  modal.id = 'arcSwapModal';
  modal.className = 'arc-modal-overlay';
  modal.innerHTML =
    '<div class="arc-modal">' +
      '<div class="arc-modal-header">' +
        '<span>⛓️ ' + (tr ? 'Arc\'ta Satın Al' : 'Buy on Arc') + '</span>' +
        '<button class="arc-modal-close" id="arcSwapClose">✕</button>' +
      '</div>' +
      '<div class="arc-modal-body">' +
        '<p>' + (tr
          ? 'Arc Testnet üzerinde <b>' + esc2(sym) + '</b> satın almak için cüzdanını bağla ve USDC ile işlem yap.'
          : 'Connect your wallet to buy <b>' + esc2(sym) + '</b> on Arc Testnet using USDC.') + '</p>' +
        '<div class="arc-modal-ca">' + esc2(ca) + '</div>' +
        '<div id="arcSwapStatus" class="arc-pay-status"></div>' +
      '</div>' +
      '<div class="arc-modal-footer" style="display:flex;gap:.5rem;flex-wrap:wrap">' +
        '<button class="arc-pay-btn" id="arcSwapConnectBtn" style="flex:1">' +
          (detectWallet().icon + ' ' + (tr ? 'Cüzdan Bağla' : 'Connect Wallet')) +
        '</button>' +
        '<a class="arc-pay-btn" id="arcSwapDexBtn" href="https://dexscreener.com/search?q=' + encodeURIComponent(ca) + '" target="_blank" rel="noopener" style="flex:1;text-align:center;text-decoration:none;display:block">' +
          '📈 DexScreener' +
        '</a>' +
      '</div>' +
    '</div>';

  document.body.appendChild(modal);

  document.getElementById('arcSwapClose').onclick = function() { modal.remove(); };
  modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });

  var connectBtn = document.getElementById('arcSwapConnectBtn');
  var statusEl = document.getElementById('arcSwapStatus');

  // Zaten bağlıysa düğmeyi güncelle
  if (arcWalletAddr) {
    connectBtn.textContent = arcWalletAddr.slice(0,6) + '…' + arcWalletAddr.slice(-4);
    connectBtn.disabled = true;
    statusEl.textContent = tr ? '✅ Cüzdan bağlı. Swap özelliği yakında!' : '✅ Wallet connected. Swap coming soon!';
  }

  connectBtn.onclick = async function() {
    if (arcWalletAddr) return;
    try {
      var ok = await arcConnect();
      if (ok) {
        connectBtn.textContent = arcWalletAddr.slice(0,6) + '…' + arcWalletAddr.slice(-4);
        connectBtn.disabled = true;
        statusEl.textContent = tr ? '✅ Cüzdan bağlı. Swap özelliği yakında!' : '✅ Wallet connected. Swap coming soon!';
      }
    } catch(e) {
      statusEl.textContent = tr ? 'Bağlantı başarısız.' : 'Connection failed.';
    }
  };
}

function esc2(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
