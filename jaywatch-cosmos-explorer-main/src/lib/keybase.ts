// Resolve a Keybase avatar URL from a 16-char hex identity.
// Cached in-memory and via sessionStorage to avoid re-fetching.
const memCache = new Map<string, string | null>();

export async function getKeybaseAvatar(identity?: string): Promise<string | null> {
  if (!identity || identity.length !== 16) return null;
  if (memCache.has(identity)) return memCache.get(identity)!;
  if (typeof window !== "undefined") {
    const cached = sessionStorage.getItem(`kb:${identity}`);
    if (cached !== null) {
      const v = cached === "" ? null : cached;
      memCache.set(identity, v);
      return v;
    }
  }
  try {
    const res = await fetch(
      `https://keybase.io/_/api/1.0/user/lookup.json?key_suffix=${identity}&fields=pictures`,
    );
    const j = await res.json();
    const url: string | null =
      j?.them?.[0]?.pictures?.primary?.url ?? null;
    memCache.set(identity, url);
    if (typeof window !== "undefined") {
      sessionStorage.setItem(`kb:${identity}`, url ?? "");
    }
    return url;
  } catch {
    memCache.set(identity, null);
    return null;
  }
}
