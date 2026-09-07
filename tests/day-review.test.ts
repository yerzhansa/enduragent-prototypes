import { describe, expect, it } from "vitest";
import { initialState, parseScenario, reduceDayReview } from "../src/day-review";

describe("fictional day review", () => {
  it("reviews a selected day and preserves it when returning", () => {
    const editing = reduceDayReview(initialState("editing"), { type: "select", day: "Friday" });
    const review = reduceDayReview(editing, { type: "review" });
    expect(review).toEqual({ stage: "review", day: "Friday" });
    expect(reduceDayReview(review, { type: "close-review" })).toEqual(editing);
  });
  it("cannot review without a selected day", () => {
    const empty = initialState("empty");
    expect(reduceDayReview(empty, { type: "review" })).toBe(empty);
  });
  it("cancels discard without changing the selection", () => {
    const editing = reduceDayReview(initialState("editing"), { type: "select", day: "Sunday" });
    const confirmation = reduceDayReview(editing, { type: "discard" });
    expect(reduceDayReview(confirmation, { type: "select", day: "Tuesday" })).toBe(confirmation);
    expect(reduceDayReview(confirmation, { type: "cancel-discard" })).toEqual(editing);
    expect(reduceDayReview(confirmation, { type: "confirm-discard" })).toEqual(
      initialState("empty"),
    );
  });
  it("resets between scenarios and does not share mutable state", () => {
    const changed = reduceDayReview(initialState("editing"), { type: "select", day: "Thursday" });
    expect(reduceDayReview(changed, { type: "reset", scenario: "empty" })).toEqual(
      initialState("empty"),
    );
    expect(initialState("editing")).toEqual({ stage: "editing", day: "Monday" });
    expect(parseScenario("unknown")).toBe("editing");
  });
});
