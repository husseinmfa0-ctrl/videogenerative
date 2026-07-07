// Vercel serverless function: /api/generate
// Keeps the OpenRouter API key on the server. The browser never sees it.
// Set OPENROUTER_API_KEY in Vercel → Project Settings → Environment Variables.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Server is missing OPENROUTER_API_KEY. Add it in Vercel project settings.' });
    return;
  }

  const { prompt, max_tokens } = req.body || {};
  if (!prompt || typeof prompt !== 'string') {
    res.status(400).json({ error: 'Missing prompt' });
    return;
  }

  try {
    const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://videogenerative.com',
        'X-Title': 'VideoGenerative'
      },
      body: JSON.stringify({
        model: 'openrouter/free',
        max_tokens: Math.min(Math.max(Number(max_tokens) || 900, 50), 2000),
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await upstream.json().catch(() => ({}));

    if (!upstream.ok) {
      res.status(upstream.status).json({ error: data?.error?.message || 'Upstream API error' });
      return;
    }

    const text = data?.choices?.[0]?.message?.content || '';
    res.status(200).json({ text });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unexpected server error' });
  }
}
