import { cleanText, isValidId } from "../utils/records.js";

export const MAX_SUPPLY_LISTS = 50;
export const MAX_SUPPLY_LIST_ITEMS = 100;
export const MAX_SUPPLY_LIST_QUANTITY = 999;
export const MAX_SUPPLY_LIST_NAME_LENGTH = 100;
export const MAX_SUPPLY_LIST_BRANCH_LENGTH = 120;
export const MAX_SUPPLY_LIST_DESCRIPTION_LENGTH = 500;
export const MAX_SUPPLY_LIST_OPTIONS_LENGTH = 300;

const SAVABLE_PRODUCT_STATUSES = new Set([
  "ACTIVE",
  "LOW_STOCK",
  "OUT_OF_STOCK",
]);

const supplyListInclude = {
  items: {
    include: { product: true },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "asc" }],
  },
};

export class SupplyListRequestError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = "SupplyListRequestError";
    this.statusCode = statusCode;
  }
}

function requiredText(value, name, maxLength) {
  if (typeof value !== "string") {
    throw new SupplyListRequestError(400, `${name} is required.`);
  }
  const cleaned = cleanText(value, maxLength + 1);
  if (!cleaned) {
    throw new SupplyListRequestError(400, `${name} is required.`);
  }
  if (cleaned.length > maxLength) {
    throw new SupplyListRequestError(
      400,
      `${name} cannot exceed ${maxLength} characters.`
    );
  }
  return cleaned;
}

function optionalText(value, name, maxLength) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") {
    throw new SupplyListRequestError(400, `${name} is invalid.`);
  }
  const cleaned = cleanText(value, maxLength + 1);
  if (cleaned.length > maxLength) {
    throw new SupplyListRequestError(
      400,
      `${name} cannot exceed ${maxLength} characters.`
    );
  }
  return cleaned || null;
}

export function parseSupplyListDetails(input) {
  return {
    name: requiredText(
      input?.name,
      "Supply list name",
      MAX_SUPPLY_LIST_NAME_LENGTH
    ),
    branch: requiredText(
      input?.branch,
      "Clinic branch",
      MAX_SUPPLY_LIST_BRANCH_LENGTH
    ),
    description: optionalText(
      input?.description,
      "Supply list description",
      MAX_SUPPLY_LIST_DESCRIPTION_LENGTH
    ),
  };
}

export function normalizeSupplyListOptions(value) {
  if (value === undefined || value === null || value === "") return "";
  if (
    typeof value !== "string" ||
    value.length > MAX_SUPPLY_LIST_OPTIONS_LENGTH
  ) {
    throw new SupplyListRequestError(400, "Selected product options are invalid.");
  }
  return cleanText(value, MAX_SUPPLY_LIST_OPTIONS_LENGTH);
}

export function parseSupplyListItems(inputs) {
  if (!Array.isArray(inputs) || inputs.length > MAX_SUPPLY_LIST_ITEMS) {
    throw new SupplyListRequestError(
      400,
      `A supply list cannot contain more than ${MAX_SUPPLY_LIST_ITEMS} different items.`
    );
  }

  const itemsByKey = new Map();
  for (const input of inputs) {
    const productId =
      typeof input?.productId === "string" ? input.productId.trim() : "";
    if (!isValidId(productId)) {
      throw new SupplyListRequestError(400, "A valid product is required.");
    }

    const quantity = input?.quantity;
    if (
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > MAX_SUPPLY_LIST_QUANTITY
    ) {
      throw new SupplyListRequestError(
        400,
        `Quantity must be a whole number between 1 and ${MAX_SUPPLY_LIST_QUANTITY}.`
      );
    }

    const selectedOptions = normalizeSupplyListOptions(input?.selectedOptions);
    const key = `${productId}\u0000${selectedOptions}`;
    const mergedQuantity = (itemsByKey.get(key)?.quantity ?? 0) + quantity;
    if (mergedQuantity > MAX_SUPPLY_LIST_QUANTITY) {
      throw new SupplyListRequestError(
        400,
        `A product quantity cannot exceed ${MAX_SUPPLY_LIST_QUANTITY}.`
      );
    }
    itemsByKey.set(key, { productId, selectedOptions, quantity: mergedQuantity });
  }

  if (itemsByKey.size > MAX_SUPPLY_LIST_ITEMS) {
    throw new SupplyListRequestError(
      400,
      `A supply list cannot contain more than ${MAX_SUPPLY_LIST_ITEMS} different items.`
    );
  }
  return [...itemsByKey.values()];
}

async function assertProductsCanBeSaved(database, items) {
  if (items.length === 0) return;
  const productIds = [...new Set(items.map((item) => item.productId))];
  const products = await database.product.findMany({
    where: { id: { in: productIds } },
    select: {
      id: true,
      name: true,
      price: true,
      status: true,
    },
  });
  if (products.length !== productIds.length) {
    throw new SupplyListRequestError(
      400,
      "One or more selected products no longer exist."
    );
  }

  const unavailable = products.find(
    (product) =>
      !SAVABLE_PRODUCT_STATUSES.has(product.status) ||
      !(Number(product.price) > 0)
  );
  if (unavailable) {
    throw new SupplyListRequestError(
      409,
      `${unavailable.name} cannot currently be added to a supply list.`
    );
  }
}

async function assertListCapacity(database, userId) {
  const listCount = await database.supplyList.count({ where: { userId } });
  if (listCount >= MAX_SUPPLY_LISTS) {
    throw new SupplyListRequestError(
      409,
      `An account cannot contain more than ${MAX_SUPPLY_LISTS} supply lists.`
    );
  }
}

export async function getUserSupplyLists(database, userId) {
  return database.supplyList.findMany({
    where: { userId },
    include: supplyListInclude,
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  });
}

export async function getUserSupplyList(database, userId, listId) {
  if (!isValidId(listId)) return null;
  return database.supplyList.findFirst({
    where: { id: listId, userId },
    include: supplyListInclude,
  });
}

export async function createUserSupplyList(database, userId, input) {
  const details = parseSupplyListDetails(input);
  const items = parseSupplyListItems(input?.items ?? []);

  return database.$transaction(async (transaction) => {
    await assertListCapacity(transaction, userId);
    await assertProductsCanBeSaved(transaction, items);
    return transaction.supplyList.create({
      data: {
        userId,
        ...details,
        items: {
          create: items,
        },
      },
      include: supplyListInclude,
    });
  });
}

export async function duplicateUserSupplyList(
  database,
  userId,
  listId,
  input
) {
  return database.$transaction(async (transaction) => {
    const source = await transaction.supplyList.findFirst({
      where: { id: listId, userId },
      include: { items: true },
    });
    if (!source) {
      throw new SupplyListRequestError(404, "Supply list not found.");
    }
    await assertListCapacity(transaction, userId);
    const name = requiredText(
      input?.name,
      "Supply list name",
      MAX_SUPPLY_LIST_NAME_LENGTH
    );

    return transaction.supplyList.create({
      data: {
        userId,
        name,
        branch: source.branch,
        description: source.description,
        status: "ACTIVE",
        items: {
          create: source.items.map((item) => ({
            productId: item.productId,
            selectedOptions: item.selectedOptions,
            quantity: item.quantity,
          })),
        },
      },
      include: supplyListInclude,
    });
  });
}

export async function replaceUserSupplyListItems(
  database,
  userId,
  listId,
  inputs
) {
  const items = parseSupplyListItems(inputs);
  return database.$transaction(async (transaction) => {
    const list = await transaction.supplyList.findFirst({
      where: { id: listId, userId },
      select: { id: true },
    });
    if (!list) {
      throw new SupplyListRequestError(404, "Supply list not found.");
    }
    await assertProductsCanBeSaved(transaction, items);

    await transaction.supplyListItem.deleteMany({
      where: { supplyListId: list.id },
    });
    if (items.length > 0) {
      await transaction.supplyListItem.createMany({
        data: items.map((item) => ({ supplyListId: list.id, ...item })),
      });
    }
    return transaction.supplyList.update({
      where: { id: list.id },
      data: { updatedAt: new Date() },
      include: supplyListInclude,
    });
  });
}

export async function mergeUserSupplyListItems(
  database,
  userId,
  listId,
  inputs
) {
  const items = parseSupplyListItems(inputs);
  return database.$transaction(async (transaction) => {
    const list = await transaction.supplyList.findFirst({
      where: { id: listId, userId },
      include: { items: true },
    });
    if (!list) {
      throw new SupplyListRequestError(404, "Supply list not found.");
    }
    await assertProductsCanBeSaved(transaction, items);

    const existingByKey = new Map(
      list.items.map((item) => [
        `${item.productId}\u0000${item.selectedOptions}`,
        item,
      ])
    );
    const newItemCount = items.filter(
      (item) =>
        !existingByKey.has(`${item.productId}\u0000${item.selectedOptions}`)
    ).length;
    if (list.items.length + newItemCount > MAX_SUPPLY_LIST_ITEMS) {
      throw new SupplyListRequestError(
        409,
        `A supply list cannot contain more than ${MAX_SUPPLY_LIST_ITEMS} different items.`
      );
    }

    for (const item of items) {
      const key = `${item.productId}\u0000${item.selectedOptions}`;
      const quantity = (existingByKey.get(key)?.quantity ?? 0) + item.quantity;
      if (quantity > MAX_SUPPLY_LIST_QUANTITY) {
        throw new SupplyListRequestError(
          409,
          `A product quantity cannot exceed ${MAX_SUPPLY_LIST_QUANTITY}.`
        );
      }
      await transaction.supplyListItem.upsert({
        where: {
          supplyListId_productId_selectedOptions: {
            supplyListId: list.id,
            productId: item.productId,
            selectedOptions: item.selectedOptions,
          },
        },
        create: { supplyListId: list.id, ...item },
        update: { quantity },
      });
    }

    return transaction.supplyList.update({
      where: { id: list.id },
      data: { updatedAt: new Date() },
      include: supplyListInclude,
    });
  });
}

export async function deleteUserSupplyList(database, userId, listId) {
  if (!isValidId(listId)) {
    throw new SupplyListRequestError(404, "Supply list not found.");
  }
  const result = await database.supplyList.deleteMany({
    where: { id: listId, userId },
  });
  if (result.count === 0) {
    throw new SupplyListRequestError(404, "Supply list not found.");
  }
}
