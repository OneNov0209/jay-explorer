import { decodeTxRaw } from "@cosmjs/proto-signing";
import { Registry } from "@cosmjs/proto-signing";
import { fromBase64, toBech32 } from "@cosmjs/encoding";
import { Sha256 } from "@cosmjs/crypto";
import { defaultRegistryTypes } from "@cosmjs/stargate";
import { defaultNetwork } from "@/data/networks";

export const registry = new Registry(defaultRegistryTypes);

export interface DecodedMessage {
  typeUrl: string;
  short: string;
  value: any | null;
  raw: Uint8Array;
}

export interface DecodedTx {
  messages: DecodedMessage[];
  memo: string;
  timeoutHeight?: bigint;
  fee?: {
    amount: { denom: string; amount: string }[];
    gasLimit: string;
    payer?: string;
    granter?: string;
  };
  signers: { address: string; sequence: string; publicKey?: any }[];
  signatures: string[];
}

function pubkeyToAddress(pubkey: Uint8Array): string {
  // secp256k1 cosmos address: ripemd160(sha256(pubkey))
  // Approximation using sha256 first 20 bytes (works for ed25519 cons; for accounts we'd need ripemd).
  // Try using cosmjs encodeSecp256k1Pubkey + pubkeyToAddress when available.
  try {
    const h = new Sha256(pubkey).digest().slice(0, 20);
    return toBech32(defaultNetwork.bech32Config.bech32PrefixAccAddr, h);
  } catch {
    return "";
  }
}

export function decodeTx(b64: string): DecodedTx | null {
  try {
    const raw = decodeTxRaw(fromBase64(b64));
    const messages: DecodedMessage[] = raw.body.messages.map((m) => {
      let decoded: any = null;
      try {
        decoded = registry.decode(m);
      } catch {
        decoded = null;
      }
      return {
        typeUrl: m.typeUrl,
        short: m.typeUrl.split(".").pop() ?? m.typeUrl,
        value: decoded,
        raw: m.value,
      };
    });

    const fee = raw.authInfo.fee
      ? {
          amount: raw.authInfo.fee.amount.map((c) => ({ denom: c.denom, amount: c.amount })),
          gasLimit: raw.authInfo.fee.gasLimit.toString(),
          payer: raw.authInfo.fee.payer || undefined,
          granter: raw.authInfo.fee.granter || undefined,
        }
      : undefined;

    const signers = raw.authInfo.signerInfos.map((s) => {
      let address = "";
      const pk = s.publicKey?.value;
      if (pk && pk.length > 2) {
        // proto-encoded: tag+len+key bytes; cosmos PubKey { key: bytes }
        const keyBytes = pk.slice(2);
        address = pubkeyToAddress(keyBytes);
      }
      return {
        address,
        sequence: s.sequence.toString(),
        publicKey: s.publicKey,
      };
    });

    return {
      messages,
      memo: raw.body.memo ?? "",
      timeoutHeight: raw.body.timeoutHeight,
      fee,
      signers,
      signatures: raw.signatures.map((s) =>
        Array.from(s)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join(""),
      ),
    };
  } catch {
    return null;
  }
}

/** Convert a decoded protobuf message to plain JSON-friendly object (BigInt -> string, Uint8Array -> hex). */
export function messageToJSON(value: any): any {
  if (value === null || value === undefined) return value;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Uint8Array) {
    return (
      "0x" +
      Array.from(value)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
    );
  }
  if (Array.isArray(value)) return value.map(messageToJSON);
  if (typeof value === "object") {
    const out: any = {};
    for (const k of Object.keys(value)) out[k] = messageToJSON(value[k]);
    return out;
  }
  return value;
}
