import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { WalletProvider } from "@/lib/wallet";
import { AppLayout } from "@/components/layout/AppLayout";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold bg-gradient-primary bg-clip-text text-transparent">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist.
        </p>
        <Link
          to="/"
          className="inline-flex mt-6 items-center justify-center rounded-md bg-gradient-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
          >
            Try again
          </button>
          <a href="/" className="rounded-md border border-border px-4 py-2 text-sm">
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Jay Network Explorer · Cosmos SDK Blockchain Explorer" },
      {
        name: "description",
        content:
          "Explore blocks, transactions, validators and governance on Jay Network — a Cosmos SDK chain with CosmWasm support. Built by OneNov.",
      },
      { property: "og:title", content: "Jay Network Explorer" },
      { property: "og:description", content: "Cosmos SDK blockchain explorer for Jay Network." },
      { property: "og:type", content: "website" },
      {
        property: "og:image",
        content:
          "https://raw.githubusercontent.com/bbtccore/thejaynetwork/refs/heads/master/chain-registry/thejaynetwork/logo.png",
      },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      {
        rel: "icon",
        type: "image/png",
        href: "https://raw.githubusercontent.com/bbtccore/thejaynetwork/refs/heads/master/chain-registry/thejaynetwork/logo.png",
      },
      {
        rel: "shortcut icon",
        type: "image/png",
        href: "https://raw.githubusercontent.com/bbtccore/thejaynetwork/refs/heads/master/chain-registry/thejaynetwork/logo.png",
      },
      {
        rel: "apple-touch-icon",
        href: "https://raw.githubusercontent.com/bbtccore/thejaynetwork/refs/heads/master/chain-registry/thejaynetwork/logo.png",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <WalletProvider>
        <AppLayout>
          <Outlet />
        </AppLayout>
        <Toaster />
      </WalletProvider>
    </QueryClientProvider>
  );
}
