import { describe, expect, test } from "bun:test";
import { getUiDataState } from "@/lib/ui-data-state";

describe("unknown-first UI data states", () => {
  test("Plan and Done distinguish query errors from an empty result", () => {
    expect(getUiDataState({ status: "error", hasData: false, hasItems: false })).toBe("error");
    expect(getUiDataState({ status: "success", hasData: true, hasItems: false })).toBe("empty");
  });

  test("Skills distinguishes missing data from an intentional sample", () => {
    expect(getUiDataState({ status: "pending", hasData: false, isSample: true })).toBe("loading");
    expect(getUiDataState({ status: "error", hasData: false, isSample: true })).toBe("error");
    expect(getUiDataState({ status: "success", hasData: true, isSample: true })).toBe("sample");
    expect(getUiDataState({ status: "success", hasData: true, isSample: false })).toBe("success");
  });

  test("resolved data being fetched again is stale, not empty", () => {
    expect(
      getUiDataState({ status: "success", hasData: true, hasItems: false, isFetching: true }),
    ).toBe("stale");
  });
});
