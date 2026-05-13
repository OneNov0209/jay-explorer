export interface NetworkConfig {
  id: string;
  name: string;
  displayName: string;
  logo: string;
  chainType: "cosmos";
  type: "Mainnet" | "Testnet";
  rpcs: string[];
  apis: string[];
  endpoints: Array<{
    name: string;
    rpc?: string;
    rest?: string;
    grpc?: string;
    p2p?: string;
  }>;
  chainId: string;
  denom: string;
  coinDenom: string;
  tokenDecimals: number;
  prefix: string;
  bech32Config: {
    bech32PrefixAccAddr: string;
    bech32PrefixAccPub: string;
    bech32PrefixValAddr: string;
    bech32PrefixValPub: string;
    bech32PrefixConsAddr: string;
    bech32PrefixConsPub: string;
  };
  bip44: { coinType: number };
  coinType: number;
  currencies: Array<{
    coinDenom: string;
    coinMinimalDenom: string;
    coinDecimals: number;
    coinGeckoId: string;
  }>;
  feeCurrencies: Array<{
    coinDenom: string;
    coinMinimalDenom: string;
    coinDecimals: number;
    coinGeckoId: string;
    gasPriceStep: { low: number; average: number; high: number };
  }>;
  stakeCurrency: {
    coinDenom: string;
    coinMinimalDenom: string;
    coinDecimals: number;
    coinGeckoId: string;
  };
  blockTime: number;
  features: string[];
}

export const jayNetwork: NetworkConfig = {
  id: "jaynetwork",
  name: "jaynetwork",
  displayName: "Jay Network",
  logo: "https://raw.githubusercontent.com/bbtccore/thejaynetwork/refs/heads/master/chain-registry/thejaynetwork/logo.png",
  chainType: "cosmos",
  type: "Mainnet",
  rpcs: [
    "https://rpc-jay.onenov.xyz",
    "https://rpc-jayn.winnode.xyz",
    "http://152.53.195.5:26657",
    "http://152.53.195.105:26657",
    "http://152.53.194.128:26657",
  ],
  apis: [
    "https://api-jay.onenov.xyz",
    "https://api-jayn.winnode.xyz",
    "http://152.53.195.5:1317",
    "http://152.53.195.105:1317",
    "http://152.53.194.128:1317",
  ],
  endpoints: [
    {
      name: "OneNov",
      rpc: "https://rpc-jay.onenov.xyz",
      rest: "https://api-jay.onenov.xyz",
    },
    {
      name: "WinNode",
      rpc: "https://rpc-jayn.winnode.xyz",
      rest: "https://api-jayn.winnode.xyz",
      grpc: "https://grpc-jayn.winnode.xyz",
    },
    {
      name: "jay-validator-1",
      rpc: "http://152.53.195.5:26657",
      rest: "http://152.53.195.5:1317",
      grpc: "152.53.195.5:9090",
      p2p: "152.53.195.5:26656",
    },
    {
      name: "jay-validator-2",
      rpc: "http://152.53.195.105:26657",
      rest: "http://152.53.195.105:1317",
      grpc: "152.53.195.105:9090",
      p2p: "152.53.195.105:26656",
    },
    {
      name: "jay-validator-3",
      rpc: "http://152.53.194.128:26657",
      rest: "http://152.53.194.128:1317",
      grpc: "152.53.194.128:9090",
      p2p: "152.53.194.128:26656",
    },
  ],
  chainId: "thejaynetwork",
  denom: "ujay",
  coinDenom: "JAY",
  tokenDecimals: 6,
  prefix: "yjay",
  bech32Config: {
    bech32PrefixAccAddr: "yjay",
    bech32PrefixAccPub: "yjaypub",
    bech32PrefixValAddr: "yjayvaloper",
    bech32PrefixValPub: "yjayvaloperpub",
    bech32PrefixConsAddr: "yjayvalcons",
    bech32PrefixConsPub: "yjayvalconspub",
  },
  bip44: { coinType: 118 },
  coinType: 118,
  currencies: [
    { coinDenom: "JAY", coinMinimalDenom: "ujay", coinDecimals: 6, coinGeckoId: "unknown" },
  ],
  feeCurrencies: [
    {
      coinDenom: "JAY",
      coinMinimalDenom: "ujay",
      coinDecimals: 6,
      coinGeckoId: "unknown",
      gasPriceStep: { low: 0.01, average: 0.025, high: 0.03 },
    },
  ],
  stakeCurrency: {
    coinDenom: "JAY",
    coinMinimalDenom: "ujay",
    coinDecimals: 6,
    coinGeckoId: "unknown",
  },
  blockTime: 6,
  features: ["cosmwasm", "ibc", "governance", "staking", "distribution"],
};

export const networks: NetworkConfig[] = [jayNetwork];
export const defaultNetwork = jayNetwork;
