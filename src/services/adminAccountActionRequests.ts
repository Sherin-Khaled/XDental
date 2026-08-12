import { apiRequest } from "./http";
import type {
  AccountActionRequest,
  AccountActionRequestStatus,
  AccountActionRequestType,
} from "./account";

export type UserLifecycleState =
  | "ACTIVE"
  | "DELETION_REQUESTED"
  | "DEACTIVATED"
  | "DELETED";

export type AccountActionHistory = {
  id: string;
  eventType: "STATUS_CHANGE" | "REACTIVATED";
  previousStatus: AccountActionRequestStatus | null;
  newStatus: AccountActionRequestStatus | null;
  previousLifecycle: UserLifecycleState | null;
  newLifecycle: UserLifecycleState | null;
  actorRole: string;
  actor: { name: string; email: string } | null;
  customerNote: string | null;
  adminNote: string | null;
  createdAt: string;
};

export type AdminAccountActionRequest = AccountActionRequest & {
  reviewerNote: string | null;
  completionReference: string | null;
  customer: {
    id: string;
    name: string;
    email: string;
    isActive: boolean;
    lifecycleState: UserLifecycleState;
  } | null;
  reviewedBy: { name: string; email: string } | null;
  history: AccountActionHistory[];
};

export type AdminAccountAction =
  | "UNDER_REVIEW"
  | "APPROVE"
  | "REJECT"
  | "COMPLETE"
  | "REACTIVATE";

export async function getAdminAccountActionRequests(options: {
  search?: string;
  type?: AccountActionRequestType;
  status?: AccountActionRequestStatus;
  signal?: AbortSignal;
} = {}) {
  const params = new URLSearchParams();
  if (options.search?.trim()) params.set("search", options.search.trim());
  if (options.type) params.set("type", options.type);
  if (options.status) params.set("status", options.status);
  const query = params.toString();
  const result = await apiRequest<{ requests: AdminAccountActionRequest[] }>(
    `/admin/account-action-requests${query ? `?${query}` : ""}`,
    { signal: options.signal }
  );
  return result.requests;
}

export async function getAdminAccountActionRequest(
  id: string,
  signal?: AbortSignal
) {
  const result = await apiRequest<{ request: AdminAccountActionRequest }>(
    `/admin/account-action-requests/${encodeURIComponent(id)}`,
    { signal }
  );
  return result.request;
}

export async function getAdminAccountActionRequestAttentionCount(
  signal?: AbortSignal
) {
  return apiRequest<{ count: number }>(
    "/admin/account-action-requests-attention-count",
    { signal }
  );
}

export async function applyAdminAccountAction(
  id: string,
  input: {
    action: AdminAccountAction;
    customerResponse?: string;
    adminNote?: string;
    confirmation?: "APPROVE" | "COMPLETE" | "REACTIVATE";
  }
) {
  const result = await apiRequest<{ request: AdminAccountActionRequest }>(
    `/admin/account-action-requests/${encodeURIComponent(id)}/actions`,
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );
  return result.request;
}
