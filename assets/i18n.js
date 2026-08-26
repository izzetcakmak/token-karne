/* =============================================================
   i18n + soru tanimlari / strings + question definitions
   ============================================================= */

const QUESTIONS = [
  { n: 1,  src: 'dex',      tr: 'Likidite havuzu 30 bin doların üstünde mi?',              en: 'Is the liquidity pool above $30k?' },
  { n: 2,  src: 'sec',      tr: 'Likidite kilitli ya da yakılmış mı?',                     en: 'Is liquidity locked or burned?' },
  { n: 3,  src: 'sec',      tr: 'Mint yetkisi kapalı mı?',                                 en: 'Is mint authority revoked?' },
  { n: 4,  src: 'sec',      tr: 'Freeze yetkisi kapalı mı?',                               en: 'Is freeze authority revoked?' },
  { n: 5,  src: 'sec',      tr: 'İlk 10 cüzdan arzın %20\'sinden azını mı tutuyor?',        en: 'Do the top 10 wallets hold less than 20% of supply?' },
  { n: 6,  src: 'bubble',   tr: 'Cüzdanlar birbirine bağsız mı, dağılım temiz mi?',        en: 'Are the wallets unlinked and the distribution clean?' },
  { n: 7,  src: 'gmgn',     tr: 'Geliştirici daha önce coin çıkarıp bırakmamış mı?',       en: 'Has the dev never launched and abandoned a coin?' },
  { n: 8,  src: 'tweet',    tr: 'Sosyal hesap bir haftadan eski mi?',                      en: 'Is the social account older than a week?' },
  { n: 9,  src: 'tweet',    tr: 'Takipçileri gerçek mi, botla şişmemiş mi?',               en: 'Are the followers real, not bot-inflated?' },
  { n: 10, src: 'dex',      tr: 'Holder sayısı son 24 saatte arttı mı?',                   en: 'Did the holder count grow in the last 24h?' },
  { n: 11, src: 'dex',      tr: 'Günlük hacim likiditenin en az yarısı kadar mı?',         en: 'Is 24h volume at least half of liquidity?' },
  { n: 12, src: 'you',      tr: 'Hikâyeyi tek cümleyle anlatabiliyor musun?',              en: 'Can you tell the story in one sentence?' }
];

const I18N = {
  tr: {
    'nav.how': 'Nasıl çalışır',
    'hero.eyebrow': '12 soru · 12 puan · sıfır duygu',
    'hero.lead': 'Bir kontrat adresi yapıştır. Likidite, mint/freeze yetkisi, holder dağılımı, dev geçmişi ve hacim tek ekranda toplansın. Sonunda tek bir cevap: <b>büyük gir, normal gir, küçük gir ya da geç.</b>',
    'hero.cta': 'KARNEYİ ÇIKAR',
    'hero.try': 'Denemelik:',
    'hero.ph': '0x... veya Solana mint adresi',
    'load.title': 'Karne hazırlanıyor…',
    'q.head': '12 SORU',
    'q.sub': 'Otomatik gelen cevabı beğenmediysen üstüne bas, değiştir — puan anında güncellenir.',
    'hist.title': 'Son baktıkların',
    'how.eyebrow': 'Hile listesi',
    'how.title': '100x aramanın kestirme yolu',
    'how.lead': 'Her soruya evet ise 1 puan, hayır ise 0. Duyguyla değil, listeyle karar ver. Karne soruların çoğunu senin yerine dolduruyor; sosyal hesap ve hikâye kısmı sana kalıyor.',
    'scale.1t': 'Nadir görülür.', 'scale.1d': 'Pozisyonu normalden büyük tut.',
    'scale.2t': 'Temiz.',         'scale.2d': 'Normal gir.',
    'scale.3t': 'Riskli.',        'scale.3d': 'Küçük gir, yakın takip et.',
    'scale.4t': 'Geç.',           'scale.4d': 'Tartışma yok, pazarlık yok.',
    'foot.by': 'Yapan',
    'foot.disc': 'Bu araç yatırım tavsiyesi değildir. Veriler DexScreener, GoPlus ve RugCheck genel API\'lerinden anlık çekilir; hatalı, eksik ya da gecikmeli olabilir. Skor bir kontrol listesidir, garanti değil. Kendi araştırmanı yap.',

    // --- how cards ---
    'how.c1.t': 'CA yapıştır', 'how.c1.d': 'Solana mint ya da EVM kontrat adresi. Zinciri kendi bulur; token birden fazla zincirdeyse seçim çıkar.',
    'how.c2.t': 'Veri çekilir', 'how.c2.d': 'DexScreener likidite/hacim, GoPlus ve RugCheck ise mint, freeze, LP kilidi ve holder dağılımını verir.',
    'how.c3.t': 'Sen tamamlarsın', 'how.c3.d': 'Sosyal hesabın yaşı, takipçi kalitesi ve hikâye senin işin. Tek tıkla TweetScout, GMGN, Bubblemaps açılır.',
    'how.c4.t': 'Karar çıkar', 'how.c4.d': '12 üzerinden skor + net bir hüküm. Karneyi PNG indir ya da doğrudan X\'te paylaş.',

    // --- verdicts ---
    'v.rare': 'NADİR', 'v.rare.a': 'Bu skoru nadiren görürsün. Pozisyonu normalden büyük tut — ama yine de stop\'unu koy.',
    'v.clean': 'TEMİZ', 'v.clean.a': 'Liste temiz. Normal pozisyonla gir.',
    'v.risky': 'RİSKLİ', 'v.risky.a': 'Delikler var. Küçük gir, yakın takip et, ilk kırmızı bayrakta çık.',
    'v.skip': 'GEÇ', 'v.skip.a': 'Tartışma yok, pazarlık yok. Bir sonraki tokene bak.',
    'v.label': 'PUAN',
    'v.todo': 'soru hâlâ sende — cevapla, karne netleşsin.',
    'v.todo1': 'soru hâlâ sende — cevapla, karne netleşsin.',

    // --- actions ---
    'act.x': 'X\'te paylaş', 'act.png': 'Karneyi indir', 'act.link': 'Linki kopyala', 'act.again': 'Yeni token',
    'toast.copy': 'Kopyalandı!', 'toast.png': 'Karne indirildi 📋', 'toast.saved': 'Cevabın kaydedildi',

    // --- answers ---
    'a.yes': 'EVET', 'a.no': 'HAYIR', 'a.unk': '?',
    'src.auto': 'otomatik', 'src.you': 'sen cevapla', 'src.guess': 'tahmin',

    // --- stats ---
    's.liq': 'Likidite', 's.vol': '24s hacim', 's.mcap': 'Piyasa değeri', 's.holders': 'Holder', 's.age': 'Yaş', 's.pair': 'Havuz',
    's.d': 'gün', 's.h': 'saat', 's.m': 'dk',

    // --- errors ---
    'e.empty': 'Önce bir kontrat adresi yapıştır.',
    'e.format': 'Bu bir kontrat adresine benzemiyor. EVM için 0x + 40 karakter, Solana için 32-44 karakterlik mint adresi bekleniyor.',
    'e.notfound': 'DexScreener bu adreste bir havuz bulamadı. Token henüz listelenmemiş olabilir ya da adres yanlış.',
    'e.net': 'Veri alınamadı. Bağlantını kontrol et ya da birazdan tekrar dene.',

    // --- steps ---
    'st.dex': 'DexScreener: havuz, likidite, hacim',
    'st.sec': 'GoPlus / RugCheck: mint, freeze, LP, holderlar',
    'st.calc': 'Puanlar hesaplanıyor',

    // --- flags ---
    'fl.title': 'Ekstra kırmızı bayraklar',
    'fl.none': 'Bilinen bir kırmızı bayrak yok. Yine de her şeyi doğrula.',
    'fl.honeypot': 'HONEYPOT: satış engelli',
    'fl.buytax': 'Alış vergisi %',
    'fl.selltax': 'Satış vergisi %',
    'fl.pausable': 'Transfer durdurulabilir',
    'fl.blacklist': 'Kara liste fonksiyonu var',
    'fl.proxy': 'Proxy kontrat (kod değişebilir)',
    'fl.notopen': 'Kaynak kodu doğrulanmamış',
    'fl.ownerback': 'Sahiplik geri alınabilir',
    'fl.hiddenowner': 'Gizli sahip',
    'fl.slippage': 'Slipaj/vergi sonradan değiştirilebilir',
    'fl.selfdestruct': 'Self-destruct fonksiyonu',
    'fl.rugged': 'RugCheck bunu "rugged" işaretlemiş',
    'fl.mutable': 'Metadata değiştirilebilir',
    'fl.creatorhp': 'Aynı geliştiriciden honeypot çıkmış:',
    'fl.freshpool': 'Havuz çok yeni (< 24 saat)',
    'fl.lowliq': 'Likidite çok ince',
    'fl.ghostliq': 'Şişirilmiş havuz, sayılmadı:',

    // --- question notes ---
    'n.liq': 'Toplam likidite <b>{v}</b> · eşik $30.000',
    'n.liq.none': 'Likidite verisi yok.',
    'n.lp.burn': 'LP\'nin <b>%{v}</b> kadarı yakılmış ya da kilitli.',
    'n.lp.no': 'LP kilitli değil, yakılmamış. Havuzu her an çekebilirler.',
    'n.lp.unknown': 'LP kilit durumu okunamadı — havuzu elle doğrula.',
    'n.mint.off': 'Mint yetkisi kapalı, ek arz basılamaz.',
    'n.mint.on': 'Mint yetkisi <b>açık</b>. İstedikleri kadar basabilirler.',
    'n.freeze.off': 'Freeze/pause yetkisi kapalı.',
    'n.freeze.on': 'Freeze/pause yetkisi <b>açık</b>. Cüzdanın dondurulabilir.',
    'n.top10': 'İlk 10 cüzdan (LP ve yakma adresleri hariç) arzın <b>%{v}</b> kadarını tutuyor.',
    'n.top10.no': 'İlk 10 cüzdan verisi yok.',
    'n.bubble.ok': 'Belirgin bir kümelenme yok. En büyük cüzdan %{v}. Yine de Bubblemaps\'te gözünle bak.',
    'n.bubble.bad': 'Şüpheli dağılım: {r}. Bubblemaps\'te balonlara bak.',
    'n.dev.hp': 'GoPlus: bu geliştiricinin <b>{v}</b> honeypot tokeni var.',
    'n.dev.ok': 'Bilinen bir honeypot geçmişi yok. Dev cüzdanını GMGN\'de aç, geçmiş coinlerine bak.',
    'n.dev.check': 'Geliştirici cüzdanı: <b>{v}</b> — GMGN\'de geçmiş tokenlerine bak.',
    'n.dev.unknown': 'Geliştirici adresi okunamadı. GMGN\'de tokenin dev sekmesine bak.',
    'n.x.found': 'X hesabı: <b>{v}</b> — TweetScout\'ta aç, hesabın yaşına bak.',
    'n.x.followers': 'X hesabı: <b>{v}</b> — TweetScout\'ta takipçi kalitesine bak.',
    'n.x.none': 'DexScreener\'da kayıtlı bir X hesabı yok. Sosyal yoksa puan da yok.',
    'n.holders.up': 'Holder sayısı <b>{a}</b> → <b>{b}</b> ({t} önce baktın).',
    'n.holders.down': 'Holder sayısı düşmüş: <b>{a}</b> → <b>{b}</b> ({t} önce baktın).',
    'n.holders.proxy': 'Geçmiş kaydın yok; 24 saatlik alım/satım işlemine bakıldı: <b>{b}</b> alış / <b>{s}</b> satış. Şu anki holder: <b>{h}</b>. Aynı tokene birkaç saat sonra tekrar bakarsan gerçek değişimi ölçerim.',
    'n.holders.none': 'Holder verisi yok.',
    'n.vol': '24s hacim <b>{v}</b> / likidite <b>{l}</b> = <b>{r}x</b> (eşik 0.5x)',
    'n.story': 'Bunu kimseye sorma. Tokeni tek cümleyle anlatamıyorsan, anlamamışsındır. Anlatabiliyorsan EVET\'e bas.',

    // --- share ---
    'share.text': '{sym} karnesi: {score}/12 — {verdict}\n\n{lines}\n\nKendi tokenini tarat 👇'
  },

  en: {
    'nav.how': 'How it works',
    'hero.eyebrow': '12 questions · 12 points · zero emotion',
    'hero.lead': 'Paste a contract address. Liquidity, mint/freeze authority, holder spread, dev history and volume — all on one screen. One answer at the end: <b>size up, size normal, size small, or skip.</b>',
    'hero.cta': 'RUN THE SCORECARD',
    'hero.try': 'Try one:',
    'hero.ph': '0x... or a Solana mint address',
    'load.title': 'Building the scorecard…',
    'q.head': '12 QUESTIONS',
    'q.sub': 'Do not like an auto answer? Tap it and flip it — the score updates instantly.',
    'hist.title': 'Recently checked',
    'how.eyebrow': 'The cheat sheet',
    'how.title': 'The shortcut to finding your 100x',
    'how.lead': 'Yes is 1 point, no is 0. Decide with a list, not with feelings. The scorecard fills in most of it for you; the socials and the story are on you.',
    'scale.1t': 'Rare.',   'scale.1d': 'Size the position bigger than usual.',
    'scale.2t': 'Clean.',  'scale.2d': 'Enter normal.',
    'scale.3t': 'Risky.',  'scale.3d': 'Enter small, watch it closely.',
    'scale.4t': 'Skip.',   'scale.4d': 'No debate, no negotiation.',
    'foot.by': 'Built by',
    'foot.disc': 'Not financial advice. Data is pulled live from the public DexScreener, GoPlus and RugCheck APIs and can be wrong, missing or delayed. The score is a checklist, not a guarantee. Do your own research.',

    'how.c1.t': 'Paste the CA', 'how.c1.d': 'Solana mint or EVM contract. The chain is detected automatically; if the token lives on several, you pick.',
    'how.c2.t': 'Data gets pulled', 'how.c2.d': 'DexScreener for liquidity and volume, GoPlus and RugCheck for mint, freeze, LP lock and holder spread.',
    'how.c3.t': 'You finish it', 'how.c3.d': 'Account age, follower quality and the story are yours to judge. One click opens TweetScout, GMGN and Bubblemaps.',
    'how.c4.t': 'You get a verdict', 'how.c4.d': 'A score out of 12 and a plain call. Download the card as PNG or post it straight to X.',

    'v.rare': 'RARE', 'v.rare.a': 'You rarely see this score. Size the position bigger than usual — still set your stop.',
    'v.clean': 'CLEAN', 'v.clean.a': 'The list is clean. Enter with a normal position.',
    'v.risky': 'RISKY', 'v.risky.a': 'There are holes. Enter small, watch closely, leave on the first red flag.',
    'v.skip': 'SKIP', 'v.skip.a': 'No debate, no negotiation. Go look at the next token.',
    'v.label': 'POINTS',
    'v.todo': 'questions are still on you — answer them to lock the score.',
    'v.todo1': 'question is still on you — answer it to lock the score.',

    'act.x': 'Share on X', 'act.png': 'Download card', 'act.link': 'Copy link', 'act.again': 'New token',
    'toast.copy': 'Copied!', 'toast.png': 'Scorecard downloaded 📋', 'toast.saved': 'Your answer is saved',

    'a.yes': 'YES', 'a.no': 'NO', 'a.unk': '?',
    'src.auto': 'auto', 'src.you': 'your call', 'src.guess': 'estimate',

    's.liq': 'Liquidity', 's.vol': '24h volume', 's.mcap': 'Market cap', 's.holders': 'Holders', 's.age': 'Age', 's.pair': 'Pool',
    's.d': 'd', 's.h': 'h', 's.m': 'm',

    'e.empty': 'Paste a contract address first.',
    'e.format': 'That does not look like a contract address. EVM needs 0x + 40 chars, Solana a 32-44 char mint.',
    'e.notfound': 'DexScreener found no pool for this address. The token may not be listed yet, or the address is wrong.',
    'e.net': 'Could not fetch data. Check your connection or try again in a moment.',

    'st.dex': 'DexScreener: pool, liquidity, volume',
    'st.sec': 'GoPlus / RugCheck: mint, freeze, LP, holders',
    'st.calc': 'Scoring',

    'fl.title': 'Extra red flags',
    'fl.none': 'No known red flags. Still verify everything yourself.',
    'fl.honeypot': 'HONEYPOT: cannot sell',
    'fl.buytax': 'Buy tax %',
    'fl.selltax': 'Sell tax %',
    'fl.pausable': 'Transfers can be paused',
    'fl.blacklist': 'Blacklist function present',
    'fl.proxy': 'Proxy contract (code can change)',
    'fl.notopen': 'Source code not verified',
    'fl.ownerback': 'Ownership can be taken back',
    'fl.hiddenowner': 'Hidden owner',
    'fl.slippage': 'Slippage/tax can be modified later',
    'fl.selfdestruct': 'Self-destruct function',
    'fl.rugged': 'RugCheck marked this as rugged',
    'fl.mutable': 'Metadata is mutable',
    'fl.creatorhp': 'Honeypots from the same dev:',
    'fl.freshpool': 'Pool is very fresh (< 24h)',
    'fl.lowliq': 'Liquidity is very thin',
    'fl.ghostliq': 'Inflated pool, excluded:',

    'n.liq': 'Total liquidity <b>{v}</b> · threshold $30,000',
    'n.liq.none': 'No liquidity data.',
    'n.lp.burn': '<b>{v}%</b> of the LP is burned/locked.',
    'n.lp.no': 'LP is neither locked nor burned. They can pull the pool anytime.',
    'n.lp.unknown': 'LP lock status unreadable — verify the pool manually.',
    'n.mint.off': 'Mint authority revoked, no new supply.',
    'n.mint.on': 'Mint authority is <b>live</b>. They can print at will.',
    'n.freeze.off': 'Freeze/pause authority revoked.',
    'n.freeze.on': 'Freeze/pause authority is <b>live</b>. Your wallet can be frozen.',
    'n.top10': 'Top 10 wallets (excluding LP and burn addresses) hold <b>{v}%</b> of supply.',
    'n.top10.no': 'No top-holder data.',
    'n.bubble.ok': 'No obvious clustering. Biggest wallet {v}%. Still eyeball it on Bubblemaps.',
    'n.bubble.bad': 'Suspicious spread: {r}. Go look at the bubbles.',
    'n.dev.hp': 'GoPlus: this dev has <b>{v}</b> honeypot tokens.',
    'n.dev.ok': 'No known honeypot history. Open the dev wallet on GMGN and check their old coins.',
    'n.dev.check': 'Dev wallet: <b>{v}</b> — check their past tokens on GMGN.',
    'n.dev.unknown': 'Dev address unreadable. Check the dev tab on GMGN.',
    'n.x.found': 'X account: <b>{v}</b> — open it on TweetScout and check the account age.',
    'n.x.followers': 'X account: <b>{v}</b> — check follower quality on TweetScout.',
    'n.x.none': 'No X account listed on DexScreener. No socials, no point.',
    'n.holders.up': 'Holders went <b>{a}</b> → <b>{b}</b> (you checked {t} ago).',
    'n.holders.down': 'Holders dropped: <b>{a}</b> → <b>{b}</b> (you checked {t} ago).',
    'n.holders.proxy': 'No earlier snapshot; using 24h flow instead: <b>{b}</b> buys / <b>{s}</b> sells. Current holders: <b>{h}</b>. Re-check this token in a few hours and I will measure the real delta.',
    'n.holders.none': 'No holder data.',
    'n.vol': '24h volume <b>{v}</b> / liquidity <b>{l}</b> = <b>{r}x</b> (threshold 0.5x)',
    'n.story': 'Do not ask anyone this one. If you cannot say it in one sentence, you have not understood it. If you can, hit YES.',

    'share.text': '{sym} scorecard: {score}/12 — {verdict}\n\n{lines}\n\nScore your own token 👇'
  }
};
