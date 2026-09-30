import { describe, expect, it } from "vitest";
import { checkNanp, findPhoneInText, formatPhone, isFictionalNumber, validateCallback } from "../src/lib/domain/phone";

describe("NANP validation", () => {
  it.each([
    ["406-555-0142", "4065550142"],
    ["(503) 555-0119", "5035550119"],
    ["206.555.0188", "2065550188"],
    ["+1 720 555 0163", "7205550163"],
    ["17205550163", "7205550163"],
  ])("accepts %s", (raw, digits) => {
    expect(checkNanp(raw)).toMatchObject({ valid: true, digits });
  });

  it.each([
    ["123-456-7890", "area code starting with 1"],
    ["023-555-0142", "area code starting with 0"],
    ["411-555-0142", "N11 area code"],
    ["406-155-0142", "exchange starting with 1"],
    ["406-911-0142", "N11 exchange"],
    ["555-0142", "seven digits"],
    ["406-555-01423", "eleven digits not starting with 1"],
  ])("rejects %s (%s)", (raw) => {
    const check = checkNanp(raw);
    expect(check.valid).toBe(false);
    expect(check.reason).toBeTruthy();
  });

  it("only accepts the fictional 555-01XX range for callbacks", () => {
    expect(isFictionalNumber("4065550142")).toBe(true);
    expect(isFictionalNumber("4065550242")).toBe(false);
    expect(validateCallback("406-555-0242")).toMatchObject({ valid: false });
    expect(validateCallback("406-555-0199")).toMatchObject({ valid: true, formatted: "(406) 555-0199" });
  });

  it("formats and finds numbers inside text", () => {
    expect(formatPhone("4065550142")).toBe("(406) 555-0142");
    expect(findPhoneInText("call me at 971 555 0104 after 5")).toBe("971 555 0104");
    expect(findPhoneInText("no number here, zip 99992")).toBeNull();
  });
});
