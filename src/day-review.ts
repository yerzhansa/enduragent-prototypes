export const days = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;
export type Day = (typeof days)[number];
export const scenarios = ["editing", "empty", "review", "discard"] as const;
export type Scenario = (typeof scenarios)[number];

export type EditingState = { readonly stage: "editing"; readonly day: Day | null };
export type State =
  | EditingState
  | { readonly stage: "review"; readonly day: Day }
  | { readonly stage: "discard"; readonly previous: EditingState };

export type Action =
  | { readonly type: "select"; readonly day: Day | null }
  | { readonly type: "review" }
  | { readonly type: "close-review" }
  | { readonly type: "discard" }
  | { readonly type: "cancel-discard" }
  | { readonly type: "confirm-discard" }
  | { readonly type: "reset"; readonly scenario: Scenario };

export function parseScenario(value: string | null): Scenario {
  return scenarios.find((scenario) => scenario === value) ?? "editing";
}

export function initialState(scenario: Scenario): State {
  switch (scenario) {
    case "editing":
      return { stage: "editing", day: "Monday" };
    case "empty":
      return { stage: "editing", day: null };
    case "review":
      return { stage: "review", day: "Monday" };
    case "discard":
      return { stage: "discard", previous: { stage: "editing", day: "Monday" } };
  }
}

export function reduceDayReview(state: State, action: Action): State {
  switch (action.type) {
    case "reset":
      return initialState(action.scenario);
    case "select":
      return state.stage === "editing" ? { stage: "editing", day: action.day } : state;
    case "review":
      return state.stage === "editing" && state.day !== null
        ? { stage: "review", day: state.day }
        : state;
    case "close-review":
      return state.stage === "review" ? { stage: "editing", day: state.day } : state;
    case "discard":
      return state.stage === "editing" ? { stage: "discard", previous: state } : state;
    case "cancel-discard":
      return state.stage === "discard" ? state.previous : state;
    case "confirm-discard":
      return state.stage === "discard" ? { stage: "editing", day: null } : state;
  }
}
