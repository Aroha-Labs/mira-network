/**
 * Verify Supabase Auth Hook signature (Svix format)
 *
 * Supabase uses Svix for webhooks:
 * - Secret format: "v1,whsec_<base64-secret>"
 * - Signature header: "webhook-signature" with format "v1,<base64-sig>"
 * - Signed content: "${webhook_id}.${webhook_timestamp}.${body}"
 */
export async function verifySupabaseWebhook(
  body: string,
  headers: {
    webhookId: string | undefined;
    webhookTimestamp: string | undefined;
    webhookSignature: string | undefined;
  },
  secret: string
): Promise<boolean> {
  const { webhookId, webhookTimestamp, webhookSignature } = headers;

  if (!webhookId || !webhookTimestamp || !webhookSignature) {
    console.log("[webhook] Missing required headers:", { webhookId: !!webhookId, webhookTimestamp: !!webhookTimestamp, webhookSignature: !!webhookSignature });
    return false;
  }

  // Extract the actual secret (remove "v1,whsec_" prefix if present)
  let secretBytes: Uint8Array;
  if (secret.startsWith("v1,whsec_")) {
    const secretBase64 = secret.slice("v1,whsec_".length);
    secretBytes = Uint8Array.from(atob(secretBase64), c => c.charCodeAt(0));
  } else if (secret.startsWith("whsec_")) {
    const secretBase64 = secret.slice("whsec_".length);
    secretBytes = Uint8Array.from(atob(secretBase64), c => c.charCodeAt(0));
  } else {
    secretBytes = new TextEncoder().encode(secret);
  }

  // Build the signed content
  const signedContent = `${webhookId}.${webhookTimestamp}.${body}`;

  // Compute HMAC SHA-256
  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBytes = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(signedContent)
  );
  const computedSignature = btoa(String.fromCharCode(...new Uint8Array(signatureBytes)));

  // webhook-signature can have multiple signatures: "v1,sig1 v1,sig2"
  const signatures = webhookSignature.split(" ");
  for (const sig of signatures) {
    const [version, sigValue] = sig.split(",");
    if (version === "v1" && sigValue === computedSignature) {
      return true;
    }
  }

  console.log("[webhook] Signature mismatch. Expected:", computedSignature);
  return false;
}
