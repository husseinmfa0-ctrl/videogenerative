// Vercel serverless function: /api/generate
// Uses Google's Gemini API free tier — genuinely $0, official direct API.
// Set GEMINI_API_KEY in Vercel → Project Settings → Environment Variables.
// Get a key at https://aistudio.google.com/apikey (sign in with any Google account).

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Server is missing GEMINI_API_KEY. Add it in Vercel project settings.' });
    return;
  }

  const { prompt, max_tokens } = req.body || {};
  if (!prompt || typeof prompt !== 'string') {
    res.status(400).json({ error: 'Missing prompt' });
    return;
  }

  const systemPrompt = 'You are a professional copywriter producing ready-to-use content for a video creator tool. ' +
    'Output ONLY the final, clean result the user asked for — nothing else. ' +
    'Never show your reasoning, planning, character counting, drafts, or any internal thought process. ' +
    'Do not explain what you are about to do. Do not add commentary before or after the requested content. ' +
    'Just the finished output, correctly formatted.';

  const model = 'gemini-2.5-flash';

  try {
    const upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: Math.min(Math.max(Number(max_tokens) || 1200, 300), 2000)
          }
        })
      }
    );

    const data = await upstream.json().catch(() => ({}));

    if (!upstream.ok) {
      res.status(upstream.status).json({ error: data?.error?.message || 'Generation failed — please try again.' });
      return;
    }

    const text = (data?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
    if (!text) {
      res.status(502).json({ error: 'The model returned an empty response — please try again.' });
      return;
    }

    res.status(200).json({ text });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unexpected server error' });
  }
}
