# Jay Network Explorer

A full-featured Cosmos SDK blockchain explorer built specifically for **TheJayNetwork** by **OneNov**.

Track everything on-chain — blocks, transactions, validators, governance, smart contracts, and more.

---

## 🚀 Features

| Feature | Description |
|---------|-------------|
| **Dashboard** | Real-time chain stats — block height, validators, bonded ratio, total supply |
| **Blocks** | Browse all blocks with live activity charts & transaction type filters |
| **Transactions** | Search & decode transactions with human-readable message types |
| **Validators** | Full validator profiles with voting power, commission, uptime, delegations |
| **Uptime** | PingPub-style uptime grid with signed/missed/absent blocks per validator |
| **Consensus** | Live consensus state — round, step, prevotes, precommits, onboard rate |
| **Accounts** | Portfolio breakdown, delegation charts, staking rewards, transaction history |
| **Governance** | Proposals list, tally, quorum/threshold meters, vote & deposit dialogs |
| **CosmWasm** | Smart contract codes & instantiated contracts with search |
| **IBC Transfer** | Cross-chain transfer interface |
| **Parameters** | On-chain module parameters |
| **Network Globe** | Visual 3D globe showing validator locations |
| **State Sync** | State sync node list for fast syncing |

---

## 🛠 Built With

- **TanStack Start** — Full-stack React framework
- **TanStack Router** — Type-safe file-based routing
- **TanStack Query** — Server state management
- **CosmJS** — Cosmos SDK client library
- **Recharts** — Composable charting library
- **Tailwind CSS** — Utility-first CSS framework
- **shadcn/ui** — Accessible UI components
- **Keplr Wallet** — Wallet integration
- **Vercel** — Deployment platform

---

## 📦 Getting Started

### Prerequisites

- [Bun](https://bun.sh) (or Node.js 18+)

### Install

```bash
bun install
```

Development

```bash
bun run dev
```

Build

```bash
bun run build
```

Preview Production Build

```bash
bun run preview
```

---

🌐 Deployment

Deployed on Vercel with the following configuration:

File Purpose
vercel.json Rewrite rules & build settings
api/server.js Serverless function entry point
vite.config.ts Vite + TanStack Start config

---

📁 Project Structure

```
jaywatch-cosmos-explorer/
├── api/                    # Vercel serverless entry
├── src/
│   ├── components/         # Reusable UI components
│   │   ├── layout/         # App layout, sidebar, header
│   │   ├── shared/         # CopyButton, JsonActions, ui
│   │   ├── tx/             # Transaction modal, vote dialogs
│   │   └── ui/             # shadcn/ui components
│   ├── data/               # Network configuration
│   ├── hooks/              # Custom hooks (Keybase, mobile)
│   ├── lib/                # Utilities (Cosmos, format, wallet, tx)
│   └── routes/             # File-based routes (TanStack Router)
├── vercel.json             # Vercel deployment config
├── vite.config.ts          # Vite configuration
└── package.json            # Dependencies & scripts
```

---

🌍 Network Configuration

Edit src/data/networks.ts to connect to your chain:

```typescript
export const defaultNetwork = {
  displayName: "Jay Network",
  chainId: "thejaynetwork-1",
  rpcs: ["https://rpc.thejaynetwork.com"],
  apis: ["https://api.thejaynetwork.com"],
  // ... other config
};
```

---

🔗 Links

· Explorer: jay-explorer.onenov.xyz
· OneNov: onenov.xyz
· Jay Network: thejaynetwork.com

---

👤 Built by

OneNov — Cosmos ecosystem validator and infrastructure provider.

---

📄 License

MIT

```
