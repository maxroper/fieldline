import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, qs } from "./api";
import { toast } from "./store";
import type { DispatchDay, SettingsPayload, SiteRow, TimeEntryRow, TimesheetRow, WarehouseRow, WorkOrderRow } from "./types";

export const settingsQuery = queryOptions({ queryKey: ["settings"], queryFn: () => api.get<SettingsPayload>("/settings"), staleTime: 5 * 60 * 1000 });
export const useSettings = () => useQuery(settingsQuery);

export const dispatchQuery = (day: string | undefined, teamId: string | undefined) => queryOptions({ queryKey: ["dispatch", day ?? "today", teamId ?? "all"], queryFn: () => api.get<DispatchDay>(`/dispatch${qs({ day, teamId })}`), staleTime: 10_000 });

export const workOrdersQuery = (params: Record<string, string | undefined>) => queryOptions({ queryKey: ["work-orders", params], queryFn: () => api.get<{ workOrders: WorkOrderRow[] }>(`/work-orders${qs(params)}`) });

export const workOrderQuery = (id: string) => queryOptions({ queryKey: ["work-order", id], queryFn: () => api.get<WorkOrderDetail>(`/work-orders/${id}`) });

export interface WorkOrderDetail {
  workOrder: WorkOrderRow & Record<string, unknown> & { workPerformed: string; summary: string; signerName: string; callerName: string; callerPhone: string; customerPo: string; signatureRequired: boolean; equipmentId: string | null; trackingToken: string | null; closedAt: string | null; materialBudget: number | null; laborBudgetHours: number | null; techStatusAt: string | null };
  customer: Record<string, unknown> & { id: string; name: string; phone: string; contract: boolean; taxExempt: boolean } | null;
  site: Record<string, unknown> & { id: string; name: string; address: string; city: string; contact: string; contactPhone: string; accessNotes: string } | null;
  equipment: Record<string, unknown> & { id: string; tag: string; make: string; model: string; serial: string; refrigerant: string; chargeLbs: number | null; installYear: number | null; warrantyPartsUntil: string | null } | null;
  agreement: Record<string, unknown> & { id: string; tier: string; responseHours: number | null; name: string } | null;
  helpers: { h: { id: string; techId: string; role: string; scheduledFor: string | null; startMinute: number | null; allocatedHours: number | null }; techName: string }[];
  notes: { n: { id: string; body: string; kind: string; createdAt: string; userId: string | null }; userName: string | null }[];
  timeEntries: { e: { id: string; kind: string; date: string; startedAt: string | null; arrivedAt: string | null; stoppedAt: string | null; hours: number; edited: boolean; gpsVerified: boolean; workOrderId: string | null }; techName: string }[];
  files: { id: string; kind: string; caption: string; mime: string; createdAt: string; includeInReport: boolean }[];
  purchaseOrders: ({ id: string; number: number; vendorName: string; status: string; lumpSum: boolean; lumpSumAmount: number | null; expectedDate: string | null } & { lines: { id: string; description: string; quantity: number; unitCost: number; receivedQty: number }[] })[];
  truckParts: { id: string; description: string; quantity: number; unitCost: number; direct: boolean }[];
  quotes: { id: string; number: number; scope: string; status: string; selectedOptionId: string | null; createdWorkOrderId: string | null }[];
  checklists: { r: { id: string; templateId: string; items: { key: string; result: string; note?: string }[]; completedAt: string | null }; template: { id: string; name: string; items: { key: string; label: string }[] } }[];
  checklistTemplates: { id: string; name: string; kind: string; items: { key: string; label: string }[]; requiredBeforeComplete: boolean; trigger: { callTypes?: string[] } }[];
  refrigerantLogs: { id: string; refrigerantType: string; lbsAdded: number; lbsRecovered: number; cylinderId: string; leakCheck: string; leakRatePercent: number | null; fullChargeLbs: number | null; notes: string; loggedAt: string; techCert: string }[];
  permits: { id: string; jurisdiction: string; permitNumber: string; status: string; tests: Record<string, string>; filedOn: string | null; finalOn: string | null; notes: string }[];
  warrantyClaims: { id: string; manufacturer: string; registeredOn: string | null; claimStatus: string; partsReturnBy: string | null; notes: string }[];
  invoice: { id: string; number: number; status: string; amount: number; billedAt: string; dueDate: string | null } | null;
  bill: import("@fieldline/shared").WorkOrderBill;
  trips: { id: string; number: number; trip: number; status: string }[];
  changes: { f: { id: string; field: string; fromValue: string | null; toValue: string | null; createdAt: string }; userName: string | null }[];
  history: WorkOrderRow[];
  messages: { id: string; direction: string; body: string; createdAt: string; status: string; automated: boolean }[];
}

/** A mutation that invalidates everything but the session and toasts the outcome. */
export function useAction<TVars = void, TResult = unknown>(fn: (vars: TVars) => Promise<TResult>, options: { success?: string | ((result: TResult) => string); onSuccess?: (result: TResult, vars: TVars) => void; invalidate?: string[] } = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: async (result, vars) => {
      if (options.invalidate) for (const key of options.invalidate) await queryClient.invalidateQueries({ queryKey: [key] });
      else await queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] !== "me" });
      if (options.success) toast(typeof options.success === "function" ? options.success(result) : options.success);
      options.onSuccess?.(result, vars);
    },
    onError: (error: Error) => toast(error.message || "Something went wrong", "error"),
  });
}

export interface TechDayPayload {
  date: string;
  today: string;
  tech: { id: string; name: string; title: string };
  org: string | undefined;
  visits: WorkOrderRow[];
  sites: SiteRow[];
  notices: { id: string; kind: string; body: string; workOrderId: string | null; createdAt: string }[];
  timeEntries: TimeEntryRow[];
  timesheet: TimesheetRow | null;
  van: WarehouseRow | null;
  pendingUploads: number;
}

/** The tech phone's day. `who` is "me" for the signed-in tech or a tech id when the office previews. */
export const techDayQuery = (who: string, date?: string) => queryOptions({ queryKey: ["tech-day", who, date ?? "today"], queryFn: () => api.get<TechDayPayload>(`/techs/${who}/day${qs({ date })}`), refetchInterval: 30_000 });
