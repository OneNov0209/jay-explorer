import { createFileRoute, Navigate, Outlet, useMatches } from "@tanstack/react-router";
import { useWallet } from "@/lib/wallet";
import { Wallet } from "lucide-react";

export const Route = createFileRoute("/accounts")({
  head: () => ({
    meta: [{ title: "My Account · Jay Network Explorer" }],
  }),
  component: AccountsLayout,
});

function AccountsLayout() {
  const matches = useMatches();
  // If a child route (e.g. /accounts/$address) is matched, render it via Outlet.
  const hasChild = matches.some((m) => m.routeId !== "/accounts" && m.routeId.startsWith("/accounts"));
  if (hasChild) return <Outlet />;
  return <MyAccountPage />;
}

function MyAccountPage() {
  const { address, connect, connecting } = useWallet();

  if (address) {
    return <Navigate to="/accounts/$address" params={{ address }} replace />;
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="card-3d max-w-md w-full text-center p-10">
        <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/15 text-primary grid place-items-center mb-4">
          <Wallet className="h-7 w-7" />
        </div>
        <h1 className="text-xl font-bold">Connect your wallet</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Connect Keplr to view your balance, delegations, rewards, unbondings and transaction
          history on Jay Network.
        </p>
        <button
          onClick={connect}
          disabled={connecting}
          className="mt-6 inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow hover:opacity-90 transition disabled:opacity-60"
        >
          <Wallet className="h-4 w-4" />
          {connecting ? "Connecting…" : "Connect Keplr"}
        </button>
      </div>
    </div>
  );
}
