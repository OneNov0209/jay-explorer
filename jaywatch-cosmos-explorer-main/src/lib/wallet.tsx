import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { defaultNetwork } from "@/data/networks";
import { toast } from "sonner";

interface WalletState {
  address: string | null;
  name: string | null;
  connecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const Ctx = createContext<WalletState | null>(null);

declare global {
  interface Window {
    keplr?: any;
    getOfflineSigner?: any;
  }
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const connect = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (!window.keplr) {
      toast.error("Keplr wallet not found", { description: "Install Keplr extension first." });
      window.open("https://www.keplr.app/get", "_blank");
      return;
    }
    setConnecting(true);
    try {
      try {
        await window.keplr.experimentalSuggestChain({
          chainId: defaultNetwork.chainId,
          chainName: defaultNetwork.displayName,
          rpc: defaultNetwork.rpcs[0],
          rest: defaultNetwork.apis[0],
          bip44: defaultNetwork.bip44,
          bech32Config: defaultNetwork.bech32Config,
          currencies: defaultNetwork.currencies,
          feeCurrencies: defaultNetwork.feeCurrencies,
          stakeCurrency: defaultNetwork.stakeCurrency,
          features: defaultNetwork.features,
        });
      } catch (e) {
        console.warn("suggestChain failed", e);
      }
      await window.keplr.enable(defaultNetwork.chainId);
      const key = await window.keplr.getKey(defaultNetwork.chainId);
      setAddress(key.bech32Address);
      setName(key.name);
      localStorage.setItem("jay-wallet", "keplr");
      toast.success(`Connected as ${key.name}`);
    } catch (e: any) {
      toast.error("Connection failed", { description: e?.message ?? String(e) });
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    setName(null);
    localStorage.removeItem("jay-wallet");
    toast("Wallet disconnected");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem("jay-wallet") === "keplr" && window.keplr) {
      connect();
    }
    const handler = () => {
      if (localStorage.getItem("jay-wallet") === "keplr") connect();
    };
    window.addEventListener("keplr_keystorechange", handler);
    return () => window.removeEventListener("keplr_keystorechange", handler);
  }, [connect]);

  return (
    <Ctx.Provider value={{ address, name, connecting, connect, disconnect }}>
      {children}
    </Ctx.Provider>
  );
}

export function useWallet(): WalletState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWallet must be inside WalletProvider");
  return v;
}
