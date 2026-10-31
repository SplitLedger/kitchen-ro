import { expect, test } from "vitest";
import { allocateFifo, type AllocatableLot } from "./allocate";

function lot(
  patch: Partial<AllocatableLot> & Pick<AllocatableLot, "id" | "quantity" | "acquiredOn">,
): AllocatableLot {
  return {
    unitPrice: 10,
    source: "bought",
    note: "",
    ...patch,
  };
}

test("takes older lots first, then the lower id on the same day", () => {
  const result = allocateFifo(
    [
      lot({ id: 3, quantity: 4, acquiredOn: "2026-02-01", unitPrice: 30 }),
      lot({ id: 2, quantity: 5, acquiredOn: "2026-01-01", unitPrice: 20 }),
      lot({
        id: 1,
        quantity: 2,
        acquiredOn: "2026-01-01",
        unitPrice: 10,
        source: "farmed",
        note: "patch",
      }),
    ],
    8,
  );

  expect(result).toEqual({
    ok: true,
    slices: [
      {
        lotId: 1,
        quantity: 2,
        unitPrice: 10,
        source: "farmed",
        note: "patch",
        acquiredOn: "2026-01-01",
      },
      {
        lotId: 2,
        quantity: 5,
        unitPrice: 20,
        source: "bought",
        note: "",
        acquiredOn: "2026-01-01",
      },
      {
        lotId: 3,
        quantity: 1,
        unitPrice: 30,
        source: "bought",
        note: "",
        acquiredOn: "2026-02-01",
      },
    ],
  });
});

test("a shortfall is the whole miss, not a partial deduct", () => {
  const result = allocateFifo(
    [
      lot({ id: 1, quantity: 2, acquiredOn: "2026-01-01" }),
      lot({ id: 2, quantity: 0, acquiredOn: "2026-01-02" }),
    ],
    5,
  );
  expect(result).toEqual({ ok: false, shortfall: 3 });
});

test("zero need allocates nothing", () => {
  expect(allocateFifo([lot({ id: 1, quantity: 4, acquiredOn: "2026-01-01" })], 0)).toEqual({
    ok: true,
    slices: [],
  });
});
