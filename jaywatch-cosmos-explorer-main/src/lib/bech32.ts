import { fromHex, toBech32 } from "@cosmjs/encoding";
import { defaultNetwork } from "@/data/networks";

/** Convert hex consensus address (e.g. block proposer_address) to validator operator bech32 */
export function hexToValoper(
  hexAddress: string,
  prefix = defaultNetwork.bech32Config.bech32PrefixValAddr,
): string {
  try {
    const clean = hexAddress.replace(/^0x/, "");
    return toBech32(prefix, fromHex(clean));
  } catch {
    return hexAddress;
  }
}

/** Convert hex consensus address to valcons bech32 */
export function hexToValcons(
  hexAddress: string,
  prefix = defaultNetwork.bech32Config.bech32PrefixConsAddr,
): string {
  try {
    const clean = hexAddress.replace(/^0x/, "");
    return toBech32(prefix, fromHex(clean));
  } catch {
    return hexAddress;
  }
}

/** Normalize a hex address to uppercase (no 0x) */
export function normalizeHex(hex: string): string {
  return hex.replace(/^0x/, "").toUpperCase();
}
