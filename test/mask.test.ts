import { describe, expect, it } from "vitest";
import { createMask } from "../src/mask.js";
import { USER_FIXTURE } from "./helpers.js";

describe("createMask (data masking)", () => {
  it("allows reading declared fields", () => {
    const masked = createMask(USER_FIXTURE, ["id", "name"], "UserCard");
    expect(masked.id).toBe("u1");
    expect(masked.name).toBe("Ada Lovelace");
  });

  it("throws when reading an undeclared but existing field", () => {
    const masked = createMask(USER_FIXTURE, ["id", "name"], "UserCard") as Record<
      string,
      unknown
    >;
    expect(() => masked.email).toThrow(/undeclared field "email"/);
  });

  it("only enumerates declared fields", () => {
    const masked = createMask(USER_FIXTURE, ["id", "name"], "UserCard");
    expect(Object.keys(masked).sort()).toEqual(["id", "name"]);
  });

  it("is JSON-serializable over the declared fields", () => {
    const masked = createMask(USER_FIXTURE, ["id", "name"], "UserCard");
    expect(JSON.parse(JSON.stringify(masked))).toEqual({
      id: "u1",
      name: "Ada Lovelace",
    });
  });
});
