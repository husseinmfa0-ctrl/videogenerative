// Vercel serverless function: /api/clips-create
// Starts a long-video-to-shorts clipping job via MuAPI's AI Clipping endpoint.
// MuAPI handles YouTube downloading, transcription, viral-moment ranking, and
// face-tracked vertical cropping all in one managed call.
// Set MUAPI_KEY in Vercel → Project Settings → Environment Variables.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.MUAPI_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Server is missing MUAPI_KEY. Add it in Vercel project settings.' });
    return;
  }

  const { video_url, num_clips, aspect_ratio } = req.body || {};
  if (!video_url || typeof video_url !== 'string') {
    res.status(400).json({ error: 'Missing video_url' });
    return;
  }

  try {
    const upstream = await fetch('https://api.muapi.ai/api/v1/ai-clipping', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        video_url,
        num_clips: Math.min(Math.max(Number(num_clips) || 3, 1), 10),
        aspect_ratio: aspect_ratio || '9:16'
      })
    });

    const data = await upstream.json().catch(() => ({}));

    if (!upstream.ok) {
      res.status(upstream.status).json({ error: data?.error || data?.message || 'Failed to start clipping job.' });
      return;
    }

    const requestId = data.request_id;
    if (!requestId) {
      res.status(502).json({ error: 'No request id returned from the clipping service.' });
      return;
    }

    res.status(200).json({ request_id: requestId, status: data.status || 'processing' });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unexpected server error' });
  }
}
