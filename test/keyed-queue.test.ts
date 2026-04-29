import { describe, it, expect } from "vitest";
import { KeyedQueue } from "../src/core/locks.js";

describe("KeyedQueue", () => {
  it("runs tasks sequentially for the same key", async () => {
    const queue = new KeyedQueue();
    const order: number[] = [];

    const p1 = queue.run("a", async () => {
      order.push(1);
      await new Promise((r) => setTimeout(r, 20));
      order.push(2);
      return "first";
    });
    const p2 = queue.run("a", async () => {
      order.push(3);
      return "second";
    });

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toBe("first");
    expect(r2).toBe("second");
    expect(order).toEqual([1, 2, 3]);
  });

  it("runs tasks in parallel for different keys", async () => {
    const queue = new KeyedQueue();
    const order: string[] = [];

    const p1 = queue.run("a", async () => {
      order.push("a-start");
      await new Promise((r) => setTimeout(r, 20));
      order.push("a-end");
    });
    const p2 = queue.run("b", async () => {
      order.push("b-start");
      await new Promise((r) => setTimeout(r, 5));
      order.push("b-end");
    });

    await Promise.all([p1, p2]);
    expect(order).toEqual(["a-start", "b-start", "b-end", "a-end"]);
  });

  it("does not block subsequent tasks after a failure", async () => {
    const queue = new KeyedQueue();

    const p1 = queue.run("a", async () => {
      throw new Error("fail");
    }).catch(() => "caught");
    const p2 = queue.run("a", async () => "ok");

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toBe("caught");
    expect(r2).toBe("ok");
  });

  it("cleans up key entries after completion", async () => {
    const queue = new KeyedQueue();
    // @ts-expect-error accessing private field for test
    const tails = queue.tails as Map<string, Promise<void>>;

    await queue.run("a", async () => {});
    expect(tails.has("a")).toBe(false);
  });
});
