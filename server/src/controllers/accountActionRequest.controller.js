import {
  AccountActionValidationError,
  cancelCustomerAccountActionRequest,
  countAdminAccountActionRequestsNeedingAttention,
  createAdminManagedAccountActionRequest,
  createCustomerAccountActionRequest,
  getAdminAccountActionRequest,
  getCustomerAccountActionRequest,
  listAdminAccountActionRequests,
  listCustomerAccountActionRequests,
  processAdminAccountAction,
} from "../services/accountActionRequest.service.js";
import { deliverAccountActionCommunications } from "../services/accountActionCommunication.service.js";
import { deleteManagedProfileImage } from "../services/profileImageStorage.service.js";

function handleKnownError(error, response) {
  if (!(error instanceof AccountActionValidationError)) return false;
  response.status(error.statusCode ?? 400).json({
    message: error.message,
    ...(error.field ? { field: error.field } : {}),
    ...(error.code ? { code: error.code } : {}),
  });
  return true;
}

function requireCustomer(request, response) {
  if (request.user.role !== "customer") {
    response.status(403).json({ message: "Customer account required." });
    return false;
  }
  return true;
}

export async function getMyAccountActionRequests(request, response) {
  if (!requireCustomer(request, response)) return;
  const requests = await listCustomerAccountActionRequests(request.user.id);
  return response.json({ requests });
}

export async function getMyAccountActionRequest(request, response) {
  if (!requireCustomer(request, response)) return;
  try {
    const accountRequest = await getCustomerAccountActionRequest({
      userId: request.user.id,
      requestId: request.params.id,
    });
    return response.json({ request: accountRequest });
  } catch (error) {
    if (handleKnownError(error, response)) return;
    throw error;
  }
}

export async function createMyAccountActionRequest(request, response) {
  if (!requireCustomer(request, response)) return;
  try {
    const result = await createCustomerAccountActionRequest({
      userId: request.user.id,
      payload: request.body,
    });
    await deliverAccountActionCommunications(result.communication);
    return response.status(result.created ? 201 : 200).json({
      request: result.request,
      created: result.created,
    });
  } catch (error) {
    if (handleKnownError(error, response)) return;
    throw error;
  }
}

export async function cancelMyAccountActionRequest(request, response) {
  if (!requireCustomer(request, response)) return;
  try {
    const result = await cancelCustomerAccountActionRequest({
      userId: request.user.id,
      requestId: request.params.id,
      payload: request.body,
    });
    await deliverAccountActionCommunications(result.communication);
    return response.json({ request: result.request });
  } catch (error) {
    if (handleKnownError(error, response)) return;
    throw error;
  }
}

export async function getAdminAccountActionRequests(request, response) {
  const requests = await listAdminAccountActionRequests({
    search: typeof request.query.search === "string" ? request.query.search.trim().slice(0, 200) : "",
    type: typeof request.query.type === "string" ? request.query.type.trim().toUpperCase() : "",
    status: typeof request.query.status === "string" ? request.query.status.trim().toUpperCase() : "",
  });
  return response.json({ requests });
}

export async function getAdminAccountActionRequestAttentionCount(
  _request,
  response
) {
  return response.json({
    count: await countAdminAccountActionRequestsNeedingAttention(),
  });
}

export async function getAdminAccountActionRequestById(request, response) {
  try {
    return response.json({
      request: await getAdminAccountActionRequest(request.params.id),
    });
  } catch (error) {
    if (handleKnownError(error, response)) return;
    throw error;
  }
}

export async function applyAdminAccountAction(request, response) {
  try {
    const result = await processAdminAccountAction({
      requestId: request.params.id,
      actor: request.user,
      payload: request.body,
    });
    if (result.profileImageUrlToDelete) {
      await deleteManagedProfileImage(result.profileImageUrlToDelete).catch(() => {});
    }
    await deliverAccountActionCommunications(result.communication);
    return response.json({ request: result.request });
  } catch (error) {
    if (handleKnownError(error, response)) return;
    throw error;
  }
}

export async function createAdminUserAccountActionRequest(request, response) {
  try {
    const result = await createAdminManagedAccountActionRequest({
      userId: request.params.id,
      actor: request.user,
      payload: request.body,
    });
    await deliverAccountActionCommunications(result.communication);
    return response.status(result.created ? 201 : 200).json({
      request: result.request,
      created: result.created,
    });
  } catch (error) {
    if (handleKnownError(error, response)) return;
    throw error;
  }
}
