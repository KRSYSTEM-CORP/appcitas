"use client";

import Script from "next/script";

// Cloudflare's script scans the page for ".cf-turnstile" divs and renders
// the widget into them, injecting a hidden `cf-turnstile-response` input —
// since this sits inside the signup <form>, that token rides along in the
// normal FormData with no extra client wiring. Renders nothing (and the
// server skips verification, see lib/turnstile.ts) until the site key is
// configured, so signup keeps working before Turnstile is set up.
export function Turnstile() {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (!siteKey) return null;

  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
      <div className="cf-turnstile" data-sitekey={siteKey} />
    </>
  );
}
