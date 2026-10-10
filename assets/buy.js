/* =============================================================
   TOKEN KARNESİ — Arc→Solana Buy Akışı
   1. Arc USDC bakiyesi kontrol
   2. Miktar seçimi ($10 / $50 / $100 / manuel)
   3. CCTP v2: Arc → Solana USDC bridge
   4. Jupiter Ultra: Solana USDC → token swap
   5. Token MetaMask Solana hesabına otomatik düşer
   ============================================================= */

'use strict';

function detectBuyWallet() {
  var p = window.ethereum;
  if (!p) return { name: 'Cüzdan', icon: '🔗' };
  if (p.isRabby)     return { name: 'Rabby',   icon: '🐰' };
  if (p.isOkxWallet) return { name: 'OKX',     icon: '⭕' };
  if (p.isMetaMask)  return { name: 'MetaMask', icon: '🦊' };
  return { name: 'Cüzdan', icon: '🔗' };
}

// ── Sabitler (ARC MAINNET) ─────────────────────────────────────
var ARC_CHAIN_ID = '0x13B2'; // Arc Mainnet: 5050
var ARC_RPC = 'https://rpc.mainnet.arc.network';
var ARC_EXPLORER = 'https://explorer.arc.io';
var ARC_USDC = '0x3600000000000000000000000000000000000000';
var ARC_TOKEN_MESSENGER_V2 = '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d';
var ARC_MESSAGE_TRANSMITTER_V2 = '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64';
var ARC_DOMAIN = 26;
var SOLANA_MAINNET_DOMAIN = 5;
var SOLANA_USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
var IRIS_API = 'https://iris-api.circle.com';
var JUPITER_PROXY = '/api/jupiter';
var USDC_DECIMALS_ERC20 = 6;

// ── ABI parçaları ─────────────────────────────────────────────
var ERC20_ABI_FRAGMENTS = [
  'function balanceOf(address) view returns (uint256)',
  'function approve(address,uint256) returns (bool)',
  'function allowance(address,address) view returns (uint256)',
];
var TOKEN_MESSENGER_V2_ABI = [
  'function depositForBurn(uint256 amount,uint32 destinationDomain,bytes32 mintRecipient,address burnToken,bytes32 destinationCaller,uint256 maxFee,uint32 minFinalityThreshold)',
];
var MESSAGE_TRANSMITTER_V2_ABI = [
  'function receiveMessage(bytes message,bytes attestation)',
];

// ── Yardımcı: hex encode ──────────────────────────────────────
function encodeERC20BalanceOf(addr) {
  var sig = '0x70a08231';
  var padded = addr.toLowerCase().replace('0x', '').padStart(64, '0');
  return sig + padded;
}
function encodeERC20Approve(spender, amount) {
  var sig = '0x095ea7b3';
  var sp = spender.toLowerCase().replace('0x', '').padStart(64, '0');
  var am = BigInt(amount).toString(16).padStart(64, '0');
  return sig + sp + am;
}
function encodeDepositForBurn(amount, destDomain, mintRecipient, burnToken, destCaller, maxFee, minFinality) {
  var sig = '0x44a8c2df';
  function p256(v) { return BigInt(v).toString(16).padStart(64, '0'); }
  function pb32(v) {
    var hex = v.replace('0x', '');
    if (hex.length < 64) hex = hex.padStart(64, '0');
    return hex.slice(0, 64);
  }
  return sig
    + p256(amount)
    + p256(destDomain)
    + pb32(mintRecipient)
    + pb32(burnToken.replace('0x', '').padStart(64, '0'))
    + pb32(destCaller)
    + p256(maxFee)
    + p256(minFinality);
}

// ── Yardımcı: eth_call — cüzdan provider üzerinden (CORS yok) ─
async function arcCall(to, data) {
  if (!window.ethereum) throw new Error('Cüzdan bulunamadı');
  return await window.ethereum.request({
    method: 'eth_call',
    params: [{ to: to, data: data }, 'latest']
  });
}

// ── Yardımcı: Solana adresi → bytes32 ────────────────────────
function solanaAddressToBytes32(solanaAddress) {
  // Base58 decode → 32 bytes → bytes32 hex
  var ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  var bigInt = BigInt(0);
  for (var i = 0; i < solanaAddress.length; i++) {
    bigInt = bigInt * BigInt(58) + BigInt(ALPHABET.indexOf(solanaAddress[i]));
  }
  var hex = bigInt.toString(16).padStart(64, '0');
  return '0x' + hex;
}

// ── Buy Modal HTML ────────────────────────────────────────────
function createBuyModal(tokenCA, tokenSymbol, chain, solanaCA) {
  var existing = document.getElementById('arcBuyModal');
  if (existing) existing.remove();

  var modal = document.createElement('div');
  modal.id = 'arcBuyModal';
  modal.className = 'arc-buy-modal-overlay';
  modal.innerHTML = `
    <div class="arc-buy-modal">
      <button class="arc-buy-close" id="arcBuyClose">✕</button>
      <div class="arc-buy-header">
        <span class="arc-buy-logo">◎</span>
        <div>
          <div class="arc-buy-title">${esc2(tokenSymbol)} Satın Al</div>
          <div class="arc-buy-subtitle">Arc USDC → Solana swap</div>
        </div>
      </div>

      <div id="arcBuySteps">
        <!-- Adım 1: Cüzdan bağla + bakiye -->
        <div id="arcBuyStep1">
          <div class="arc-buy-info">Arc Testnet USDC bakiyeniz kullanılarak Solana ağında <strong>${esc2(tokenSymbol)}</strong> satın alınacak.</div>
          <button class="arc-buy-btn" id="arcBuyConnectBtn" id="arcBuyConnectBtn">🔗 Cüzdan Bağla</button>
          <div id="arcBuyBalance" class="arc-buy-balance" style="display:none"></div>
          <div id="arcBuyAmountSection" style="display:none">
            <div class="arc-buy-label">Ne kadar harcamak istiyorsunuz?</div>
            <div class="arc-buy-presets">
              <button class="arc-buy-preset" data-amount="10">$10</button>
              <button class="arc-buy-preset" data-amount="50">$50</button>
              <button class="arc-buy-preset" data-amount="100">$100</button>
            </div>
            <div class="arc-buy-custom-row">
              <span class="arc-buy-currency">$</span>
              <input type="number" id="arcBuyCustomAmount" class="arc-buy-custom-input" placeholder="Manuel giriş..." min="1" max="10000" step="1" />
            </div>
            <div id="arcBuyQuote" class="arc-buy-quote" style="display:none"></div>
            <button class="arc-buy-btn arc-buy-btn-green" id="arcBuyConfirmBtn" style="display:none">🚀 Onayla ve Satın Al</button>
          </div>
        </div>

        <!-- Adım 2: İşlem durumu -->
        <div id="arcBuyStep2" style="display:none">
          <div class="arc-buy-steps-list" id="arcBuyStepsList"></div>
        </div>

        <!-- Adım 3: Tamamlandı -->
        <div id="arcBuyStep3" style="display:none">
          <div class="arc-buy-success">✅ Satın alma tamamlandı!</div>
          <div id="arcBuySuccessDetails" class="arc-buy-success-details"></div>
          <button class="arc-buy-btn" onclick="document.getElementById('arcBuyModal').remove()">Kapat</button>
        </div>

        <!-- Hata -->
        <div id="arcBuyError" style="display:none" class="arc-buy-error"></div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  // Kapat
  document.getElementById('arcBuyClose').onclick = function() { modal.remove(); };
  modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });

  // State
  var state = {
    walletAddr: null,
    solanaAddr: null,
    usdcBalance: 0n,
    selectedAmount: 0,
    quoteData: null,
    tokenCA: tokenCA,
    tokenSymbol: tokenSymbol,
    chain: chain,
    solanaCA: solanaCA,
  };

  // Cüzdan bağla
  document.getElementById('arcBuyConnectBtn').onclick = async function() {
    await connectAndLoadBalance(state);
  };

  // Preset butonları
  modal.querySelectorAll('.arc-buy-preset').forEach(function(btn) {
    btn.onclick = async function() {
      modal.querySelectorAll('.arc-buy-preset').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      document.getElementById('arcBuyCustomAmount').value = '';
      state.selectedAmount = parseFloat(btn.dataset.amount);
      await loadQuote(state);
    };
  });

  // Manuel giriş
  var customInput = document.getElementById('arcBuyCustomAmount');
  var quoteTimer = null;
  customInput.oninput = function() {
    modal.querySelectorAll('.arc-buy-preset').forEach(function(b) { b.classList.remove('active'); });
    var val = parseFloat(customInput.value);
    if (val > 0) {
      state.selectedAmount = val;
      clearTimeout(quoteTimer);
      quoteTimer = setTimeout(function() { loadQuote(state); }, 800);
    } else {
      state.selectedAmount = 0;
      document.getElementById('arcBuyConfirmBtn').style.display = 'none';
      document.getElementById('arcBuyQuote').style.display = 'none';
    }
  };

  // Onayla
  document.getElementById('arcBuyConfirmBtn').onclick = async function() {
    await executeBuy(state);
  };

  return modal;
}

// ── Cüzdan bağla + bakiye yükle ───────────────────────────────
async function connectAndLoadBalance(state) {
  var connectBtn = document.getElementById('arcBuyConnectBtn');
  if (!window.ethereum) {
    showBuyError('EVM cüzdanı bulunamadı. MetaMask, Rabby veya OKX Web3 Wallet yükleyin.');
    return;
  }
  // Buton metnini cüzdana göre güncelle
  var wInfo = detectBuyWallet();
  connectBtn.textContent = wInfo.icon + ' ' + wInfo.name + ' ile Bağlan';
  connectBtn.disabled = true;
  connectBtn.textContent = 'Bağlanıyor...';
  try {
    // EVM hesabı al
    var accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    if (!accounts || !accounts[0]) throw new Error('Hesap bulunamadı');
    state.walletAddr = accounts[0];

    // Arc Mainnet'e geç
    var arcChainParams = {
      chainId: ARC_CHAIN_ID,
      chainName: 'Arc',
      rpcUrls: [ARC_RPC],
      nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
      blockExplorerUrls: [ARC_EXPLORER],
    };
    // Önce switch dene — zaten ekliyse çalışır
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: ARC_CHAIN_ID }],
      });
    } catch (swErr) {
      // Bilinmeyen chain (4902) veya unrecognized — ağı ekle
      if (swErr.code === 4902 || (swErr.message && (swErr.message.includes('4902') || swErr.message.toLowerCase().includes('unrecognized') || swErr.message.toLowerCase().includes('not been added')))) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [arcChainParams],
        });
        // Ekledikten sonra tekrar switch
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: ARC_CHAIN_ID }],
        });
      } else { throw swErr; }
    }

    // Solana hesabı al — sadece MetaMask multichain destekliyorsa
    try {
      var solAddr = await getSolanaAddress(window.ethereum);
      state.solanaAddr = solAddr;
    } catch (e) {
      console.warn('Solana adresi alınamadı:', e.message);
      state.solanaAddr = null;
    }

    // USDC bakiyesi
    var balHex = await arcCall(ARC_USDC, encodeERC20BalanceOf(state.walletAddr));
    state.usdcBalance = balHex && balHex !== '0x' ? BigInt(balHex) : 0n;
    var balFormatted = (Number(state.usdcBalance) / 1e6).toFixed(2);

    connectBtn.style.display = 'none';
    var balEl = document.getElementById('arcBuyBalance');
    balEl.style.display = 'block';
    balEl.innerHTML = '💰 Arc USDC Bakiyeniz: <strong>$' + balFormatted + '</strong>'
      + (state.solanaAddr
        ? '<br>🔑 Solana: <code>' + state.solanaAddr.slice(0, 8) + '...' + state.solanaAddr.slice(-4) + '</code>'
        : '<br><label style="font-size:.8rem;color:#aaa">Solana alım adresi (Phantom/MetaMask Solana):<br><input id="arcSolAddrInput" placeholder="Base58 adres..." style="width:100%;padding:4px;margin-top:4px;background:#111;border:1px solid #444;color:#fff;border-radius:4px;font-size:.75rem" /></label>');

    if (state.usdcBalance === 0n) {
      balEl.innerHTML += '<br><span class="arc-buy-warning">⚠️ Arc Testnet USDC yok. <a href="https://studio.arc.io" target="_blank">Faucet\'ten alın</a> veya <a href="https://app.arc.io/bridge" target="_blank">köprüleyin</a>.</span>';
    }

    document.getElementById('arcBuyAmountSection').style.display = 'block';
  } catch (err) {
    showBuyError('Bağlantı hatası: ' + err.message);
    connectBtn.disabled = false;
    connectBtn.textContent = '🔗 Cüzdan Bağla';
  }
}

// ── Solana adresi al ─────────────────────────────────────────
// MetaMask multichain destekliyorsa otomatik alır, yoksa null döner
// (Kullanıcı swap adımında manuel girer)
async function getSolanaAddress(provider) {
  // Sadece MetaMask'ta dene
  if (!provider || !provider.isMetaMask) return null;
  try {
    var resp = await provider.request({
      method: 'wallet_invokeMethod',
      params: {
        scope: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
        request: { method: 'getAccounts', params: [] },
      },
    });
    if (resp && resp[0] && resp[0].address) return resp[0].address;
  } catch (e) {}
  return null;
}

// ── Jupiter quote al ──────────────────────────────────────────
async function loadQuote(state) {
  if (!state.selectedAmount || state.selectedAmount <= 0) return;
  var amountUSDC = Math.round(state.selectedAmount * 1e6); // 6 decimal
  var quoteEl = document.getElementById('arcBuyQuote');
  var confirmBtn = document.getElementById('arcBuyConfirmBtn');
  quoteEl.style.display = 'block';
  quoteEl.textContent = '⏳ Fiyat alınıyor...';
  confirmBtn.style.display = 'none';

  var outputMint = state.solanaCA || state.tokenCA;
  if (!outputMint || state.chain !== 'solana') {
    quoteEl.textContent = '⚠️ Bu token Solana ağında değil, Jupiter swap desteklenmiyor.';
    return;
  }

  try {
    var url = JUPITER_PROXY + '?path=ultra/v1/order'
      + '&inputMint=' + SOLANA_USDC_MINT
      + '&outputMint=' + outputMint
      + '&amount=' + amountUSDC;
    var resp = await fetch(url);
    var data = await resp.json();
    if (data.error || data.errorCode) {
      quoteEl.textContent = '⚠️ Swap rotası bulunamadı: ' + (data.error || data.errorCode);
      return;
    }
    state.quoteData = data;
    var outFormatted = data.outAmount
      ? (Number(data.outAmount) / Math.pow(10, 9)).toFixed(4)  // çoğu Solana token 9 decimal
      : '?';
    quoteEl.innerHTML = '📊 Tahmini: <strong>' + state.selectedAmount + ' USDC</strong> → <strong>~' + outFormatted + ' ' + esc2(state.tokenSymbol) + '</strong>'
      + (data.priceImpact ? '<br>Fiyat etkisi: ' + (data.priceImpact * 100).toFixed(2) + '%' : '');
    confirmBtn.style.display = 'block';
  } catch (err) {
    quoteEl.textContent = '⚠️ Fiyat alınamadı: ' + err.message;
  }
}

// ── Satın alma akışı ──────────────────────────────────────────
async function executeBuy(state) {
  if (!state.selectedAmount || !state.quoteData) return;
  var amountUSDC = BigInt(Math.round(state.selectedAmount * 1e6));
  if (amountUSDC > state.usdcBalance) {
    showBuyError('Yetersiz USDC bakiyesi. Bakiyeniz: $' + (Number(state.usdcBalance) / 1e6).toFixed(2));
    return;
  }

  // Solana adresi — otomatik alınamazsa input'tan oku
  if (!state.solanaAddr) {
    var inputEl = document.getElementById('arcSolAddrInput');
    var manualAddr = inputEl ? inputEl.value.trim() : '';
    if (!manualAddr || manualAddr.length < 32) {
      showBuyError('Solana alım adresinizi girin (Phantom veya MetaMask Solana hesabı).');
      return;
    }
    state.solanaAddr = manualAddr;
  }

  document.getElementById('arcBuyStep1').style.display = 'none';
  document.getElementById('arcBuyStep2').style.display = 'block';

  var steps = [
    { id: 'step-approve', label: 'USDC onayı (Approve)', state: 'pending' },
    { id: 'step-burn', label: 'Arc → Solana bridge (CCTP)', state: 'pending' },
    { id: 'step-attest', label: 'Attestation bekleniyor...', state: 'pending' },
    { id: 'step-swap', label: 'Solana\'da swap (Jupiter)', state: 'pending' },
  ];
  renderSteps(steps);

  try {
    // ── ADIM 1: Approve ──────────────────────────────────────
    setStep(steps, 'step-approve', 'active');
    var allowanceHex = await arcCall(ARC_USDC,
      '0xdd62ed3e' +
      state.walletAddr.replace('0x', '').padStart(64, '0') +
      ARC_TOKEN_MESSENGER_V2.replace('0x', '').padStart(64, '0'));
    var allowance = allowanceHex && allowanceHex !== '0x' ? BigInt(allowanceHex) : 0n;
    if (allowance < amountUSDC) {
      var approveTx = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [{
          from: state.walletAddr,
          to: ARC_USDC,
          data: encodeERC20Approve(ARC_TOKEN_MESSENGER_V2, amountUSDC),
        }],
      });
      await waitForArcTx(approveTx);
    }
    setStep(steps, 'step-approve', 'done');

    // ── ADIM 2: depositForBurn (CCTP) ────────────────────────
    setStep(steps, 'step-burn', 'active');
    var mintRecipientBytes32 = solanaAddressToBytes32(state.solanaAddr);
    var MAX_FEE = 0n; // fee 0 — Circle varsayılan minimum uygular
    var MIN_FINALITY = 1000; // confirmed
    var burnData = encodeDepositForBurn(
      amountUSDC,
      SOLANA_MAINNET_DOMAIN,
      mintRecipientBytes32,
      ARC_USDC,
      '0x0000000000000000000000000000000000000000000000000000000000000000',
      MAX_FEE,
      MIN_FINALITY
    );
    var burnTx = await window.ethereum.request({
      method: 'eth_sendTransaction',
      params: [{
        from: state.walletAddr,
        to: ARC_TOKEN_MESSENGER_V2,
        data: burnData,
      }],
    });
    var burnReceipt = await waitForArcTx(burnTx);
    setStep(steps, 'step-burn', 'done');

    // ── ADIM 3: Attestation ──────────────────────────────────
    setStep(steps, 'step-attest', 'active');
    var attestation = await pollAttestation(burnTx);
    setStep(steps, 'step-attest', 'done');

    // ── ADIM 4: Jupiter swap ─────────────────────────────────
    setStep(steps, 'step-swap', 'active');
    await jupiterSwap(state);
    setStep(steps, 'step-swap', 'done');

    // Tamamlandı
    document.getElementById('arcBuyStep2').style.display = 'none';
    document.getElementById('arcBuyStep3').style.display = 'block';
    document.getElementById('arcBuySuccessDetails').innerHTML =
      '<p>🎉 <strong>' + state.selectedAmount + ' USDC</strong> harcandı</p>'
      + '<p>🪙 <strong>' + esc2(state.tokenSymbol) + '</strong> Solana adresinize gönderildi</p>'
      + '<p>👛 Adres: <code>' + state.solanaAddr + '</code></p>';

  } catch (err) {
    showBuyError('İşlem hatası: ' + err.message);
    document.getElementById('arcBuyStep2').style.display = 'none';
    document.getElementById('arcBuyStep1').style.display = 'block';
  }
}

// ── Arc tx receipt bekle ──────────────────────────────────────
async function waitForArcTx(txHash) {
  var provider = window.ethereum;
  for (var i = 0; i < 60; i++) {
    await sleep(2000);
    try {
      var receipt = await provider.request({
        method: 'eth_getTransactionReceipt',
        params: [txHash],
      });
      if (receipt) {
        if (receipt.status === '0x0') throw new Error('İşlem başarısız: ' + txHash);
        return receipt;
      }
    } catch (e) {
      if (e.message.includes('başarısız')) throw e;
    }
  }
  throw new Error('İşlem zaman aşımına uğradı: ' + txHash);
}

// ── CCTP Attestation bekle ────────────────────────────────────
async function pollAttestation(txHash) {
  // Iris v2'den attestation al
  for (var i = 0; i < 60; i++) {
    await sleep(5000);
    try {
      var resp = await fetch(IRIS_API + '/v2/messages/' + txHash);
      var data = await resp.json();
      if (data.messages && data.messages[0] && data.messages[0].attestation && data.messages[0].attestation !== 'PENDING') {
        return data.messages[0];
      }
    } catch (e) {}
  }
  throw new Error('Attestation zaman aşımına uğradı');
}

// ── Jupiter swap (Solana tarafı) ──────────────────────────────
async function jupiterSwap(state) {
  // Solana USDC'si artık state.solanaAddr'de
  // Quote al (taker ile — signed tx için)
  var amountUSDC = Math.round(state.selectedAmount * 1e6);
  var outputMint = state.solanaCA || state.tokenCA;
  var orderUrl = JUPITER_PROXY + '?path=ultra/v1/order'
    + '&inputMint=' + SOLANA_USDC_MINT
    + '&outputMint=' + outputMint
    + '&amount=' + amountUSDC
    + '&taker=' + state.solanaAddr;
  var orderResp = await fetch(orderUrl);
  var order = await orderResp.json();
  if (!order.transaction) throw new Error('Jupiter swap transaction alınamadı: ' + (order.error || JSON.stringify(order)));

  // MetaMask Solana ile imzala ve gönder
  var signedTx = await signSolanaTransaction(order.transaction, state.solanaAddr);

  // Execute
  var execResp = await fetch(JUPITER_PROXY + '?path=ultra/v1/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ signedTransaction: signedTx, requestId: order.requestId }),
  });
  var execData = await execResp.json();
  if (execData.status !== 'Success') {
    throw new Error('Jupiter execute başarısız: ' + (execData.error || execData.status));
  }
  return execData;
}

// ── MetaMask ile Solana tx imzala ─────────────────────────────
async function signSolanaTransaction(base64Tx, solanaAddress) {
  var provider = window.ethereum;
  // MetaMask multichain Solana API
  var result = await provider.request({
    method: 'wallet_invokeMethod',
    params: {
      scope: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp', 
      request: {
        method: 'signAndSendTransaction',
        params: {
          account: { address: solanaAddress },
          transaction: base64Tx,
        },
      },
    },
  });
  // signAndSendTransaction imzalayıp gönderiyor, imzalı tx değil signature dönüyor
  // Execute için imzalı tx lazım — signTransaction kullan
  var signResult = await provider.request({
    method: 'wallet_invokeMethod',
    params: {
      scope: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
      request: {
        method: 'signTransaction',
        params: {
          account: { address: solanaAddress },
          transaction: base64Tx,
        },
      },
    },
  });
  if (!signResult || !signResult.signedTransaction) throw new Error('Solana imzalama başarısız');
  return signResult.signedTransaction;
}

// ── UI yardımcıları ───────────────────────────────────────────
function renderSteps(steps) {
  var html = steps.map(function(s) {
    return '<div class="arc-buy-step arc-buy-step-' + s.state + '" id="' + s.id + '">'
      + '<span class="arc-buy-step-icon">' + (s.state === 'done' ? '✅' : s.state === 'active' ? '⏳' : '⭕') + '</span>'
      + '<span>' + s.label + '</span></div>';
  }).join('');
  document.getElementById('arcBuyStepsList').innerHTML = html;
}
function setStep(steps, id, newState) {
  steps.forEach(function(s) { if (s.id === id) s.state = newState; });
  renderSteps(steps);
}
function showBuyError(msg) {
  var el = document.getElementById('arcBuyError');
  if (el) { el.style.display = 'block'; el.textContent = '❌ ' + msg; }
}
function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }
function esc2(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

// ── Global: AL butonuna tıklayınca çağrılır ───────────────────
window.arcOpenBuyModal = function(tokenCA, tokenSymbol, chain, solanaCA) {
  // Solana dışı için DexScreener
  if (chain !== 'solana') {
    var url = 'https://dexscreener.com/' + chain + '/' + tokenCA;
    window.open(url, '_blank');
    return;
  }
  createBuyModal(tokenCA, tokenSymbol, chain, solanaCA || tokenCA);
};
