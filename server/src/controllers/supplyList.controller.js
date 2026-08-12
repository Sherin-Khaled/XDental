import { prisma } from "../config/db.js";
import {
  publicLookups,
  serializePublicProduct,
} from "./catalog.controller.js";
import { resolveEffectiveProductPrices } from "../services/flashSalePricing.service.js";
import {
  SupplyListRequestError,
  createUserSupplyList,
  deleteUserSupplyList,
  duplicateUserSupplyList,
  getUserSupplyList,
  getUserSupplyLists,
  mergeUserSupplyListItems,
  replaceUserSupplyListItems,
} from "../services/supplyList.service.js";

async function serializeSupplyLists(lists) {
  const products = [
    ...new Map(
      lists
        .flatMap((list) => list.items)
        .map((item) => [item.product.id, item.product])
    ).values(),
  ];
  const [lookups, pricingByProductId] = await Promise.all([
    publicLookups(),
    resolveEffectiveProductPrices(prisma, products),
  ]);

  return lists.map((list) => ({
    id: list.id,
    name: list.name,
    branch: list.branch,
    description: list.description,
    status: list.status,
    createdAt: list.createdAt,
    updatedAt: list.updatedAt,
    items: list.items.map((item) => ({
      id: item.id,
      quantity: item.quantity,
      selectedOptions: item.selectedOptions || null,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      product: serializePublicProduct(
        item.product,
        lookups.brandByName,
        lookups.categoryByName,
        pricingByProductId
      ),
    })),
  }));
}

async function serializeSupplyList(list) {
  return (await serializeSupplyLists([list]))[0];
}

function supplyListError(response, error) {
  if (!(error instanceof SupplyListRequestError)) return false;
  response.status(error.statusCode).json({ message: error.message });
  return true;
}

export async function getMySupplyLists(request, response) {
  const lists = await getUserSupplyLists(prisma, request.user.id);
  return response.json({ supplyLists: await serializeSupplyLists(lists) });
}

export async function getMySupplyList(request, response) {
  const list = await getUserSupplyList(
    prisma,
    request.user.id,
    request.params.id
  );
  if (!list) {
    return response.status(404).json({ message: "Supply list not found." });
  }
  return response.json({ supplyList: await serializeSupplyList(list) });
}

export async function createMySupplyList(request, response) {
  try {
    const list = await createUserSupplyList(
      prisma,
      request.user.id,
      request.body
    );
    return response
      .status(201)
      .json({ supplyList: await serializeSupplyList(list) });
  } catch (error) {
    if (supplyListError(response, error)) return;
    throw error;
  }
}

export async function duplicateMySupplyList(request, response) {
  try {
    const list = await duplicateUserSupplyList(
      prisma,
      request.user.id,
      request.params.id,
      request.body
    );
    return response
      .status(201)
      .json({ supplyList: await serializeSupplyList(list) });
  } catch (error) {
    if (supplyListError(response, error)) return;
    throw error;
  }
}

export async function replaceMySupplyListItems(request, response) {
  try {
    const list = await replaceUserSupplyListItems(
      prisma,
      request.user.id,
      request.params.id,
      request.body?.items
    );
    return response.json({ supplyList: await serializeSupplyList(list) });
  } catch (error) {
    if (supplyListError(response, error)) return;
    throw error;
  }
}

export async function mergeMySupplyListItems(request, response) {
  try {
    const list = await mergeUserSupplyListItems(
      prisma,
      request.user.id,
      request.params.id,
      request.body?.items
    );
    return response.json({ supplyList: await serializeSupplyList(list) });
  } catch (error) {
    if (supplyListError(response, error)) return;
    throw error;
  }
}

export async function deleteMySupplyList(request, response) {
  try {
    await deleteUserSupplyList(
      prisma,
      request.user.id,
      request.params.id
    );
    return response.status(204).end();
  } catch (error) {
    if (supplyListError(response, error)) return;
    throw error;
  }
}
