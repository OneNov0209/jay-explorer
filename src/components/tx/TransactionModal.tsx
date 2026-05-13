import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { defaultNetwork } from "@/data/networks";
import { useWallet } from "@/lib/wallet";
import {
  FEE_TIERS,
  estimateFee,
  sendTokens,
  delegate as doDelegate,
  undelegate as doUndelegate,
  redelegate as doRedelegate,
  type FeeTier,
} from "@/lib/tx";
import { lcd, safe } from "@/lib/cosmos";
import { useQuery } from "@tanstack/react-query";
import { formatAmount, shorten } from "@/lib/format";
import { toast } from "sonner";
import { ArrowRight, Check, Loader2, Send, ArrowDownToLine, Coins, Repeat } from "lucide-react";
import { cn } from "@/lib/utils";

export type TxMode = "send" | "delegate" | "undelegate" | "redelegate";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: TxMode;
  validatorAddress?: string;
  validatorMoniker?: string;
}

const TITLES: Record<TxMode, string> = {
  send: "Send JAY",
  delegate: "Delegate",
  undelegate: "Undelegate",
  redelegate: "Redelegate",
};

const ICONS: Record<TxMode, React.ReactNode> = {
  send: <Send className="h-4 w-4" />,
  delegate: <Coins className="h-4 w-4" />,
  undelegate: <ArrowDownToLine className="h-4 w-4" />,
  redelegate: <Repeat className="h-4 w-4" />,
};

const DECIMALS = defaultNetwork.tokenDecimals;
const SYMBOL = defaultNetwork.coinDenom;

function toMicro(human: string): string {
  if (!human) return "0";
  const [w, f = ""] = human.split(".");
  const frac = (f + "0".repeat(DECIMALS)).slice(0, DECIMALS);
  return BigInt(w || "0") * BigInt(10 ** DECIMALS) + BigInt(frac || "0") + "";
}
function fromMicro(micro: string | number): string {
  const n = Number(micro) / 10 ** DECIMALS;
  return n.toString();
}

export function TransactionModal({
  open,
  onOpenChange,
  mode,
  validatorAddress,
  validatorMoniker,
}: Props) {
  const { address } = useWallet();
  const [step, setStep] = useState<"form" | "confirming" | "result">("form");
  const [recipient, setRecipient] = useState("");
  const [dstValidator, setDstValidator] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [tier, setTier] = useState<FeeTier>("average");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);

  // bank balance
  const { data: bal } = useQuery({
    queryKey: ["modal-bal", address],
    queryFn: () => safe(lcd.balance(address!)),
    enabled: open && !!address,
    refetchInterval: 15_000,
  });
  const bankAvailable =
    bal?.balances?.find((b: any) => b.denom === defaultNetwork.denom)?.amount ?? "0";

  // delegation balance for src validator (used as max for undelegate/redelegate)
  const { data: delResp } = useQuery({
    queryKey: ["modal-del", address, validatorAddress],
    queryFn: () =>
      safe(
        lcd.validatorSelfDelegation(validatorAddress!, address!),
      ),
    enabled:
      open && !!address && !!validatorAddress && (mode === "undelegate" || mode === "redelegate"),
    refetchInterval: 15_000,
  });
  const delegatedAvailable =
    (delResp as any)?.delegation_response?.balance?.amount ?? "0";

  const available =
    mode === "undelegate" || mode === "redelegate" ? delegatedAvailable : bankAvailable;

  useEffect(() => {
    if (!open) {
      setStep("form");
      setRecipient("");
      setDstValidator("");
      setAmount("");
      setMemo("");
      setTier("average");
      setTxHash(null);
      setTxError(null);
    }
  }, [open]);

  useEffect(() => {
    if (mode !== "send" && validatorAddress) setRecipient(validatorAddress);
  }, [mode, validatorAddress]);

  const gas =
    mode === "send"
      ? 100_000
      : mode === "delegate"
        ? 250_000
        : mode === "redelegate"
          ? 350_000
          : 300_000;
  const fee = estimateFee(tier, gas);

  const setMax = () => {
    if (mode === "send") {
      const reserve = BigInt(fee.raw);
      const max = BigInt(bankAvailable) > reserve ? BigInt(bankAvailable) - reserve : 0n;
      setAmount(fromMicro(max.toString()));
    } else {
      setAmount(fromMicro(available));
    }
  };

  const validate = (): string | null => {
    if (!address) return "Connect wallet";
    if (mode === "send") {
      if (!recipient.startsWith(defaultNetwork.prefix)) return "Invalid recipient address";
    } else if (!recipient.startsWith(defaultNetwork.bech32Config.bech32PrefixValAddr)) {
      return "Invalid validator address";
    }
    if (mode === "redelegate") {
      if (!dstValidator.startsWith(defaultNetwork.bech32Config.bech32PrefixValAddr))
        return "Invalid destination validator";
      if (dstValidator === recipient) return "Destination must differ from source";
    }
    if (!amount || Number(amount) <= 0) return "Enter an amount";
    try {
      if (BigInt(toMicro(amount)) <= 0n) return "Amount too small";
    } catch {
      return "Invalid amount";
    }
    return null;
  };

  const submit = async () => {
    const err = validate();
    if (err) return toast.error(err);
    setStep("confirming");
    setTxError(null);
    try {
      const micro = toMicro(amount);
      let res;
      if (mode === "send") res = await sendTokens(address!, recipient, micro, tier, memo);
      else if (mode === "delegate")
        res = await doDelegate(address!, recipient, micro, tier, memo);
      else if (mode === "redelegate")
        res = await doRedelegate(address!, recipient, dstValidator, micro, tier, memo);
      else res = await doUndelegate(address!, recipient, micro, tier, memo);

      if (res.code && res.code !== 0) {
        throw new Error(res.rawLog || `Tx failed (code ${res.code})`);
      }
      setTxHash(res.transactionHash);
      setStep("result");
      toast.success("Transaction broadcasted", {
        description: shorten(res.transactionHash, 12, 8),
      });
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      setTxError(msg);
      setStep("result");
      toast.error("Transaction failed", { description: msg });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] bg-card/95 backdrop-blur-xl border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="h-8 w-8 rounded-lg bg-primary/15 grid place-items-center text-primary">
              {ICONS[mode]}
            </span>
            {TITLES[mode]}
          </DialogTitle>
        </DialogHeader>

        {step === "form" && (
          <div className="space-y-4">
            {/* Recipient / Source validator */}
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground">
                {mode === "send"
                  ? "Recipient"
                  : mode === "redelegate"
                    ? "Source Validator"
                    : "Validator"}
              </label>
              {mode !== "send" && validatorMoniker ? (
                <div className="mt-1 px-3 py-2 rounded-lg bg-muted/40 border border-border text-sm">
                  <div className="font-medium">{validatorMoniker}</div>
                  <div className="text-[11px] font-mono text-muted-foreground truncate">
                    {recipient}
                  </div>
                </div>
              ) : (
                <input
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder={
                    mode === "send"
                      ? `${defaultNetwork.prefix}1...`
                      : `${defaultNetwork.bech32Config.bech32PrefixValAddr}1...`
                  }
                  className="mt-1 w-full px-3 py-2 rounded-lg bg-background border border-border focus:border-primary focus:outline-none text-sm font-mono"
                />
              )}
            </div>

            {/* Destination validator (redelegate only) */}
            {mode === "redelegate" && (
              <div>
                <label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Destination Validator
                </label>
                <input
                  value={dstValidator}
                  onChange={(e) => setDstValidator(e.target.value)}
                  placeholder={`${defaultNetwork.bech32Config.bech32PrefixValAddr}1...`}
                  className="mt-1 w-full px-3 py-2 rounded-lg bg-background border border-border focus:border-primary focus:outline-none text-sm font-mono"
                />
              </div>
            )}

            {/* Amount */}
            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Amount ({SYMBOL})
                </label>
                <span className="text-[11px] text-muted-foreground">
                  Available: {formatAmount(available)}
                </span>
              </div>
              <div className="mt-1 relative">
                <input
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                  placeholder="0.00"
                  className="w-full pl-3 pr-16 py-2 rounded-lg bg-background border border-border focus:border-primary focus:outline-none text-sm font-mono"
                />
                <button
                  onClick={setMax}
                  type="button"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[11px] px-2 py-1 rounded bg-primary/15 text-primary hover:bg-primary/25"
                >
                  MAX
                </button>
              </div>
            </div>

            {/* Fee tier */}
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground">
                Fee
              </label>
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
                          ? "border-primary bg-primary/10 text-foreground"
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

            {/* Memo */}
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground">
                Memo (optional)
              </label>
              <input
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder=""
                className="mt-1 w-full px-3 py-2 rounded-lg bg-background border border-border focus:border-primary focus:outline-none text-sm"
              />
            </div>

            {/* Confirm panel */}
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs space-y-1">
              <Row label="From" value={shorten(address ?? "—", 12, 8)} mono />
              <Row label="To" value={shorten(recipient || "—", 12, 8)} mono />
              <Row label="Amount" value={`${amount || "0"} ${SYMBOL}`} />
              <Row label="Network Fee" value={formatAmount(fee.raw, { precision: 6 })} />
              <Row label="Gas Limit" value={fee.gas} />
            </div>

            <button
              onClick={submit}
              disabled={!!validate()}
              className="w-full bg-gradient-primary text-primary-foreground rounded-lg py-2.5 text-sm font-medium flex items-center justify-center gap-2 hover:opacity-90 transition shadow-glow disabled:opacity-50"
            >
              Confirm <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {step === "confirming" && (
          <div className="py-12 flex flex-col items-center gap-4">
            <Loader2 className="h-10 w-10 text-primary animate-spin" />
            <div className="text-sm text-muted-foreground text-center">
              Approve the transaction in Keplr…
              <br />
              Broadcasting to {defaultNetwork.displayName}.
            </div>
          </div>
        )}

        {step === "result" && (
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
                  onClick={() => setStep("form")}
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
                <a
                  href={`/transactions/${txHash}`}
                  className="text-xs font-mono text-primary hover:underline break-all text-center"
                >
                  {txHash}
                </a>
                <button
                  onClick={() => onOpenChange(false)}
                  className="mt-2 px-4 py-2 rounded-lg bg-gradient-primary text-primary-foreground text-sm"
                >
                  Done
                </button>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("text-foreground/90 truncate max-w-[60%]", mono && "font-mono")}>
        {value}
      </span>
    </div>
  );
}
