// Vercel serverless function: /api/test-bluesminds
// One-off test endpoint to verify the BluesMinds key works before relying on it for anything real.
// Set BLUESMINDS_API_KEY in Vercel → Project Settings → Environment Variables.
// NEVER put the actual key value in this file or anywhere in client-side code.

export default async function handler(req, res) {
  const apiKey = process.env.BLUESMINDS_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Server is missing BLUESMINDS_API_KEY. Add it in Vercel project settings, then redeploy.' });
    return;
  }

  const prompt = (req.method === 'POST' && req.body?.prompt) || 'Say "BluesMinds test successful" and nothing else.';

  try {
    const upstream = await fetch('https://api.bluesminds.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 100
      })
    });

    const data = await upstream.json().catch(() => ({}));

    if (!upstream.ok) {
      res.status(upstream.status).json({
        ok: false,
        status: upstream.status,
        error: data?.error?.message || data?.error || 'Request failed',
        raw: data
      });
      return;
    }

    const text = data?.choices?.[0]?.message?.content || null;
    res.status(200).json({ ok: true, text, raw: data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || 'Unexpected server error' });
  }
}
