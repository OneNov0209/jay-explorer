import {
  SigningStargateClient,
  GasPrice,
  defaultRegistryTypes,
  coins,
} from "@cosmjs/stargate";
import { Registry, type EncodeObject } from "@cosmjs/proto-signing";
import { MsgVote, MsgDeposit, MsgSubmitProposal } from "cosmjs-types/cosmos/gov/v1beta1/tx";
import { MsgTransfer } from "cosmjs-types/ibc/applications/transfer/v1/tx";
import { MsgMultiSend } from "cosmjs-types/cosmos/bank/v1beta1/tx";
import {
  MsgCreateValidator,
  MsgEditValidator,
} from "cosmjs-types/cosmos/staking/v1beta1/tx";
import { MsgUnjail } from "cosmjs-types/cosmos/slashing/v1beta1/tx";
import {
  MsgSetWithdrawAddress,
  MsgFundCommunityPool,
} from "cosmjs-types/cosmos/distribution/v1beta1/tx";
import {
  MsgGrant,
  MsgRevoke,
  MsgExec,
} from "cosmjs-types/cosmos/authz/v1beta1/tx";
import {
  MsgGrantAllowance,
  MsgRevokeAllowance,
} from "cosmjs-types/cosmos/feegrant/v1beta1/tx";
import {
  MsgStoreCode,
  MsgInstantiateContract,
  MsgInstantiateContract2,
  MsgExecuteContract,
  MsgMigrateContract,
  MsgUpdateAdmin,
  MsgClearAdmin,
} from "cosmjs-types/cosmwasm/wasm/v1/tx";
import { defaultNetwork } from "@/data/networks";

export type FeeTier = "low" | "average" | "high";

export const FEE_TIERS: Record<FeeTier, number> = {
  low: defaultNetwork.feeCurrencies[0].gasPriceStep.low,
  average: defaultNetwork.feeCurrencies[0].gasPriceStep.average,
  high: defaultNetwork.feeCurrencies[0].gasPriceStep.high,
};

const GAS_LIMITS = {
  send: 100_000,
  multisend: 150_000,
  delegate: 250_000,
  undelegate: 300_000,
  redelegate: 350_000,
  createValidator: 350_000,
  editValidator: 200_000,
  unjail: 150_000,
  vote: 200_000,
  withdraw: 180_000, // per-validator extra adds ~80k
  withdrawCommission: 200_000,
  setWithdrawAddress: 120_000,
  fundCommunityPool: 150_000,
  ibcTransfer: 250_000,
  deposit: 200_000,
  submitProposal: 400_000,
  authzGrant: 200_000,
  authzRevoke: 150_000,
  authzExec: 250_000,
  feegrantGrant: 180_000,
  feegrantRevoke: 130_000,
  wasmStore: 3_000_000,
  wasmInstantiate: 500_000,
  wasmExecute: 350_000,
  wasmMigrate: 400_000,
  wasmAdmin: 150_000,
};

export function estimateFee(tier: FeeTier, gas: number) {
  const price = FEE_TIERS[tier];
  const amount = Math.ceil(gas * price);
  return {
    amount: coins(amount, defaultNetwork.denom),
    gas: String(gas),
    raw: amount,
    gasNum: gas,
  };
}

const EXTRA_TYPES: Array<[string, any]> = [
  ["/cosmos.gov.v1beta1.MsgVote", MsgVote],
  ["/cosmos.gov.v1beta1.MsgDeposit", MsgDeposit],
  ["/cosmos.gov.v1beta1.MsgSubmitProposal", MsgSubmitProposal],
  ["/ibc.applications.transfer.v1.MsgTransfer", MsgTransfer],
  ["/cosmos.bank.v1beta1.MsgMultiSend", MsgMultiSend],
  ["/cosmos.staking.v1beta1.MsgCreateValidator", MsgCreateValidator],
  ["/cosmos.staking.v1beta1.MsgEditValidator", MsgEditValidator],
  ["/cosmos.slashing.v1beta1.MsgUnjail", MsgUnjail],
  ["/cosmos.distribution.v1beta1.MsgSetWithdrawAddress", MsgSetWithdrawAddress],
  ["/cosmos.distribution.v1beta1.MsgFundCommunityPool", MsgFundCommunityPool],
  ["/cosmos.authz.v1beta1.MsgGrant", MsgGrant],
  ["/cosmos.authz.v1beta1.MsgRevoke", MsgRevoke],
  ["/cosmos.authz.v1beta1.MsgExec", MsgExec],
  ["/cosmos.feegrant.v1beta1.MsgGrantAllowance", MsgGrantAllowance],
  ["/cosmos.feegrant.v1beta1.MsgRevokeAllowance", MsgRevokeAllowance],
  ["/cosmwasm.wasm.v1.MsgStoreCode", MsgStoreCode],
  ["/cosmwasm.wasm.v1.MsgInstantiateContract", MsgInstantiateContract],
  ["/cosmwasm.wasm.v1.MsgInstantiateContract2", MsgInstantiateContract2],
  ["/cosmwasm.wasm.v1.MsgExecuteContract", MsgExecuteContract],
  ["/cosmwasm.wasm.v1.MsgMigrateContract", MsgMigrateContract],
  ["/cosmwasm.wasm.v1.MsgUpdateAdmin", MsgUpdateAdmin],
  ["/cosmwasm.wasm.v1.MsgClearAdmin", MsgClearAdmin],
];

async function getSigningClient(tier: FeeTier) {
  const w = window as any;
  if (!w.keplr) throw new Error("Keplr wallet not found");
  await w.keplr.enable(defaultNetwork.chainId);
  const signer = w.keplr.getOfflineSigner(defaultNetwork.chainId);
  const registry = new Registry(defaultRegistryTypes);
  for (const [url, type] of EXTRA_TYPES) registry.register(url, type);
  const gasPrice = GasPrice.fromString(`${FEE_TIERS[tier]}${defaultNetwork.denom}`);
  return SigningStargateClient.connectWithSigner(defaultNetwork.rpcs[0], signer, {
    gasPrice,
    registry,
  });
}

/** Generic broadcast — sign and broadcast arbitrary messages. */
export async function broadcastMsgs(
  signer: string,
  msgs: EncodeObject[],
  tier: FeeTier,
  gas: number,
  memo = "",
) {
  const client = await getSigningClient(tier);
  const fee = estimateFee(tier, gas);
  return client.signAndBroadcast(signer, msgs, fee, memo);
}

export async function sendTokens(
  from: string,
  to: string,
  amountUjay: string,
  tier: FeeTier,
  memo = "",
) {
  const client = await getSigningClient(tier);
  const fee = estimateFee(tier, GAS_LIMITS.send);
  return client.sendTokens(from, to, coins(amountUjay, defaultNetwork.denom), fee, memo);
}

export async function delegate(
  delegator: string,
  validator: string,
  amountUjay: string,
  tier: FeeTier,
  memo = "",
) {
  const client = await getSigningClient(tier);
  const fee = estimateFee(tier, GAS_LIMITS.delegate);
  const msg = {
    typeUrl: "/cosmos.staking.v1beta1.MsgDelegate",
    value: {
      delegatorAddress: delegator,
      validatorAddress: validator,
      amount: { denom: defaultNetwork.denom, amount: amountUjay },
    },
  };
  return client.signAndBroadcast(delegator, [msg], fee, memo);
}

export async function undelegate(
  delegator: string,
  validator: string,
  amountUjay: string,
  tier: FeeTier,
  memo = "",
) {
  const client = await getSigningClient(tier);
  const fee = estimateFee(tier, GAS_LIMITS.undelegate);
  const msg = {
    typeUrl: "/cosmos.staking.v1beta1.MsgUndelegate",
    value: {
      delegatorAddress: delegator,
      validatorAddress: validator,
      amount: { denom: defaultNetwork.denom, amount: amountUjay },
    },
  };
  return client.signAndBroadcast(delegator, [msg], fee, memo);
}

export async function redelegate(
  delegator: string,
  srcValidator: string,
  dstValidator: string,
  amountUjay: string,
  tier: FeeTier,
  memo = "",
) {
  const client = await getSigningClient(tier);
  const fee = estimateFee(tier, GAS_LIMITS.redelegate);
  const msg = {
    typeUrl: "/cosmos.staking.v1beta1.MsgBeginRedelegate",
    value: {
      delegatorAddress: delegator,
      validatorSrcAddress: srcValidator,
      validatorDstAddress: dstValidator,
      amount: { denom: defaultNetwork.denom, amount: amountUjay },
    },
  };
  return client.signAndBroadcast(delegator, [msg], fee, memo);
}

export async function withdrawCommission(
  validatorOperator: string,
  signer: string,
  tier: FeeTier,
  memo = "",
) {
  const client = await getSigningClient(tier);
  const fee = estimateFee(tier, GAS_LIMITS.withdrawCommission);
  const msg = {
    typeUrl: "/cosmos.distribution.v1beta1.MsgWithdrawValidatorCommission",
    value: { validatorAddress: validatorOperator },
  };
  return client.signAndBroadcast(signer, [msg], fee, memo);
}

export async function voteProposal(
  voter: string,
  proposalId: string,
  option: 1 | 2 | 3 | 4, // YES NO ABSTAIN VETO
  tier: FeeTier,
  memo = "",
) {
  const client = await getSigningClient(tier);
  const fee = estimateFee(tier, GAS_LIMITS.vote);
  const msg = {
    typeUrl: "/cosmos.gov.v1beta1.MsgVote",
    value: { proposalId: BigInt(proposalId), voter, option },
  };
  return client.signAndBroadcast(voter, [msg], fee, memo);
}

export async function depositProposal(
  depositor: string,
  proposalId: string,
  amountUjay: string,
  tier: FeeTier,
  memo = "",
) {
  const client = await getSigningClient(tier);
  const fee = estimateFee(tier, GAS_LIMITS.deposit);
  const msg = {
    typeUrl: "/cosmos.gov.v1beta1.MsgDeposit",
    value: {
      proposalId: BigInt(proposalId),
      depositor,
      amount: coins(amountUjay, defaultNetwork.denom),
    },
  };
  return client.signAndBroadcast(depositor, [msg], fee, memo);
}

export async function withdrawRewards(
  delegator: string,
  validatorAddrs: string[],
  tier: FeeTier,
  memo = "",
) {
  if (validatorAddrs.length === 0) throw new Error("No validators with rewards");
  const client = await getSigningClient(tier);
  const fee = estimateFee(tier, GAS_LIMITS.withdraw + validatorAddrs.length * 80_000);
  const msgs = validatorAddrs.map((v) => ({
    typeUrl: "/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward",
    value: { delegatorAddress: delegator, validatorAddress: v },
  }));
  return client.signAndBroadcast(delegator, msgs, fee, memo);
}

export const VOTE_OPTIONS = [
  { label: "Yes", value: 1 as const, color: "bg-success" },
  { label: "No", value: 3 as const, color: "bg-destructive" },
  { label: "No With Veto", value: 4 as const, color: "bg-warning" },
  { label: "Abstain", value: 2 as const, color: "bg-muted-foreground" },
];

export interface IbcTransferParams {
  sender: string;
  receiver: string;
  amountUjay: string;
  sourceChannel: string;
  sourcePort?: string;
  denom?: string;
  timeoutMinutes?: number;
  memo?: string;
}

export async function ibcTransfer(p: IbcTransferParams, tier: FeeTier) {
  const client = await getSigningClient(tier);
  const fee = estimateFee(tier, GAS_LIMITS.ibcTransfer);
  const timeoutNs =
    BigInt(Date.now() + (p.timeoutMinutes ?? 10) * 60_000) * 1_000_000n;
  const msg = {
    typeUrl: "/ibc.applications.transfer.v1.MsgTransfer",
    value: {
      sourcePort: p.sourcePort ?? "transfer",
      sourceChannel: p.sourceChannel,
      token: { denom: p.denom ?? defaultNetwork.denom, amount: p.amountUjay },
      sender: p.sender,
      receiver: p.receiver,
      timeoutHeight: undefined,
      timeoutTimestamp: timeoutNs,
      memo: p.memo ?? "",
    },
  };
  return client.signAndBroadcast(p.sender, [msg], fee, p.memo ?? "");
}

/* =========================================================
   Bank
   ========================================================= */

export interface MultiSendOutput {
  address: string;
  amountUjay: string;
}
export async function multiSend(
  sender: string,
  outputs: MultiSendOutput[],
  tier: FeeTier,
  memo = "",
) {
  if (outputs.length === 0) throw new Error("No outputs");
  const total = outputs.reduce((s, o) => s + BigInt(o.amountUjay), 0n);
  const msg = {
    typeUrl: "/cosmos.bank.v1beta1.MsgMultiSend",
    value: {
      inputs: [{ address: sender, coins: coins(total.toString(), defaultNetwork.denom) }],
      outputs: outputs.map((o) => ({
        address: o.address,
        coins: coins(o.amountUjay, defaultNetwork.denom),
      })),
    },
  };
  return broadcastMsgs(sender, [msg], tier, GAS_LIMITS.multisend, memo);
}

/* =========================================================
   Staking — Create / Edit Validator
   ========================================================= */

export interface CreateValidatorParams {
  delegatorAddress: string;       // jay1...
  validatorAddress: string;       // jayvaloper1...
  pubkeyEd25519Base64: string;    // tendermint consensus pubkey
  moniker: string;
  identity?: string;
  website?: string;
  securityContact?: string;
  details?: string;
  commissionRate: string;         // e.g. "0.10"
  commissionMaxRate: string;      // e.g. "0.20"
  commissionMaxChangeRate: string;// e.g. "0.01"
  minSelfDelegationUjay: string;
  selfDelegationUjay: string;
}

function decToProto(dec: string): string {
  // Convert "0.10" -> "100000000000000000" (1e18 scale)
  const [w = "0", f = ""] = dec.split(".");
  const frac = (f + "0".repeat(18)).slice(0, 18);
  return (BigInt(w) * 10n ** 18n + BigInt(frac || "0")).toString();
}

export async function createValidator(p: CreateValidatorParams, tier: FeeTier, memo = "") {
  const msg = {
    typeUrl: "/cosmos.staking.v1beta1.MsgCreateValidator",
    value: {
      description: {
        moniker: p.moniker,
        identity: p.identity ?? "",
        website: p.website ?? "",
        securityContact: p.securityContact ?? "",
        details: p.details ?? "",
      },
      commission: {
        rate: decToProto(p.commissionRate),
        maxRate: decToProto(p.commissionMaxRate),
        maxChangeRate: decToProto(p.commissionMaxChangeRate),
      },
      minSelfDelegation: p.minSelfDelegationUjay,
      delegatorAddress: p.delegatorAddress,
      validatorAddress: p.validatorAddress,
      pubkey: {
        typeUrl: "/cosmos.crypto.ed25519.PubKey",
        value: new Uint8Array([
          0x0a,
          0x20,
          ...Uint8Array.from(atob(p.pubkeyEd25519Base64), (c) => c.charCodeAt(0)),
        ]),
      },
      value: { denom: defaultNetwork.denom, amount: p.selfDelegationUjay },
    },
  };
  return broadcastMsgs(p.delegatorAddress, [msg], tier, GAS_LIMITS.createValidator, memo);
}

export interface EditValidatorParams {
  validatorAddress: string;
  moniker?: string;
  identity?: string;
  website?: string;
  securityContact?: string;
  details?: string;
  commissionRate?: string;       // dec
  minSelfDelegationUjay?: string;
  signer: string;                 // delegator address controlling the validator
}

const DO_NOT_MODIFY = "[do-not-modify]";

export async function editValidator(p: EditValidatorParams, tier: FeeTier, memo = "") {
  const msg = {
    typeUrl: "/cosmos.staking.v1beta1.MsgEditValidator",
    value: {
      description: {
        moniker: p.moniker ?? DO_NOT_MODIFY,
        identity: p.identity ?? DO_NOT_MODIFY,
        website: p.website ?? DO_NOT_MODIFY,
        securityContact: p.securityContact ?? DO_NOT_MODIFY,
        details: p.details ?? DO_NOT_MODIFY,
      },
      validatorAddress: p.validatorAddress,
      commissionRate: p.commissionRate ? decToProto(p.commissionRate) : "",
      minSelfDelegation: p.minSelfDelegationUjay ?? "",
    },
  };
  return broadcastMsgs(p.signer, [msg], tier, GAS_LIMITS.editValidator, memo);
}

/* =========================================================
   Slashing — Unjail
   ========================================================= */

export async function unjail(
  validatorAddress: string,
  signer: string,
  tier: FeeTier,
  memo = "",
) {
  const msg = {
    typeUrl: "/cosmos.slashing.v1beta1.MsgUnjail",
    value: { validatorAddr: validatorAddress },
  };
  return broadcastMsgs(signer, [msg], tier, GAS_LIMITS.unjail, memo);
}

/* =========================================================
   Distribution — Set Withdraw Address / Fund Community Pool
   ========================================================= */

export async function setWithdrawAddress(
  delegator: string,
  withdrawAddress: string,
  tier: FeeTier,
  memo = "",
) {
  const msg = {
    typeUrl: "/cosmos.distribution.v1beta1.MsgSetWithdrawAddress",
    value: { delegatorAddress: delegator, withdrawAddress },
  };
  return broadcastMsgs(delegator, [msg], tier, GAS_LIMITS.setWithdrawAddress, memo);
}

export async function fundCommunityPool(
  depositor: string,
  amountUjay: string,
  tier: FeeTier,
  memo = "",
) {
  const msg = {
    typeUrl: "/cosmos.distribution.v1beta1.MsgFundCommunityPool",
    value: {
      depositor,
      amount: coins(amountUjay, defaultNetwork.denom),
    },
  };
  return broadcastMsgs(depositor, [msg], tier, GAS_LIMITS.fundCommunityPool, memo);
}

/* =========================================================
   Governance — Submit Proposal
   ========================================================= */

export async function submitTextProposal(
  proposer: string,
  title: string,
  description: string,
  initialDepositUjay: string,
  tier: FeeTier,
  memo = "",
) {
  const { TextProposal } = await import("cosmjs-types/cosmos/gov/v1beta1/gov");
  const contentValue = TextProposal.encode(
    TextProposal.fromPartial({ title, description }),
  ).finish();
  return submitProposalAny(
    proposer,
    "/cosmos.gov.v1beta1.TextProposal",
    contentValue,
    initialDepositUjay,
    tier,
    memo,
  );
}

/** Submit any proposal Any payload (already encoded). */
export async function submitProposalAny(
  proposer: string,
  contentTypeUrl: string,
  contentValue: Uint8Array,
  initialDepositUjay: string,
  tier: FeeTier,
  memo = "",
) {
  const msg = {
    typeUrl: "/cosmos.gov.v1beta1.MsgSubmitProposal",
    value: {
      content: { typeUrl: contentTypeUrl, value: contentValue },
      initialDeposit: coins(initialDepositUjay, defaultNetwork.denom),
      proposer,
    },
  };
  return broadcastMsgs(proposer, [msg], tier, GAS_LIMITS.submitProposal, memo);
}

/* =========================================================
   Authz
   ========================================================= */

export interface AuthzGenericGrantParams {
  granter: string;
  grantee: string;
  msgTypeUrl: string;            // e.g. /cosmos.bank.v1beta1.MsgSend
  expirationSeconds?: number;    // unix
}

export async function authzGrantGeneric(
  p: AuthzGenericGrantParams,
  tier: FeeTier,
  memo = "",
) {
  const msg = {
    typeUrl: "/cosmos.authz.v1beta1.MsgGrant",
    value: {
      granter: p.granter,
      grantee: p.grantee,
      grant: {
        authorization: {
          typeUrl: "/cosmos.authz.v1beta1.GenericAuthorization",
          value: new Uint8Array([0x0a, p.msgTypeUrl.length, ...new TextEncoder().encode(p.msgTypeUrl)]),
        },
        expiration: p.expirationSeconds
          ? { seconds: BigInt(p.expirationSeconds), nanos: 0 }
          : undefined,
      },
    },
  };
  return broadcastMsgs(p.granter, [msg], tier, GAS_LIMITS.authzGrant, memo);
}

export async function authzRevoke(
  granter: string,
  grantee: string,
  msgTypeUrl: string,
  tier: FeeTier,
  memo = "",
) {
  const msg = {
    typeUrl: "/cosmos.authz.v1beta1.MsgRevoke",
    value: { granter, grantee, msgTypeUrl },
  };
  return broadcastMsgs(granter, [msg], tier, GAS_LIMITS.authzRevoke, memo);
}

export async function authzExec(
  grantee: string,
  msgs: { typeUrl: string; value: Uint8Array }[],
  tier: FeeTier,
  memo = "",
) {
  const msg = {
    typeUrl: "/cosmos.authz.v1beta1.MsgExec",
    value: { grantee, msgs },
  };
  return broadcastMsgs(grantee, [msg], tier, GAS_LIMITS.authzExec, memo);
}

/* =========================================================
   FeeGrant
   ========================================================= */

export async function feegrantBasic(
  granter: string,
  grantee: string,
  spendLimitUjay: string | null,
  expirationSeconds: number | null,
  tier: FeeTier,
  memo = "",
) {
  const allowance = {
    typeUrl: "/cosmos.feegrant.v1beta1.BasicAllowance",
    value: {
      spendLimit: spendLimitUjay ? coins(spendLimitUjay, defaultNetwork.denom) : [],
      expiration: expirationSeconds
        ? { seconds: BigInt(expirationSeconds), nanos: 0 }
        : undefined,
    },
  };
  const msg = {
    typeUrl: "/cosmos.feegrant.v1beta1.MsgGrantAllowance",
    value: { granter, grantee, allowance },
  };
  return broadcastMsgs(granter, [msg], tier, GAS_LIMITS.feegrantGrant, memo);
}

export async function feegrantRevoke(
  granter: string,
  grantee: string,
  tier: FeeTier,
  memo = "",
) {
  const msg = {
    typeUrl: "/cosmos.feegrant.v1beta1.MsgRevokeAllowance",
    value: { granter, grantee },
  };
  return broadcastMsgs(granter, [msg], tier, GAS_LIMITS.feegrantRevoke, memo);
}

/* =========================================================
   CosmWasm
   ========================================================= */

export async function wasmStoreCode(
  sender: string,
  wasmByteCode: Uint8Array,
  tier: FeeTier,
  memo = "",
) {
  const msg = {
    typeUrl: "/cosmwasm.wasm.v1.MsgStoreCode",
    value: { sender, wasmByteCode, instantiatePermission: undefined },
  };
  return broadcastMsgs(sender, [msg], tier, GAS_LIMITS.wasmStore, memo);
}

export async function wasmInstantiate(
  sender: string,
  codeId: string,
  label: string,
  initMsg: object,
  fundsUjay: string | null,
  admin: string | null,
  tier: FeeTier,
  memo = "",
) {
  const msg = {
    typeUrl: "/cosmwasm.wasm.v1.MsgInstantiateContract",
    value: {
      sender,
      admin: admin ?? "",
      codeId: BigInt(codeId),
      label,
      msg: new TextEncoder().encode(JSON.stringify(initMsg)),
      funds: fundsUjay ? coins(fundsUjay, defaultNetwork.denom) : [],
    },
  };
  return broadcastMsgs(sender, [msg], tier, GAS_LIMITS.wasmInstantiate, memo);
}

export async function wasmExecute(
  sender: string,
  contract: string,
  execMsg: object,
  fundsUjay: string | null,
  tier: FeeTier,
  memo = "",
) {
  const msg = {
    typeUrl: "/cosmwasm.wasm.v1.MsgExecuteContract",
    value: {
      sender,
      contract,
      msg: new TextEncoder().encode(JSON.stringify(execMsg)),
      funds: fundsUjay ? coins(fundsUjay, defaultNetwork.denom) : [],
    },
  };
  return broadcastMsgs(sender, [msg], tier, GAS_LIMITS.wasmExecute, memo);
}

export async function wasmMigrate(
  sender: string,
  contract: string,
  newCodeId: string,
  migrateMsg: object,
  tier: FeeTier,
  memo = "",
) {
  const msg = {
    typeUrl: "/cosmwasm.wasm.v1.MsgMigrateContract",
    value: {
      sender,
      contract,
      codeId: BigInt(newCodeId),
      msg: new TextEncoder().encode(JSON.stringify(migrateMsg)),
    },
  };
  return broadcastMsgs(sender, [msg], tier, GAS_LIMITS.wasmMigrate, memo);
}

export async function wasmUpdateAdmin(
  sender: string,
  contract: string,
  newAdmin: string,
  tier: FeeTier,
  memo = "",
) {
  const msg = {
    typeUrl: "/cosmwasm.wasm.v1.MsgUpdateAdmin",
    value: { sender, newAdmin, contract },
  };
  return broadcastMsgs(sender, [msg], tier, GAS_LIMITS.wasmAdmin, memo);
}

export async function wasmClearAdmin(
  sender: string,
  contract: string,
  tier: FeeTier,
  memo = "",
) {
  const msg = {
    typeUrl: "/cosmwasm.wasm.v1.MsgClearAdmin",
    value: { sender, contract },
  };
  return broadcastMsgs(sender, [msg], tier, GAS_LIMITS.wasmAdmin, memo);
}

/* =========================================================
   Catalog (for UI / menus)
   ========================================================= */

export type TxKind =
  | "send"
  | "multisend"
  | "delegate"
  | "undelegate"
  | "redelegate"
  | "createValidator"
  | "editValidator"
  | "unjail"
  | "withdrawRewards"
  | "withdrawCommission"
  | "setWithdrawAddress"
  | "fundCommunityPool"
  | "vote"
  | "deposit"
  | "submitProposal"
  | "ibcTransfer"
  | "authzGrant"
  | "authzRevoke"
  | "authzExec"
  | "feegrantGrant"
  | "feegrantRevoke"
  | "wasmStoreCode"
  | "wasmInstantiate"
  | "wasmExecute"
  | "wasmMigrate"
  | "wasmUpdateAdmin"
  | "wasmClearAdmin";

export const TX_CATALOG: { kind: TxKind; label: string; group: string }[] = [
  { kind: "send", label: "Send", group: "Bank" },
  { kind: "multisend", label: "Multi Send", group: "Bank" },
  { kind: "delegate", label: "Delegate", group: "Staking" },
  { kind: "undelegate", label: "Undelegate", group: "Staking" },
  { kind: "redelegate", label: "Redelegate", group: "Staking" },
  { kind: "createValidator", label: "Create Validator", group: "Staking" },
  { kind: "editValidator", label: "Edit Validator", group: "Staking" },
  { kind: "unjail", label: "Unjail", group: "Slashing" },
  { kind: "withdrawRewards", label: "Withdraw Rewards", group: "Distribution" },
  { kind: "withdrawCommission", label: "Withdraw Commission", group: "Distribution" },
  { kind: "setWithdrawAddress", label: "Set Withdraw Address", group: "Distribution" },
  { kind: "fundCommunityPool", label: "Fund Community Pool", group: "Distribution" },
  { kind: "vote", label: "Vote", group: "Governance" },
  { kind: "deposit", label: "Deposit", group: "Governance" },
  { kind: "submitProposal", label: "Submit Proposal", group: "Governance" },
  { kind: "ibcTransfer", label: "IBC Transfer", group: "IBC" },
  { kind: "authzGrant", label: "Authz Grant", group: "Authz" },
  { kind: "authzRevoke", label: "Authz Revoke", group: "Authz" },
  { kind: "authzExec", label: "Authz Exec", group: "Authz" },
  { kind: "feegrantGrant", label: "FeeGrant Allowance", group: "FeeGrant" },
  { kind: "feegrantRevoke", label: "FeeGrant Revoke", group: "FeeGrant" },
  { kind: "wasmStoreCode", label: "Store Code", group: "CosmWasm" },
  { kind: "wasmInstantiate", label: "Instantiate Contract", group: "CosmWasm" },
  { kind: "wasmExecute", label: "Execute Contract", group: "CosmWasm" },
  { kind: "wasmMigrate", label: "Migrate Contract", group: "CosmWasm" },
  { kind: "wasmUpdateAdmin", label: "Update Admin", group: "CosmWasm" },
  { kind: "wasmClearAdmin", label: "Clear Admin", group: "CosmWasm" },
];
