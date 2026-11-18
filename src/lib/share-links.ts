// Links people pass around. Framework-free and unit-tested: a wrong link here breaks the whole loop.
// Secrets (client and invite tokens) go in the #fragment: browsers never send it to the server,
// so it stays out of logs, analytics and link previews (docs/conventions.md, Routes).

/** Client link: opens the workplace panel on any device. Keep it to yourself. */
export function buildClientUrl(origin: string, slug: string, clientToken: string) {
  return `${origin}/w/${encodeURIComponent(slug)}/manage#${encodeURIComponent(clientToken)}`;
}

/** Invite link: one per person, sent privately (WhatsApp). */
export function buildInviteUrl(origin: string, slug: string, inviteToken: string) {
  return `${origin}/w/${encodeURIComponent(slug)}/invite#${encodeURIComponent(inviteToken)}`;
}

/** Reads a token back from location.hash ("#abc" → "abc"); empty when missing. */
export function readTokenFromHash(hash: string) {
  try {
    return decodeURIComponent(hash.replace(/^#/, '')).trim();
  } catch {
    return '';
  }
}

/** "adsum.gr1618.io/w/k3v2kw2n": what people see, without the protocol. */
export function displayUrl(url: string) {
  return url.replace(/^https?:\/\//, '');
}

/** Opens WhatsApp (app on phones, web elsewhere) with the message ready to send. */
export function buildWhatsAppUrl(message: string) {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
