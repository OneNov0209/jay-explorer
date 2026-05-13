import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useWallet } from "@/lib/wallet";
import { voteProposal, withdrawRewards, withdrawCommission, depositProposal, estimateFee, type FeeTier, VOTE_OPTIONS } from "@/lib/tx";
import { defaultNetwork } from "@/data/networks";
import { formatAmount, shorten } from "@/lib/format";
import { toast } from "sonner";
import { Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

type Step = "form" | "confirming" | "result";

function FeePicker({ tier, setTier, gas }: { tier: FeeTier; setTier: (t: FeeTier) => void; gas: number }) {
  return (
    <div>
      <label className="text-xs uppercase tracking-wider text-muted-foreground">Fee</label>
      <div className="mt-1 grid grid-cols-3 gap-2">
        {(["low", "average", "high"] as FeeTier[]).map((t) => {
          const f = estimateFee(t, gas);
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTier(t)}
              className={cn(
                "rounded-lg border px-2 py-2 text-xs transition text-left",
                tier === t
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/40",
              )}
            >
              <div className="capitalize font-medium">{t}</div>
              <div className="font-mono text-[10px] text-muted-foreground mt-0.5">
                {formatAmount(f.raw, { precision: 6 })}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ResultPanel({
  txHash,
  txError,
  onClose,
  onRetry,
}: {
  txHash: string | null;
  txError: string | null;
  onClose: () => void;
  onRetry: () => void;
}) {
  return (
    <div className="py-6 flex flex-col items-center gap-3">
      {txError ? (
        <>
          <div className="h-12 w-12 rounded-full bg-destructive/15 grid place-items-center text-destructive">
            ✕
          </div>
          <div className="text-sm font-semibold">Transaction failed</div>
          <p className="text-xs text-muted-foreground text-center max-w-sm break-words">
            {txError}
          </p>
          <button
            onClick={onRetry}
            className="mt-2 px-4 py-2 rounded-lg border border-border text-sm hover:bg-accent/40"
          >
            Try again
          </button>
        </>
      ) : (
        <>
          <div className="h-12 w-12 rounded-full bg-success/15 grid place-items-center text-success">
            <Check className="h-6 w-6" />
          </div>
          <div className="text-sm font-semibold">Transaction successful</div>
          {txHash && (
            <a
              href={`/transactions/${txHash}`}
              className="text-xs font-mono text-primary hover:underline break-all text-center"
            >
              {txHash}
            </a>
          )}
          <button
            onClick={onClose}
            className="mt-2 px-4 py-2 rounded-lg bg-gradient-primary text-primary-foreground text-sm"
          >
            Done
          </button>
        </>
      )}
    </div>
  );
}

export function VoteDialog({
  open,
  onOpenChange,
  proposalId,
  proposalTitle,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  proposalId: string;
  proposalTitle?: string;
}) {
  const { address, connect } = useWallet();
  const [option, setOption] = useState<1 | 2 | 3 | 4>(1);
  const [tier, setTier] = useState<FeeTier>("average");
  const [step, setStep] = useState<Step>("form");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);

  const submit = async () => {
    if (!address) return connect();
    setStep("confirming");
    setTxError(null);
    try {
      const res = await voteProposal(address, proposalId, option, tier);
      if (res.code && res.code !== 0) throw new Error(res.rawLog || `Code ${res.code}`);
      setTxHash(res.transactionHash);
      setStep("result");
      toast.success("Vote submitted", { description: shorten(res.transactionHash, 12, 8) });
    } catch (e: any) {
      setTxError(e?.message ?? String(e));
      setStep("result");
      toast.error("Vote failed", { description: e?.message ?? String(e) });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px] bg-card/95 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle>Vote on Proposal #{proposalId}</DialogTitle>
        </DialogHeader>
        {step === "form" && (
          <div className="space-y-4">
            {proposalTitle && (
              <div className="text-sm text-muted-foreground line-clamp-2">{proposalTitle}</div>
            )}
            <div className="grid grid-cols-2 gap-2">
              {VOTE_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  onClick={() => setOption(o.value)}
                  className={cn(
                    "rounded-lg border px-3 py-3 text-sm transition flex items-center gap-2",
                    option === o.value
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/40",
                  )}
                >
                  <span className={cn("h-2.5 w-2.5 rounded-full", o.color)} />
                  {o.label}
                </button>
              ))}
            </div>
            <FeePicker tier={tier} setTier={setTier} gas={200_000} />
            <button
              onClick={submit}
              className="w-full bg-gradient-primary text-primary-foreground rounded-lg py-2.5 text-sm font-medium hover:opacity-90 shadow-glow"
            >
              {address ? "Submit Vote" : "Connect Wallet"}
            </button>
          </div>
        )}
        {step === "confirming" && (
          <div className="py-12 flex flex-col items-center gap-4">
            <Loader2 className="h-10 w-10 text-primary animate-spin" />
            <div className="text-sm text-muted-foreground">Approve in Keplr…</div>
          </div>
        )}
        {step === "result" && (
          <ResultPanel
            txHash={txHash}
            txError={txError}
            onClose={() => onOpenChange(false)}
            onRetry={() => setStep("form")}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

export function ClaimDialog({
  open,
  onOpenChange,
  validatorAddrs,
  totalRewardsUjay,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  validatorAddrs: string[];
  totalRewardsUjay: string | number;
}) {
  const { address, connect } = useWallet();
  const [tier, setTier] = useState<FeeTier>("average");
  const [step, setStep] = useState<Step>("form");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);

  const gas = 180_000 + validatorAddrs.length * 80_000;

  const submit = async () => {
    if (!address) return connect();
    if (validatorAddrs.length === 0)
      return toast.error("No rewards to claim");
    setStep("confirming");
    setTxError(null);
    try {
      const res = await withdrawRewards(address, validatorAddrs, tier);
      if (res.code && res.code !== 0) throw new Error(res.rawLog || `Code ${res.code}`);
      setTxHash(res.transactionHash);
      setStep("result");
      toast.success("Rewards claimed", { description: shorten(res.transactionHash, 12, 8) });
    } catch (e: any) {
      setTxError(e?.message ?? String(e));
      setStep("result");
      toast.error("Claim failed", { description: e?.message ?? String(e) });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px] bg-card/95 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle>Claim Staking Rewards</DialogTitle>
        </DialogHeader>
        {step === "form" && (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/30 p-4 text-center">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Total Rewards
              </div>
              <div className="text-2xl font-bold mt-1">
                {formatAmount(String(totalRewardsUjay))}
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">
                From {validatorAddrs.length} validator
                {validatorAddrs.length === 1 ? "" : "s"}
              </div>
            </div>
            <FeePicker tier={tier} setTier={setTier} gas={gas} />
            <button
              onClick={submit}
              disabled={validatorAddrs.length === 0}
              className="w-full bg-gradient-primary text-primary-foreground rounded-lg py-2.5 text-sm font-medium hover:opacity-90 shadow-glow disabled:opacity-50"
            >
              {address ? "Claim Rewards" : "Connect Wallet"}
            </button>
          </div>
        )}
        {step === "confirming" && (
          <div className="py-12 flex flex-col items-center gap-4">
            <Loader2 className="h-10 w-10 text-primary animate-spin" />
            <div className="text-sm text-muted-foreground">Approve in Keplr…</div>
          </div>
        )}
        {step === "result" && (
          <ResultPanel
            txHash={txHash}
            txError={txError}
            onClose={() => onOpenChange(false)}
            onRetry={() => setStep("form")}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}


export function WithdrawCommissionDialog({
  open,
  onOpenChange,
  validatorOperator,
  commissionUjay,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  validatorOperator: string;
  commissionUjay: string | number;
}) {
  const { address, connect } = useWallet();
  const [tier, setTier] = useState<FeeTier>("average");
  const [step, setStep] = useState<Step>("form");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);

  const submit = async () => {
    if (!address) return connect();
    setStep("confirming");
    setTxError(null);
    try {
      const res = await withdrawCommission(validatorOperator, address, tier);
      if (res.code && res.code !== 0) throw new Error(res.rawLog || `Code ${res.code}`);
      setTxHash(res.transactionHash);
      setStep("result");
      toast.success("Commission withdrawn", { description: shorten(res.transactionHash, 12, 8) });
    } catch (e: any) {
      setTxError(e?.message ?? String(e));
      setStep("result");
      toast.error("Withdraw failed", { description: e?.message ?? String(e) });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px] bg-card/95 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle>Withdraw Validator Commission</DialogTitle>
        </DialogHeader>
        {step === "form" && (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/30 p-4 text-center">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Outstanding Commission
              </div>
              <div className="text-2xl font-bold mt-1">
                {formatAmount(String(commissionUjay))}
              </div>
              <div className="text-[11px] text-muted-foreground mt-1 font-mono break-all">
                {shorten(validatorOperator, 14, 8)}
              </div>
            </div>
            <FeePicker tier={tier} setTier={setTier} gas={200_000} />
            <p className="text-[11px] text-muted-foreground">
              Only the validator&apos;s self account can sign this transaction.
            </p>
            <button
              onClick={submit}
              className="w-full bg-gradient-primary text-primary-foreground rounded-lg py-2.5 text-sm font-medium hover:opacity-90 shadow-glow"
            >
              {address ? "Withdraw Commission" : "Connect Wallet"}
            </button>
          </div>
        )}
        {step === "confirming" && (
          <div className="py-12 flex flex-col items-center gap-4">
            <Loader2 className="h-10 w-10 text-primary animate-spin" />
            <div className="text-sm text-muted-foreground">Approve in Keplr…</div>
          </div>
        )}
        {step === "result" && (
          <ResultPanel
            txHash={txHash}
            txError={txError}
            onClose={() => onOpenChange(false)}
            onRetry={() => setStep("form")}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

export function DepositDialog({
  open,
  onOpenChange,
  proposalId,
  proposalTitle,
  minDepositUjay,
  currentDepositUjay,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  proposalId: string;
  proposalTitle?: string;
  minDepositUjay?: string | number;
  currentDepositUjay?: string | number;
}) {
  const { address, connect } = useWallet();
  const [amount, setAmount] = useState("");
  const [tier, setTier] = useState<FeeTier>("average");
  const [step, setStep] = useState<Step>("form");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);

  const decimals = defaultNetwork.tokenDecimals;
  const symbol = defaultNetwork.coinDenom;

  const submit = async () => {
    if (!address) return connect();
    const num = Number(amount);
    if (!num || num <= 0) return toast.error("Enter a valid amount");
    const ujay = String(Math.floor(num * Math.pow(10, decimals)));
    setStep("confirming");
    setTxError(null);
    try {
      const res = await depositProposal(address, proposalId, ujay, tier);
      if (res.code && res.code !== 0) throw new Error(res.rawLog || `Code ${res.code}`);
      setTxHash(res.transactionHash);
      setStep("result");
      toast.success("Deposit submitted", { description: shorten(res.transactionHash, 12, 8) });
    } catch (e: any) {
      setTxError(e?.message ?? String(e));
      setStep("result");
      toast.error("Deposit failed", { description: e?.message ?? String(e) });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px] bg-card/95 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle>Deposit on Proposal #{proposalId}</DialogTitle>
        </DialogHeader>
        {step === "form" && (
          <div className="space-y-4">
            {proposalTitle && (
              <div className="text-sm text-muted-foreground line-clamp-2">{proposalTitle}</div>
            )}
            {(minDepositUjay !== undefined || currentDepositUjay !== undefined) && (
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs space-y-1">
                {currentDepositUjay !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Current deposit</span>
                    <span className="font-mono">{formatAmount(String(currentDepositUjay))}</span>
                  </div>
                )}
                {minDepositUjay !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Min deposit</span>
                    <span className="font-mono">{formatAmount(String(minDepositUjay))}</span>
                  </div>
                )}
              </div>
            )}
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground">
                Amount ({symbol})
              </label>
              <input
                type="number"
                min="0"
                step="0.000001"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.0"
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary"
              />
            </div>
            <FeePicker tier={tier} setTier={setTier} gas={200_000} />
            <button
              onClick={submit}
              className="w-full bg-gradient-primary text-primary-foreground rounded-lg py-2.5 text-sm font-medium hover:opacity-90 shadow-glow"
            >
              {address ? "Submit Deposit" : "Connect Wallet"}
            </button>
          </div>
        )}
        {step === "confirming" && (
          <div className="py-12 flex flex-col items-center gap-4">
            <Loader2 className="h-10 w-10 text-primary animate-spin" />
            <div className="text-sm text-muted-foreground">Approve in Keplr…</div>
          </div>
        )}
        {step === "result" && (
          <ResultPanel
            txHash={txHash}
            txError={txError}
            onClose={() => onOpenChange(false)}
            onRetry={() => setStep("form")}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
