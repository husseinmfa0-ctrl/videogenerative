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

  const systemPrompt = 'You are a professional copywriter producing ready-to-use content for a video creator tool. ' +
    'Output ONLY the final, clean result the user asked for — nothing else. ' +
    'Never show your reasoning, planning, character counting, drafts, or any internal thought process. ' +
    'Never wrap anything in <think> tags or similar. Do not explain what you are about to do. ' +
    'Do not add commentary before or after the requested content. Just the finished output, correctly formatted.';

  // Two pinned, known-good instruction-following free models.
  // Deliberately avoids "openrouter/free" auto-routing, which can land on a
  // reasoning model that leaks its internal thought process into the output.
  const primaryModel='meta-llama/llama-3.3-70b-instruct:free';
  const fallbackModel='qwen/qwen-2.5-72b-instruct:free';

  async function callModel(model) {
    const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://videogenerative.com',
        'X-Title': 'VideoGenerative'
      },
      body: JSON.stringify({
        model,
        max_tokens: Math.min(Math.max(Number(max_tokens) || 900, 50), 2000),
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ]
      })
    });
    const data = await upstream.json().catch(() => ({}));
    return { ok: upstream.ok, status: upstream.status, data };
  }

  function cleanOutput(raw) {
    if (!raw) return raw;
    // Safety net: strip any leaked reasoning blocks a model might emit anyway.
    let out = raw.replace(/<think>[\s\S]*?<\/think>/gi, '');
    out = out.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '');
    return out.trim();
  }

  try {
    let result = await callModel(primaryModel);

    // Fall back to a second pinned instruct model only if the first is unavailable/rate-limited.
    if (!result.ok) {
      result = await callModel(fallbackModel);
    }

    if (!result.ok) {
      res.status(result.status).json({ error: result.data?.error?.message || 'Upstream API error' });
      return;
    }

    const text = cleanOutput(result.data?.choices?.[0]?.message?.content || '');
    res.status(200).json({ text });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unexpected server error' });
  }
}
