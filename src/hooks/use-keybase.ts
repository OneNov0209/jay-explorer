import { useQuery } from "@tanstack/react-query";
import { getKeybaseAvatar } from "@/lib/keybase";

export function useKeybaseAvatar(identity?: string) {
  return useQuery({
    queryKey: ["keybase", identity ?? ""],
    queryFn: () => getKeybaseAvatar(identity),
    enabled: !!identity && identity.length === 16,
    staleTime: 1000 * 60 * 60 * 24,
    gcTime: 1000 * 60 * 60 * 24,
  });
}
