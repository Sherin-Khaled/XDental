import type {
  AccountActionRequestStatus,
  AccountActionRequestType,
} from "../services/account";

export const ACCOUNT_REQUESTS_REFRESH_EVENT =
  "x-dental:account-requests-refresh";

export type AccountRequestAdminAction =
  | "UNDER_REVIEW"
  | "APPROVE"
  | "REJECT"
  | "COMPLETE"
  | "REACTIVATE";

type ActionableRequest = {
  status: AccountActionRequestStatus;
  type: AccountActionRequestType;
  customer?: {
    lifecycleState?: string;
  } | null;
};

export function accountRequestStatusTranslationKey(
  status: AccountActionRequestStatus
) {
  const keys: Record<AccountActionRequestStatus, string> = {
    PENDING: "pending",
    UNDER_REVIEW: "underReview",
    APPROVED: "approved",
    REJECTED: "rejected",
    CANCELED: "canceled",
    COMPLETED: "completed",
  };
  return keys[status];
}

export function availableAdminAccountRequestActions(
  request: ActionableRequest
): AccountRequestAdminAction[] {
  if (request.status === "PENDING") {
    return ["UNDER_REVIEW", "APPROVE", "REJECT"];
  }
  if (request.status === "UNDER_REVIEW") return ["APPROVE", "REJECT"];
  if (request.status === "APPROVED") return ["COMPLETE"];
  if (
    request.status === "COMPLETED"
    && request.type === "DEACTIVATION"
    && request.customer?.lifecycleState === "DEACTIVATED"
  ) {
    return ["REACTIVATE"];
  }
  return [];
}

export function completionActionTranslationKey(
  type: AccountActionRequestType
) {
  return type === "DELETION"
    ? "completeDeletionAction"
    : "completeDeactivationAction";
}

export function completionWarningTranslationPrefix(
  type: AccountActionRequestType
) {
  return type === "DELETION"
    ? "deletionCompletion"
    : "deactivationCompletion";
}

export function approvedCustomerExplanationTranslationKey(
  type: AccountActionRequestType
) {
  return type === "DELETION"
    ? "approvedDeletionExplanation"
    : "approvedDeactivationExplanation";
}

export function requestedAccountRequestId(location: string) {
  const query = location.includes("?") ? location.split("?").slice(1).join("?") : "";
  const value = new URLSearchParams(query).get("request")?.trim() ?? "";
  return /^[A-Za-z0-9_-]{1,128}$/.test(value) ? value : null;
}
