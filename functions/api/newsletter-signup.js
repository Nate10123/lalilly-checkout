// Cloudflare Pages Function — adds an email to the LA LILLY newsletter list
// in Brevo (brevo.com), a free email marketing tool. The API key lives only
// on the server as an environment variable; it never reaches the browser.
//
// Setup (see README.md for the full walkthrough):
//   1. Create a free Brevo account and a contact list for the newsletter.
//   2. Generate an API key under SMTP & API > API Keys.
//   3. In Cloudflare Pages > Settings > Environment variables, set:
//        BREVO_API_KEY  — the API key from step 2
//        BREVO_LIST_ID  — the numeric ID of the list from step 1
//      for both Production and Preview.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request.' }, 400);
  }

  const email = (body.email || '').trim();
  if (!email || !EMAIL_RE.test(email)) {
    return json({ error: 'Enter a valid email address.' }, 400);
  }

  if (!env.BREVO_API_KEY || !env.BREVO_LIST_ID) {
    return json({ error: 'Newsletter signup is not configured yet.' }, 500);
  }

  try {
    const res = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        'api-key': env.BREVO_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        listIds: [Number(env.BREVO_LIST_ID)],
        // Re-signing up with the same email updates the existing contact
        // instead of erroring out, so the form never fails for repeat visitors.
        updateEnabled: true,
      }),
    });

    // Brevo returns 201 for a new contact and 204 for an existing one that
    // was updated — both mean the signup succeeded.
    if (res.status === 201 || res.status === 204) {
      return json({ ok: true });
    }

    const errBody = await res.json().catch(() => ({}));
    return json({ error: errBody.message || 'Could not sign up right now.' }, 502);
  } catch (err) {
    return json({ error: 'Could not reach the newsletter service. Try again in a moment.' }, 502);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
