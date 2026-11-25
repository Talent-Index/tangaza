import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { destinationFor, parseAuthRole } from "./auth-role";

describe("sign-in role", () => {
  it("sends a business to the business portal and an ambassador home", () => {
    assert.equal(destinationFor("business"), "/org/overview");
    assert.equal(destinationFor("ambassador"), "/");
  });

  it("treats a missing or unknown role as an ambassador", () => {
    assert.equal(parseAuthRole(null), "ambassador");
    assert.equal(parseAuthRole("business"), "business");
    assert.equal(parseAuthRole("nope"), "ambassador");
  });
});
