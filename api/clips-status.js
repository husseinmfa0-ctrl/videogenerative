// Vercel serverless function: /api/clips-status
// Polls the status of a clipping job started via /api/clips-create.

export default async function handler(req, res) {
  const apiKey = process.env.MUAPI_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Server is missing MUAPI_KEY. Add it in Vercel project settings.' });
    return;
  }

  const requestId = req.query?.request_id;
  if (!requestId) {
    res.status(400).json({ error: 'Missing request_id' });
    return;
  }

  try {
    const upstream = await fetch(`https://api.muapi.ai/api/v1/predictions/${encodeURIComponent(requestId)}/result`, {
      headers: { 'x-api-key': apiKey }
    });

    const data = await upstream.json().catch(() => ({}));

    if (!upstream.ok) {
      res.status(upstream.status).json({ error: data?.error || data?.message || 'Failed to fetch clipping job status.' });
      return;
    }

    const status = String(data.status || 'unknown').toLowerCase();
    const done = status === 'completed';
    const failed = status === 'failed';

    res.status(200).json({
      status,
      done,
      failed,
      shorts: done ? (data.shorts || data.clips || data.results || data.outputs || []) : [],
      raw: data
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unexpected server error' });
  }
}
