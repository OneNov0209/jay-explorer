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
    "https://pixture.thejaynetwork.com/rpc",
    "https://rpc.cosmos.directory/thejaynetwork",
  ],
  apis: [
    "https://api-jay.onenov.xyz",
    "https://api-jayn.winnode.xyz",
    "https://pixture.thejaynetwork.com/rest",
    "https://rest.cosmos.directory/thejaynetwork",
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
      name: "jay-official",
      rpc: "https://pixture.thejaynetwork.com/rpc",
      rest: "https://pixture.thejaynetwork.com/rest",
    },
    {
      name: "cosmos-directory",
      rpc: "https://rpc.cosmos.directory/thejaynetwork",
      rest: "https://rest.cosmos.directory/thejaynetwork",
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
