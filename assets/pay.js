/* =============================================================
   TOKEN KARNESİ — ödeme kapıları (Arc mainnet, USDC)

   1) Karne: her tarama 0.10 USDC. Analiz önce çalışır; token bulunamazsa ya da
      kaynaklar cevap vermezse ödeme hiç istenmez. Sonuç hazır olunca ödeme
      kartı çıkar, onaylanan işlemden sonra karne açılır. Her karne ayrı ödeme:
      örnekler, geçmiş, tahta satırları ve ?ca= linkleri de bu kapıdan geçer.
   2) Tahta: 0.10 USDC = 30 dakikalık erişim (bu tarayıcıda). Süre bitince
      liste kendiliğinden kapanır; tekrar görmek yeni ödeme ister.

   Ödeme = Arc USDC kontratında transfer(PAY_TO, 100000) (6 ondalık).
   Cüzdan/RPC yardımcıları onchain.js'ten gelir (arcSwitchToArc, arcEthCall,
   arcWaitForTx, ARC_SEL, USDC_ADDR, arcWord, arcAddrWord, detectWallet).

   Statik site: kapı tarayıcıda uygulanır. Veri kaynakları herkese açık API'ler
   olduğu için teknik bir kullanıcı veriye başka yoldan ulaşabilir; kapı,
   sitenin arayüzünü ücretlendirir.
   ============================================================= */
'use strict';

(function () {
  var PAY_TO       = '0xD4F1254C803662c46D9c21f80F4F3c15FF57e2c9'; // site sahibi
  var PRICE_SCAN   = 100000n;            // 0.10 USDC
  var PRICE_BOARD  = 100000n;            // 0.10 USDC
  var BOARD_MS     = 30 * 60 * 1000;     // tahta erişimi
  var KEY_BOARD    = 'tk_board_access';  // {until, tx, from}
  var KEY_LOG      = 'tk_pay_log';       // son ödemeler (kullanıcının kendi kaydı)
  var SEL_TRANSFER = '0xa9059cbb';       // transfer(address,uint256)

  function tr() { return typeof LANG !== 'undefined' ? LANG === 'tr' : true; }
  function t(key, vars) { return typeof T === 'function' ? T(key, vars) : key; }
  function fmtUsdc(units) { return (Number(units) / 1e6).toFixed(2); }
  function shortAddr(a) { return a.slice(0, 6) + '…' + a.slice(-4); }
  function walletIcon() { return typeof detectWallet === 'function' ? detectWallet().icon : '🔗'; }
  function explorerTx(tx) { return (typeof ARC_EXPLORER !== 'undefined' ? ARC_EXPLORER : 'https://explorer.arc.io') + '/tx/' + tx; }
  function explorerAddr(a) { return (typeof ARC_EXPLORER !== 'undefined' ? ARC_EXPLORER : 'https://explorer.arc.io') + '/address/' + a; }

  function logPayment(entry) {
    try {
      var log = JSON.parse(localStorage.getItem(KEY_LOG) || '[]');
      log.unshift(entry);
      localStorage.setItem(KEY_LOG, JSON.stringify(log.slice(0, 30)));
    } catch (e) {}
  }

  /* ---- ödeme çekirdeği ------------------------------------------------ */
  async function connectWallet(setStatus) {
    if (!window.ethereum) { var e = new Error('nowallet'); e.kind = 'nowallet'; throw e; }
    setStatus(t('pay.st.connect'));
    var accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    var from = accounts && accounts[0];
    if (!from) { var e2 = new Error('noaccount'); e2.kind = 'nowallet'; throw e2; }
    await arcSwitchToArc();
    if (typeof arcWalletAddr !== 'undefined') arcWalletAddr = from;
    return from;
  }

  async function payUsdc(units, meta, setStatus) {
    var from = await connectWallet(setStatus);
    var balHex = await arcEthCall(USDC_ADDR, ARC_SEL.balanceOf + arcAddrWord(from));
    var bal = balHex && balHex !== '0x' ? BigInt(balHex) : 0n;
    if (bal < units) { var e = new Error('balance'); e.kind = 'balance'; e.bal = bal; throw e; }

    setStatus(t('pay.st.confirm'));
    var tx = await window.ethereum.request({
      method: 'eth_sendTransaction',
      params: [{ from: from, to: USDC_ADDR, data: SEL_TRANSFER + arcAddrWord(PAY_TO) + arcWord(units) }]
    });
    setStatus(t('pay.st.wait'));
    await arcWaitForTx(tx, 120000);   // revert olursa fırlatır
    logPayment({ t: Date.now(), kind: meta.kind, ca: meta.ca || null, tx: tx, from: from, usdc: fmtUsdc(units) });
    return { tx: tx, from: from };
  }

  function errText(e) {
    if (e && e.code === 4001) return t('pay.err.rejected');
    if (e && e.kind === 'nowallet') return t('pay.err.nowallet');
    if (e && e.kind === 'balance') return t('pay.err.balance', { b: fmtUsdc(e.bal) });
    return t('pay.err.generic', { m: (e && e.message) ? String(e.message).slice(0, 120) : String(e) });
  }

  function noteHtml() {
    return t('pay.note', {
      to: '<a href="' + explorerAddr(PAY_TO) + '" target="_blank" rel="noopener">' + shortAddr(PAY_TO) + '</a>'
    });
  }

  /* ---- 1) karne kapısı -------------------------------------------------- */
  var pendingResolve = null;

  function payCardEl() {
    var box = document.getElementById('loading');
    var card = document.getElementById('payCard');
    if (!card) {
      card = document.createElement('div');
      card.id = 'payCard';
      card.className = 'load-card pay-card';
      card.hidden = true;
      box.appendChild(card);
    }
    return card;
  }
  function showLoadCard(show) {
    var lc = document.querySelector('#loading > .load-card:not(.pay-card)');
    if (lc) lc.hidden = !show;
  }

  /* app.js run(): analiz bitince çağırır; ödeme onaylanınca true, vazgeçilince false */
  window.payGateScan = function (info) {
    if (pendingResolve) { pendingResolve(false); pendingResolve = null; }   // yeni tarama eskisini iptal eder
    return new Promise(function (resolve) {
      pendingResolve = resolve;
      var card = payCardEl();
      var box = document.getElementById('loading');
      showLoadCard(false);
      card.hidden = false;
      box.hidden = false;

      card.innerHTML =
        '<div class="pay-kicker">💳 ' + t('pay.scan.ready', { sym: '$' + esc(info.sym || '?'), chain: esc(info.chain || '') }) + '</div>' +
        '<p class="pay-lead">' + t('pay.scan.lead') + '</p>' +
        '<div class="pay-row">' +
          '<button class="pay-btn" id="payScanBtn">' + walletIcon() + ' ' + t('pay.scan.btn') + '</button>' +
          '<button class="pay-cancel" id="payScanCancel">' + t('pay.cancel') + '</button>' +
        '</div>' +
        '<div class="pay-status" id="payScanStatus">' + noteHtml() + '</div>';

      var btn = document.getElementById('payScanBtn');
      var status = document.getElementById('payScanStatus');
      function setStatus(msg, cls) { status.innerHTML = msg; status.className = 'pay-status' + (cls ? ' ' + cls : ''); }
      function finish(ok) {
        if (pendingResolve !== resolve) return;   // bu kart artık güncel değil
        pendingResolve = null;
        card.hidden = true;
        showLoadCard(true);
        resolve(ok);
      }

      btn.onclick = async function () {
        btn.disabled = true;
        try {
          var r = await payUsdc(PRICE_SCAN, { kind: 'scan', ca: info.ca }, setStatus);
          setStatus('✅ ' + t('pay.st.ok') + ' · <a href="' + explorerTx(r.tx) + '" target="_blank" rel="noopener">tx ↗</a>', 'ok');
          setTimeout(function () { finish(true); }, 350);
        } catch (e) {
          console.warn('payGateScan:', e);
          setStatus(errText(e), 'err');
          btn.disabled = false;
        }
      };
      document.getElementById('payScanCancel').onclick = function () {
        finish(false);
        box.hidden = true;
      };
    });
  };

  /* ---- 2) tahta kapısı -------------------------------------------------- */
  var expiredNote = false;
  var tickTimer = null;

  function boardAccess() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY_BOARD) || 'null');
      if (s && typeof s.until === 'number' && s.until > Date.now()) return s;
    } catch (e) {}
    return null;
  }
  function grantBoard(tx, from) {
    localStorage.setItem(KEY_BOARD, JSON.stringify({ until: Date.now() + BOARD_MS, tx: tx, from: from }));
    expiredNote = false;
  }
  function mmss(ms) {
    var s = Math.max(0, Math.ceil(ms / 1000));
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  }
  function leftChip() {
    var head = document.querySelector('#board .qhead');
    if (!head) return null;
    var chip = document.getElementById('payLeft');
    if (!chip) {
      chip = document.createElement('span');
      chip.id = 'payLeft';
      chip.className = 'pay-left';
      head.appendChild(chip);
    }
    return chip;
  }
  function removeChip() { var c = document.getElementById('payLeft'); if (c) c.remove(); }

  function tick() {
    var acc = boardAccess();
    if (!acc) {
      /* az önce bitti: listeyi kapat, kilit kartını "süre doldu" notuyla çiz */
      if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
      removeChip();
      expiredNote = true;
      if (typeof renderBoard === 'function') renderBoard();
      if (typeof toast === 'function') toast(t('pay.board.expired'));
      return;
    }
    var chip = leftChip();
    if (chip) chip.textContent = '⏱ ' + t('pay.board.left', { t: mmss(acc.until - Date.now()) });
  }
  function startTick() {
    if (tickTimer) return;
    tick();
    tickTimer = setInterval(tick, 1000);
  }

  /* app.js renderBoard(): kilitliyse kilit kartını çizer ve true döner;
     açıksa geri sayım çipini kurar ve false döner (liste normal çizilir) */
  window.payBoardGate = function (board) {
    var list = document.getElementById('boardList');
    if (!list) return false;
    if (boardAccess()) { startTick(); return false; }

    if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
    removeChip();
    var n = board && Array.isArray(board.items) ? board.items.length : 0;
    list.innerHTML =
      '<div class="board-lock">' +
        '<div class="lock-em">🔒</div>' +
        '<h3>' + t('pay.board.title') + '</h3>' +
        '<p>' + t('pay.board.lead', { n: n }) + '</p>' +
        (expiredNote ? '<p class="pay-expired">⏱ ' + t('pay.board.expired') + '</p>' : '') +
        '<div class="pay-row">' +
          '<button class="pay-btn" id="payBoardBtn">' + walletIcon() + ' ' + t('pay.board.btn') + '</button>' +
        '</div>' +
        '<div class="pay-status" id="payBoardStatus">' + noteHtml() + '</div>' +
      '</div>';

    var btn = document.getElementById('payBoardBtn');
    var status = document.getElementById('payBoardStatus');
    function setStatus(msg, cls) { status.innerHTML = msg; status.className = 'pay-status' + (cls ? ' ' + cls : ''); }
    btn.onclick = async function () {
      btn.disabled = true;
      try {
        var r = await payUsdc(PRICE_BOARD, { kind: 'board' }, setStatus);
        grantBoard(r.tx, r.from);
        if (typeof toast === 'function') toast('✅ ' + t('pay.st.ok'));
        if (typeof renderBoard === 'function') renderBoard();
      } catch (e) {
        console.warn('payBoardGate:', e);
        setStatus(errText(e), 'err');
        btn.disabled = false;
      }
    };
    return true;
  };

  /* sekme arka plandayken sayaç yavaşlar; geri gelince hemen kontrol et */
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && tickTimer) tick();
  });
})();
