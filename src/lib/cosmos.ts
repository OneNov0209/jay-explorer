import { defaultNetwork } from "@/data/networks";

const RPC = defaultNetwork.rpcs[0];
const API = defaultNetwork.apis[0];

async function jget<T = any>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function firstOk<T = any>(bases: string[], path: string): Promise<T> {
  let lastError: unknown;
  for (const base of bases) {
    try {
      return await jget<T>(`${base}${path}`);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("All endpoints unavailable");
}

// ---------------- RPC (Tendermint) ----------------
export const rpc = {
  status: () => firstOk(defaultNetwork.rpcs, "/status"),
  netInfo: () => firstOk(defaultNetwork.rpcs, "/net_info"),
  block: (height?: number | string) =>
    firstOk(defaultNetwork.rpcs, height ? `/block?height=${height}` : "/block"),
  blockchain: (minHeight: number, maxHeight: number) =>
    firstOk(defaultNetwork.rpcs, `/blockchain?minHeight=${minHeight}&maxHeight=${maxHeight}`),
  blockResults: (height: number | string) =>
    firstOk(defaultNetwork.rpcs, `/block_results?height=${height}`),
  validators: (height?: number | string, page = 1, perPage = 100) =>
    firstOk(
      defaultNetwork.rpcs,
      `/validators?${height ? `height=${height}&` : ""}page=${page}&per_page=${perPage}`,
    ),
  tx: (hash: string) => firstOk(defaultNetwork.rpcs, `/tx?hash=0x${hash.replace(/^0x/, "")}`),
  txSearch: (query: string, page = 1, perPage = 30, orderBy: "asc" | "desc" = "desc") =>
    firstOk(
      defaultNetwork.rpcs,
      `/tx_search?query="${encodeURIComponent(query)}"&page=${page}&per_page=${perPage}&order_by="${orderBy}"`,
    ),
  abciInfo: () => firstOk(defaultNetwork.rpcs, "/abci_info"),
  consensusParams: () => firstOk(defaultNetwork.rpcs, "/consensus_params"),
};

// ---------------- REST (Cosmos SDK LCD) ----------------
export const lcd = {
  nodeInfo: () => firstOk(defaultNetwork.apis, "/cosmos/base/tendermint/v1beta1/node_info"),
  syncing: () => firstOk(defaultNetwork.apis, "/cosmos/base/tendermint/v1beta1/syncing"),
  latestBlock: () => firstOk(defaultNetwork.apis, "/cosmos/base/tendermint/v1beta1/blocks/latest"),
  validatorsAll: (status = "BOND_STATUS_BONDED") =>
    firstOk(
      defaultNetwork.apis,
      `/cosmos/staking/v1beta1/validators?status=${status}&pagination.limit=500`,
    ),
  validator: (addr: string) =>
    firstOk(defaultNetwork.apis, `/cosmos/staking/v1beta1/validators/${addr}`),
  validatorDelegations: (addr: string) =>
    firstOk(defaultNetwork.apis, `/cosmos/staking/v1beta1/validators/${addr}/delegations?pagination.limit=50`),
  validatorSelfDelegation: (valAddr: string, delAddr: string) =>
    firstOk(
      defaultNetwork.apis,
      `/cosmos/staking/v1beta1/validators/${valAddr}/delegations/${delAddr}`,
    ),
  pool: () => firstOk(defaultNetwork.apis, "/cosmos/staking/v1beta1/pool"),
  stakingParams: () => firstOk(defaultNetwork.apis, "/cosmos/staking/v1beta1/params"),
  slashingParams: () => firstOk(defaultNetwork.apis, "/cosmos/slashing/v1beta1/params"),
  govParams: (paramsType: "voting" | "tallying" | "deposit") =>
    firstOk(defaultNetwork.apis, `/cosmos/gov/v1beta1/params/${paramsType}`),
  distributionParams: () => firstOk(defaultNetwork.apis, "/cosmos/distribution/v1beta1/params"),
  mintParams: () => firstOk(defaultNetwork.apis, "/cosmos/mint/v1beta1/params"),
  inflation: () => firstOk(defaultNetwork.apis, "/cosmos/mint/v1beta1/inflation"),
  annualProvisions: () => firstOk(defaultNetwork.apis, "/cosmos/mint/v1beta1/annual_provisions"),
  supply: () => firstOk(defaultNetwork.apis, "/cosmos/bank/v1beta1/supply"),
  balance: (addr: string) =>
    firstOk(defaultNetwork.apis, `/cosmos/bank/v1beta1/balances/${addr}`),
  delegations: (addr: string) =>
    firstOk(defaultNetwork.apis, `/cosmos/staking/v1beta1/delegations/${addr}`),
  unbondings: (addr: string) =>
    firstOk(defaultNetwork.apis, `/cosmos/staking/v1beta1/delegators/${addr}/unbonding_delegations`),
  rewards: (addr: string) =>
    firstOk(defaultNetwork.apis, `/cosmos/distribution/v1beta1/delegators/${addr}/rewards`),
  proposals: () =>
    firstOk(defaultNetwork.apis, "/cosmos/gov/v1beta1/proposals?pagination.limit=100&pagination.reverse=true"),
  proposal: (id: string) => firstOk(defaultNetwork.apis, `/cosmos/gov/v1beta1/proposals/${id}`),
  proposalTally: (id: string) =>
    firstOk(defaultNetwork.apis, `/cosmos/gov/v1beta1/proposals/${id}/tally`),
  proposalVotes: (id: string, limit = 200) =>
    firstOk(defaultNetwork.apis, `/cosmos/gov/v1beta1/proposals/${id}/votes?pagination.limit=${limit}&pagination.reverse=true`),
  proposalDeposits: (id: string) =>
    firstOk(defaultNetwork.apis, `/cosmos/gov/v1beta1/proposals/${id}/deposits`),
  signingInfos: () =>
    firstOk(defaultNetwork.apis, "/cosmos/slashing/v1beta1/signing_infos?pagination.limit=500"),
  signingInfo: (consAddr: string) =>
    firstOk(defaultNetwork.apis, `/cosmos/slashing/v1beta1/signing_infos/${consAddr}`),
  validatorCommission: (valAddr: string) =>
    firstOk(
      defaultNetwork.apis,
      `/cosmos/distribution/v1beta1/validators/${valAddr}/commission`,
    ),
  validatorOutstandingRewards: (valAddr: string) =>
    firstOk(
      defaultNetwork.apis,
      `/cosmos/distribution/v1beta1/validators/${valAddr}/outstanding_rewards`,
    ),
  delegationReward: (delAddr: string, valAddr: string) =>
    firstOk(
      defaultNetwork.apis,
      `/cosmos/distribution/v1beta1/delegators/${delAddr}/rewards/${valAddr}`,
    ),
};

export async function safe<T>(p: Promise<T>, fallback: T | null = null): Promise<T | null> {
  try {
    return await p;
  } catch (e) {
    console.warn("API error", e);
    return fallback;
  }
}

export { RPC, API };
