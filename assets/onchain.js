/* =============================================================
   TOKEN KARNESİ — Arc Testnet onchain entegrasyonu
   Contract: 0x65ab5145236b7a34377ae700d4de8b2aac6d2bdd (Arc Testnet)
   USDC (Arc Testnet): 0x3600000000000000000000000000000000000000
   Fee: 0.10 USDC (100_000 — 6 desimal)
   ============================================================= */
'use strict';

const ARC_TESTNET = {
  chainId: '0x4CEF52',        // 5042002
  chainName: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: ['https://rpc.testnet.arc.io'],
  blockExplorerUrls: ['https://explorer.testnet.arc.io']
};

const CONTRACT_ADDR = '0x65ab5145236b7a34377ae700d4de8b2aac6d2bdd';
const USDC_ADDR     = '0x3600000000000000000000000000000000000000';
const FEE_RAW       = 100_000n;   // 0.10 USDC (6 desimal)

/* ---- minimal ABI encode (approve + submitScore + getScore) ---- */
function encodeUint256(n) { return BigInt(n).toString(16).padStart(64, '0'); }
function encodeAddress(a) { return a.replace('0x', '').toLowerCase().padStart(64, '0'); }
function encodeUint8(n)   { return Number(n).toString(16).padStart(64, '0'); }

/* approve(address spender, uint256 amount) */
function encodeApprove(spender, amount) {
  return '0x095ea7b3' + encodeAddress(spender) + encodeUint256(amount);
}

/* submitScore(address tokenCA, uint8[12] _scores, uint8 _total)
   ABI: (address, uint8[12], uint8) — uint8[12] fixed array, no offset needed */
function encodeSubmitScore(tokenCA, scores, total) {
  const sel = 'bf8b79cb'; // keccak4 of submitScore(address,uint8[12],uint8)
  let data = '0x' + sel;
  data += encodeAddress(tokenCA);
  for (let i = 0; i < 12; i++) data += encodeUint8(scores[i] || 0);
  data += encodeUint8(total);
  return data;
}

/* getScore(address tokenCA) -> ScoreRecord */
function encodeGetScore(tokenCA) {
  return '0x959e78d5' + encodeAddress(tokenCA); // keccak4 of getScore(address)
}

/* allowance(address owner, address spender) */
function encodeAllowance(owner, spender) {
  return '0xdd62ed3e' + encodeAddress(owner) + encodeAddress(spender);
}

async function ethCall(to, data) {
  const res = await fetch('https://rpc.testnet.arc.io', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to, data }, 'latest'] })
  });
  const j = await res.json();
  return j.result || null;
}

/* ---- cüzdan durumu ---- */
let walletAddr = null;

function updateWalletUI() {
  const btn = document.getElementById('arcWalletBtn');
  const status = document.getElementById('arcStatus');
  if (!btn) return;
  if (walletAddr) {
    btn.textContent = walletAddr.slice(0, 6) + '…' + walletAddr.slice(-4);
    btn.classList.add('connected');
    if (status) status.hidden = true;
  } else {
    btn.textContent = LANG === 'tr' ? '🦊 Cüzdan Bağla' : '🦊 Connect Wallet';
    btn.classList.remove('connected');
  }
}

async function switchToArc() {
  try {
    await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: ARC_TESTNET.chainId }] });
  } catch (e) {
    if (e.code === 4902) {
      await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [ARC_TESTNET] });
    } else throw e;
  }
}

async function connectWallet() {
  if (!window.ethereum) {
    alert(LANG === 'tr'
      ? 'MetaMask veya EVM uyumlu bir cüzdan bulunamadı.'
      : 'No EVM wallet found. Please install MetaMask.');
    return;
  }
  try {
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    walletAddr = accounts[0];
    await switchToArc();
    updateWalletUI();
    if (window.S) await refreshChainScore();
  } catch (e) {
    console.error('Cüzdan bağlantısı başarısız:', e);
  }
}

/* ---- zincirdeki skoru oku ---- */
async function refreshChainScore() {
  const scoreBox = document.getElementById('arcChainScore');
  if (!scoreBox || !window.S) return;

  const hex = await ethCall(CONTRACT_ADDR, encodeGetScore(S.ca));
  if (!hex || hex === '0x') {
    scoreBox.innerHTML = '<span class="arc-no-score">' +
      (LANG === 'tr' ? 'Bu token için zincirde kayıtlı skor yok.' : 'No on-chain score recorded for this token.') +
      '</span>';
    return;
  }

  // ScoreRecord: submitter(32) + scores[12](32*12) + total(32) + timestamp(32)
  try {
    const raw = hex.startsWith('0x') ? hex.slice(2) : hex;
    const submitter = '0x' + raw.slice(24, 64);
    const scoresArr = [];
    for (let i = 0; i < 12; i++) {
      scoresArr.push(parseInt(raw.slice(64 + i * 64 + 56, 64 + i * 64 + 64), 16));
    }
    const total     = parseInt(raw.slice(64 + 12 * 64 + 56, 64 + 12 * 64 + 64), 16);
    const tsHex     = raw.slice(64 + 13 * 64, 64 + 14 * 64);
    const ts        = parseInt(tsHex, 16) * 1000;
    const dateStr   = ts ? new Date(ts).toLocaleString(LANG === 'tr' ? 'tr-TR' : 'en-US') : '—';

    const bars = scoresArr.map(v =>
      '<span class="vb ' + (v === 1 ? 'y' : 'n') + '"></span>'
    ).join('');

    scoreBox.innerHTML =
      '<div class="arc-score-card">' +
        '<div class="arc-score-title">⛓️ ' + (LANG === 'tr' ? 'Zincirdeki Son Skor' : 'On-Chain Score') + '</div>' +
        '<div class="arc-score-num">' + total + '<span>/12</span></div>' +
        '<div class="arc-score-bars">' + bars + '</div>' +
        '<div class="arc-score-meta">' +
          (LANG === 'tr' ? 'Kaydeden: ' : 'By: ') +
          '<a href="https://explorer.testnet.arc.io/address/' + submitter + '" target="_blank" rel="noopener">' +
          submitter.slice(0, 6) + '…' + submitter.slice(-4) + '</a>' +
          ' · ' + dateStr +
        '</div>' +
      '</div>';
  } catch (e) {
    scoreBox.innerHTML = '<span class="arc-no-score">Skor okunamadı.</span>';
  }
}

/* ---- skoru zincire kaydet ---- */
async function saveScoreOnChain() {
  if (!window.ethereum) {
    alert(LANG === 'tr' ? 'Önce bir cüzdan bağla.' : 'Connect a wallet first.');
    return;
  }
  if (!walletAddr) { await connectWallet(); if (!walletAddr) return; }
  if (!window.S) return;

  // mevcut skorları al
  const scores = [];
  let total = 0;
  for (let n = 1; n <= 12; n++) {
    const a = answerOf(n);
    const v = a === true ? 1 : 0;
    scores.push(v);
    if (a === true) total++;
  }

  const saveBtn = document.getElementById('arcSaveBtn');
  const setLoading = (on) => {
    if (!saveBtn) return;
    saveBtn.disabled = on;
    saveBtn.textContent = on
      ? (LANG === 'tr' ? '⏳ İşleniyor…' : '⏳ Processing…')
      : (LANG === 'tr' ? '⛓️ Skoru Zincire Kaydet (0.10 USDC)' : '⛓️ Save Score On-Chain (0.10 USDC)');
  };

  try {
    setLoading(true);
    await switchToArc();

    // allowance kontrolü
    const allowHex = await ethCall(USDC_ADDR, encodeAllowance(walletAddr, CONTRACT_ADDR));
    const allowance = allowHex ? BigInt('0x' + allowHex.replace('0x', '').padStart(64, '0').slice(-64)) : 0n;

    if (allowance < FEE_RAW) {
      // approve
      const approveTx = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [{
          from: walletAddr,
          to: USDC_ADDR,
          data: encodeApprove(CONTRACT_ADDR, FEE_RAW),
          gas: '0x10000'
        }]
      });
      // onay bekle
      await waitForTx(approveTx);
    }

    // submitScore
    const tx = await window.ethereum.request({
      method: 'eth_sendTransaction',
      params: [{
        from: walletAddr,
        to: CONTRACT_ADDR,
        data: encodeSubmitScore(S.ca, scores, total),
        gas: '0x30000'
      }]
    });

    await waitForTx(tx);

    if (typeof toast === 'function') {
      toast(LANG === 'tr' ? '✅ Skor zincire kaydedildi!' : '✅ Score saved on-chain!');
    }
    await refreshChainScore();
  } catch (e) {
    console.error('submitScore hatası:', e);
    if (e.code !== 4001) { // 4001 = kullanıcı reddetti
      alert(LANG === 'tr'
        ? 'İşlem başarısız: ' + (e.message || e)
        : 'Transaction failed: ' + (e.message || e));
    }
  } finally {
    setLoading(false);
  }
}

/* tx onaylanana kadar bekle (polling) */
async function waitForTx(txHash, maxMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const res = await fetch('https://rpc.testnet.arc.io', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getTransactionReceipt', params: [txHash] })
    });
    const j = await res.json();
    if (j.result && j.result.status) return j.result;
    await new Promise(r => setTimeout(r, 1500));
  }
  throw new Error('Tx timeout');
}

/* ---- Arc UI bloğu result bölümünde göster/doldur ---- */
function injectArcUI() {
  const box = document.getElementById('arcBlock');
  if (!box) return;

  // İçeriği sadece bir kez oluştur
  if (!box.querySelector('.arc-header')) {
    box.className = 'arc-block';
    box.innerHTML =
      '<div class="arc-header">' +
        '<span class="arc-logo">⛓️</span>' +
        '<span>' + (LANG === 'tr' ? 'Arc Testnet — Zincir Entegrasyonu' : 'Arc Testnet — On-Chain') + '</span>' +
        '<button id="arcWalletBtn" class="arc-wallet-btn">' +
          (LANG === 'tr' ? '🦊 Cüzdan Bağla' : '🦊 Connect Wallet') +
        '</button>' +
      '</div>' +
      '<div id="arcStatus" class="arc-status">' +
        (LANG === 'tr'
          ? 'Karne sonucunu Arc Testnet\'e kaydetmek için 0.10 USDC öde. Kayıt kalıcıdır ve herkes okuyabilir.'
          : 'Pay 0.10 USDC to permanently record this scorecard on Arc Testnet. Anyone can read it.') +
      '</div>' +
      '<div id="arcChainScore" class="arc-chain-score"></div>' +
      '<button id="arcSaveBtn" class="arc-save-btn">' +
        (LANG === 'tr' ? '⛓️ Skoru Zincire Kaydet (0.10 USDC)' : '⛓️ Save Score On-Chain (0.10 USDC)') +
      '</button>';

    document.getElementById('arcWalletBtn').onclick = connectWallet;
    document.getElementById('arcSaveBtn').onclick = saveScoreOnChain;
  }

  box.style.display = '';
  updateWalletUI();
  refreshChainScore();
}

/* ---- boot ---- */
document.addEventListener('DOMContentLoaded', function () {

  // #flags dolduğunda (render() sonrası) Arc bloğunu göster
  let lastFlagsHtml = '';
  setInterval(function () {
    const resultEl = document.getElementById('result');
    if (!resultEl || resultEl.hidden) return;
    const flagsEl = document.getElementById('flags');
    const nowHtml = flagsEl ? flagsEl.innerHTML : '';
    if (nowHtml && nowHtml !== lastFlagsHtml) {
      lastFlagsHtml = nowHtml;
      const box = document.getElementById('arcBlock');
      if (box) box.innerHTML = ''; // yeniden oluştur
      injectArcUI();
    }
  }, 400);

  // Zaten bağlı cüzdan varsa al
  if (window.ethereum) {
    window.ethereum.request({ method: 'eth_accounts' }).then(accounts => {
      if (accounts && accounts[0]) {
        walletAddr = accounts[0];
        updateWalletUI();
      }
    }).catch(() => {});

    window.ethereum.on('accountsChanged', accounts => {
      walletAddr = accounts[0] || null;
      updateWalletUI();
      if (window.S) refreshChainScore();
    });

    window.ethereum.on('chainChanged', () => {
      if (window.S) refreshChainScore();
    });
  }
});
