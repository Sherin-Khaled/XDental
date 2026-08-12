import assert from "node:assert/strict";
import test from "node:test";
import {
  SupplyListRequestError,
  createUserSupplyList,
  deleteUserSupplyList,
  getUserSupplyList,
  getUserSupplyLists,
  parseSupplyListDetails,
  parseSupplyListItems,
  replaceUserSupplyListItems,
} from "./supplyList.service.js";

test("validates list metadata and normalizes duplicate item inputs", () => {
  assert.deepEqual(
    parseSupplyListDetails({
      name: " Monthly Supplies ",
      branch: " Main Clinic ",
      description: " Repeat order ",
    }),
    {
      name: "Monthly Supplies",
      branch: "Main Clinic",
      description: "Repeat order",
    }
  );
  assert.deepEqual(
    parseSupplyListItems([
      {
        productId: " product-1 ",
        quantity: 2,
        selectedOptions: " Shade A2 ",
      },
      {
        productId: "product-1",
        quantity: 3,
        selectedOptions: "Shade A2",
      },
    ]),
    [
      {
        productId: "product-1",
        quantity: 5,
        selectedOptions: "Shade A2",
      },
    ]
  );
  assert.throws(
    () =>
      parseSupplyListDetails({
        name: "",
        branch: "Main Clinic",
      }),
    SupplyListRequestError
  );
  assert.throws(
    () =>
      parseSupplyListItems([
        { productId: "product-1", quantity: 0 },
      ]),
    SupplyListRequestError
  );
});

test("list reads are always scoped to the authenticated user", async () => {
  const captured = [];
  const database = {
    supplyList: {
      findMany: async (query) => {
        captured.push(query.where);
        return [];
      },
      findFirst: async (query) => {
        captured.push(query.where);
        return null;
      },
    },
  };

  await getUserSupplyLists(database, "customer-a");
  await getUserSupplyList(database, "customer-a", "list-1");

  assert.deepEqual(captured, [
    { userId: "customer-a" },
    { id: "list-1", userId: "customer-a" },
  ]);
});

test("creation stores only server-approved ownership and product references", async () => {
  let createQuery;
  const transaction = {
    supplyList: {
      count: async () => 0,
      create: async (query) => {
        createQuery = query;
        return { id: "list-1", items: [] };
      },
    },
    product: {
      findMany: async () => [
        {
          id: "product-1",
          name: "Server Product",
          price: 250,
          status: "ACTIVE",
        },
      ],
    },
  };
  const database = {
    $transaction: async (callback) => callback(transaction),
  };

  await createUserSupplyList(database, "customer-a", {
    name: "My List",
    branch: "Main Clinic",
    description: "Monthly",
    price: 1,
    userId: "customer-b",
    items: [
      {
        productId: "product-1",
        quantity: 2,
        selectedOptions: "Shade A2",
        unitPrice: 1,
        productName: "Browser Product",
      },
    ],
  });

  assert.deepEqual(createQuery.data, {
    userId: "customer-a",
    name: "My List",
    branch: "Main Clinic",
    description: "Monthly",
    items: {
      create: [
        {
          productId: "product-1",
          quantity: 2,
          selectedOptions: "Shade A2",
        },
      ],
    },
  });
  assert.equal("price" in createQuery.data, false);
  assert.equal("productName" in createQuery.data.items.create[0], false);
});

test("another account cannot replace items in a list it does not own", async () => {
  let ownershipQuery;
  let deleteCalled = false;
  const transaction = {
    supplyList: {
      findFirst: async (query) => {
        ownershipQuery = query;
        return null;
      },
    },
    supplyListItem: {
      deleteMany: async () => {
        deleteCalled = true;
      },
    },
  };
  const database = {
    $transaction: async (callback) => callback(transaction),
  };

  await assert.rejects(
    replaceUserSupplyListItems(
      database,
      "customer-b",
      "customer-a-list",
      []
    ),
    (error) =>
      error instanceof SupplyListRequestError && error.statusCode === 404
  );
  assert.deepEqual(ownershipQuery.where, {
    id: "customer-a-list",
    userId: "customer-b",
  });
  assert.equal(deleteCalled, false);
});

test("deletion is scoped to both list id and authenticated user id", async () => {
  let capturedWhere;
  const database = {
    supplyList: {
      deleteMany: async ({ where }) => {
        capturedWhere = where;
        return { count: 1 };
      },
    },
  };

  await deleteUserSupplyList(database, "customer-b", "list-2");
  assert.deepEqual(capturedWhere, {
    id: "list-2",
    userId: "customer-b",
  });
});
