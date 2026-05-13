import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useState } from "react";
import { lcd, safe } from "@/lib/cosmos";
import { Card, Skeleton, Badge } from "@/components/shared/ui";
import { defaultNetwork } from "@/data/networks";
import { shorten, formatNumber, timeAgo } from "@/lib/format";
import {
  Boxes,
  Code,
  FileCode,
  Copy,
  Search,
  ExternalLink,
  Clock,
  User,
  Tag,
  Layers,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/cosmwasm")({
  head: () => ({
    meta: [
      { title: "CosmWasm Smart Contracts · Jay Network Explorer" },
      {
        name: "description",
        content: "Explore CosmWasm smart contracts and codes deployed on Jay Network.",
      },
    ],
  }),
  component: CosmWasmPage,
});

function CosmWasmPage() {
  const [tab, setTab] = useState<"contracts" | "codes">("contracts");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  // Fetch all codes
  const { data: codesData, isLoading: codesLoading } = useQuery({
    queryKey: ["wasm-codes"],
    queryFn: async () => {
      const res = await fetch(`${defaultNetwork.apis[0]}/cosmwasm/wasm/v1/code`);
      return res.json();
    },
    placeholderData: keepPreviousData,
    staleTime: 30000,
  });

  // Fetch all contracts
  const { data: contractsData, isLoading: contractsLoading } = useQuery({
    queryKey: ["wasm-contracts"],
    queryFn: async () => {
      const res = await fetch(`${defaultNetwork.apis[0]}/cosmwasm/wasm/v1/contract`);
      return res.json();
    },
    placeholderData: keepPreviousData,
    staleTime: 30000,
  });

  const codes = (codesData?.code_infos ?? []) as any[];
  const contracts = (contractsData?.contracts ?? []) as any[];

  const filteredCodes = codes.filter((c: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      String(c.code_id).includes(q) ||
      c.creator?.toLowerCase().includes(q)
    );
  });

  const filteredContracts = contracts.filter((c: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      String(c.code_id).includes(q) ||
      c.address?.toLowerCase().includes(q) ||
      c.label?.toLowerCase().includes(q)
    );
  });

  const isLoading = codesLoading || contractsLoading;

  const copyAddr = (addr: string) => {
    navigator.clipboard.writeText(addr);
    toast.success("Address copied");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <FileCode className="h-6 w-6 text-primary" /> CosmWasm
        </h1>
        <p className="text-sm text-muted-foreground">
          Smart contracts and codes deployed on {defaultNetwork.displayName}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="card-3d p-4 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
          <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Code className="h-3.5 w-3.5" /> Total Codes
          </div>
          <div className="text-xl font-bold mt-1">{codes.length}</div>
        </Card>
        <Card className="card-3d p-4 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent">
          <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Layers className="h-3.5 w-3.5" /> Total Contracts
          </div>
          <div className="text-xl font-bold mt-1">{contracts.length}</div>
        </Card>
        <Card className="card-3d p-4 bg-gradient-to-br from-violet-500/10 via-violet-500/5 to-transparent">
          <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Boxes className="h-3.5 w-3.5" /> Chain
          </div>
          <div className="text-xl font-bold mt-1 text-sm">{defaultNetwork.chainId}</div>
        </Card>
        <Card className="card-3d p-4 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent">
          <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <FileCode className="h-3.5 w-3.5" /> CosmWasm
          </div>
          <div className="text-xl font-bold mt-1">Enabled</div>
        </Card>
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
        <div className="flex gap-1 p-1 bg-muted/30 rounded-lg text-xs">
          <button
            onClick={() => {
              setTab("contracts");
              setPage(1);
            }}
            className={`px-4 py-2 rounded-md font-medium transition ${
              tab === "contracts"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Layers className="h-3.5 w-3.5 inline mr-1.5" />
            Contracts ({contracts.length})
          </button>
          <button
            onClick={() => {
              setTab("codes");
              setPage(1);
            }}
            className={`px-4 py-2 rounded-md font-medium transition ${
              tab === "codes"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Code className="h-3.5 w-3.5 inline mr-1.5" />
            Codes ({codes.length})
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={tab === "contracts" ? "Search contracts..." : "Search codes..."}
            className="w-full pl-10 pr-3 h-9 text-sm rounded-lg bg-card border border-border focus:border-primary focus:outline-none"
          />
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : tab === "codes" ? (
        filteredCodes.length === 0 ? (
          <Card className="p-10 text-center text-muted-foreground text-sm">
            No CosmWasm codes uploaded yet on this network.
          </Card>
        ) : (
          <>
            <div className="space-y-3">
              {filteredCodes
                .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
                .map((c: any) => (
                  <Card
                    key={c.code_id}
                    className="card-3d p-4 flex flex-col sm:flex-row sm:items-center gap-3 hover:border-primary/30 transition"
                  >
                    <div className="h-10 w-10 rounded-lg bg-primary/15 text-primary grid place-items-center shrink-0">
                      <Code className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold">
                          Code #{c.code_id}
                        </span>
                        <Badge variant="muted" className="text-[10px] font-mono">
                          {c.data_hash?.slice(0, 10)}...
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <User className="h-3 w-3" />
                        <span className="font-mono truncate">
                          {shorten(c.creator, 14, 8)}
                        </span>
                        <button
                          onClick={() => copyAddr(c.creator)}
                          className="hover:text-primary transition"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Tag className="h-3 w-3" />
                      <span>
                         Permission:{" "}
                         {typeof c.instantiate_permission === "string"
                            ? c.instantiate_permission
                            : c.instantiate_permission?.permission || "Everyone"}
                       </span>
                    </div>
                  </Card>
                ))}
            </div>
            <Pagination
              total={filteredCodes.length}
              page={page}
              pageSize={PAGE_SIZE}
              onPage={setPage}
            />
          </>
        )
      ) : filteredContracts.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground text-sm">
          No contracts instantiated yet on this network.
        </Card>
      ) : (
        <>
          <div className="space-y-3">
            {filteredContracts
              .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
              .map((c: any) => (
                <Link
                  key={c.address}
                  to="/accounts/$address"
                  params={{ address: c.address }}
                  className="block"
                >
                  <Card className="card-3d p-4 flex flex-col sm:flex-row sm:items-center gap-3 hover:border-primary/30 transition cursor-pointer">
                    <div className="h-10 w-10 rounded-lg bg-emerald-500/15 text-emerald-500 grid place-items-center shrink-0">
                      <Layers className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm truncate">
                          {c.label || "Unnamed Contract"}
                        </span>
                        <Badge variant="success" className="text-[10px]">
                          Active
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                        <span className="font-mono truncate">
                          {shorten(c.address, 16, 10)}
                        </span>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            copyAddr(c.address);
                          }}
                          className="hover:text-primary transition"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Code className="h-3 w-3" />
                        <span>Code #{c.code_id}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        <span className="font-mono">{shorten(c.creator, 8, 6)}</span>
                      </div>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </div>
                  </Card>
                </Link>
              ))}
          </div>
          <Pagination
            total={filteredContracts.length}
            page={page}
            pageSize={PAGE_SIZE}
            onPage={setPage}
          />
        </>
      )}

      {/* Info */}
      <Card className="p-5 bg-gradient-to-r from-primary/5 to-transparent border-primary/10">
        <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
          <FileCode className="h-4 w-4 text-primary" /> About CosmWasm
        </h3>
        <div className="text-xs text-muted-foreground space-y-1">
          <p>
            <strong>Codes</strong> are uploaded smart contract blueprints. Each code has a unique{" "}
            <strong>Code ID</strong> and can be instantiated multiple times.
          </p>
          <p>
            <strong>Contracts</strong> are live instances of a code. They have their own address,
            storage, and balance. Click a contract to view its account details.
          </p>
        </div>
      </Card>
    </div>
  );
}

function Pagination({
  total,
  page,
  pageSize,
  onPage,
}: {
  total: number;
  page: number;
  pageSize: number;
  onPage: (p: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-2 pt-4">
      <button
        onClick={() => onPage(page - 1)}
        disabled={page <= 1}
        className="h-8 px-3 rounded-md border border-border text-xs disabled:opacity-40 hover:bg-muted"
      >
        Previous
      </button>
      <span className="text-xs text-muted-foreground">
        Page {page} of {totalPages}
      </span>
      <button
        onClick={() => onPage(page + 1)}
        disabled={page >= totalPages}
        className="h-8 px-3 rounded-md border border-border text-xs disabled:opacity-40 hover:bg-muted"
      >
        Next
      </button>
    </div>
  );
}
