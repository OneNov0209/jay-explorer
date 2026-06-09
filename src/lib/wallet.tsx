import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { defaultNetwork } from "@/data/networks";
import { toast } from "sonner";

interface WalletState {
  address: string | null;
  name: string | null;
  connecting: boolean;
  connect: (walletType?: "keplr" | "jay") => Promise<void>;
  disconnect: () => void;
}

const Ctx = createContext<WalletState | null>(null);

declare global {
  interface Window {
    keplr?: any;
    jay?: any;
    jayWallet?: any;
    getOfflineSigner?: any;
  }
}

const KEPLR_LOGO = "https://raw.githubusercontent.com/OneNov0209/logo/refs/heads/main/keplr.png";
const JAY_LOGO = "https://raw.githubusercontent.com/bbtccore/thejaynetwork/refs/heads/master/chain-registry/thejaynetwork/logo.png";

export { KEPLR_LOGO, JAY_LOGO };

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const connect = useCallback(async (walletType: "keplr" | "jay" = "keplr") => {
    if (typeof window === "undefined") return;

    const walletKey = walletType === "jay" ? "jay" : "keplr";
    const wallet = walletType === "jay" ? (window.jayWallet || window.jay) : window.keplr;

    if (!wallet) {
      const name = walletType === "jay" ? "Jay Wallet" : "Keplr";
      toast.error(`${name} not found`, {
        description: `Install ${name} extension first.`,
      });
      if (walletType === "keplr") {
        window.open("https://www.keplr.app/get", "_blank");
      } else {
        window.open(
          "https://chromewebstore.google.com/detail/jay-wallet/gompejfhhmcbpollmkmkppaanbgcnbhg",
          "_blank",
        );
      }
      return;
    }

    setConnecting(true);
    try {
      // Suggest chain — pakai experimentalSuggestChain buat kedua wallet
      try {
        await wallet.experimentalSuggestChain({
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

      await wallet.enable(defaultNetwork.chainId);
      const key = await wallet.getKey(defaultNetwork.chainId);
      setAddress(key.bech32Address);
      setName(key.name);
      localStorage.setItem("jay-wallet-type", walletKey);
      localStorage.setItem("jay-wallet", walletKey);
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
    localStorage.removeItem("jay-wallet-type");
    toast("Wallet disconnected");
  }, []);

  // Auto-reconnect on page load
  useEffect(() => {
    if (typeof window === "undefined") return;
    const walletType = localStorage.getItem("jay-wallet-type") as "keplr" | "jay" | null;
    if (walletType) {
      const wallet =
        walletType === "jay" ? window.jayWallet || window.jay : window.keplr;
      if (wallet) {
        connect(walletType);
      }
    }

    // Keplr event listener
    const keplrHandler = () => {
      if (localStorage.getItem("jay-wallet-type") === "keplr") connect("keplr");
    };
    window.addEventListener("keplr_keystorechange", keplrHandler);

    return () => window.removeEventListener("keplr_keystorechange", keplrHandler);
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
