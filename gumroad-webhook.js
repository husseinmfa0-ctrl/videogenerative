export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body;

    const email = body.email || body.purchase?.email;
    const productPermalink = body.product_permalink || body.permalink || '';
    const refunded = body.refunded === 'true' || body.refunded === true;
    const cancelled = body.subscription_cancelled === 'true' || body.subscription_cancelled === true;
    const ended = body.subscription_ended === 'true' || body.subscription_ended === true;

    if (!email) {
      return res.status(400).json({ error: 'No email in webhook payload' });
    }

    const SUPABASE_URL = 'https://kiqybjhwcshusseskxlu.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_f6HDn-tCRZRWEiOsJEvUpQ_3uES6y00';

    let newLimit = 9999;
    let newPlan = 'pro';

    if (productPermalink.includes('bpzrb')) {
      newLimit = 50;
      newPlan = 'starter';
    }

    if (refunded || cancelled || ended) {
      newLimit = 3;
      newPlan = 'free';
    }

    const checkRes = await fetch(
      `${SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(email)}`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      }
    );
    const existing = await checkRes.json();

    if (existing && existing.length > 0) {
      await fetch(
        `${SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(email)}`,
        {
          method: 'PATCH',
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({
            credits_limit: newLimit,
            plan: newPlan,
            gumroad_subscriber_id: body.subscriber_id || body.sale_id || null,
          }),
        }
      );
    } else {
      await fetch(`${SUPABASE_URL}/rest/v1/users`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          email: email,
          credits_used: 0,
          credits_limit: newLimit,
          plan: newPlan,
          gumroad_subscriber_id: body.subscriber_id || body.sale_id || null,
        }),
      });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(500).json({ error: err.message });
  }
}
