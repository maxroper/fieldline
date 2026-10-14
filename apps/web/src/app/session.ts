import type { Role } from "@fieldline/shared";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { api } from "./api";

export interface Session {
  userId: string;
  orgId: string;
  role: Role;
  name: string;
}

export interface Me {
  session: Session | null;
  user: { id: string; name: string; role: Role; title: string; teamId: string | null; homeTeamId: string | null; canBill: boolean | null; canEditCustomers: boolean | null } | null;
  org: { id: string; name: string; city: string; timezone: string } | null;
}

export const meQuery = queryOptions({
  queryKey: ["me"],
  queryFn: () => api.get<Me>("/auth/me"),
  staleTime: 5 * 60 * 1000,
});

export function useMe() {
  return useQuery(meQuery);
}

export function isOffice(role: Role | undefined | null): boolean {
  return Boolean(role) && role !== "tech";
}
