import { describe, expect, it } from "vitest";
import { identifyAccount, isEmail, isPhone, isValidAccount } from "./accountIdentifier";

describe("accountIdentifier", () => {
  describe("identifyAccount", () => {
    it.each([
      ["13800138000", "phone"],
      ["  13800138000  ", "phone"],
      ["alice@example.com", "email"],
      ["alice@x.com", "email"],
      ["alice+bob@example.co.uk", "email"],
      ["", "invalid"],
      ["abc", "invalid"],
      ["12345", "invalid"],
      ["123456789012", "invalid"],
      ["@example.com", "invalid"],
      ["alice@", "invalid"],
      ["alice@x", "invalid"]
    ] as const)("identifyAccount(%j) → %s", (input, expected) => {
      expect(identifyAccount(input)).toBe(expected);
    });
  });

  describe("isPhone / isEmail / isValidAccount", () => {
    it("isPhone", () => {
      expect(isPhone("13800138000")).toBe(true);
      expect(isPhone("alice@x.com")).toBe(false);
      expect(isPhone("12345")).toBe(false);
    });
    it("isEmail", () => {
      expect(isEmail("alice@x.com")).toBe(true);
      expect(isEmail("13800138000")).toBe(false);
    });
    it("isValidAccount", () => {
      expect(isValidAccount("13800138000")).toBe(true);
      expect(isValidAccount("alice@x.com")).toBe(true);
      expect(isValidAccount("abc")).toBe(false);
    });
  });
});
