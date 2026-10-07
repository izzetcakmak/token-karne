// Vercel serverless function — Jupiter Ultra API proxy
// Jupiter API key sunucu tarafında kalır, tarayıcıya açılmaz.
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const apiKey = process.env.JUPITER_API_KEY;
  const BASE = apiKey
    ? 'https://api.jup.ag'
    : 'https://lite-api.jup.ag';

  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers['x-api-key'] = apiKey;

  try {
    // /api/jupiter?path=ultra/v1/order&inputMint=...&outputMint=...&amount=...&taker=...
    // /api/jupiter?path=ultra/v1/execute  (POST)
    const { path, ...params } = req.query;
    if (!path) return res.status(400).json({ error: 'path param required' });

    if (req.method === 'POST') {
      // execute endpoint
      const upstream = await fetch(`${BASE}/${path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(req.body),
      });
      const data = await upstream.json();
      return res.status(upstream.status).json(data);
    }

    // GET — quote/order
    const qs = new URLSearchParams(params).toString();
    const url = `${BASE}/${path}${qs ? '?' + qs : ''}`;
    const upstream = await fetch(url, { headers });
    const data = await upstream.json();
    return res.status(upstream.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
