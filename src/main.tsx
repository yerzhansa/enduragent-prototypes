import "./styles.css";
import { useEffect, useReducer, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  InlineConfirmation,
  Page,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  applyPalette,
  paletteById,
  type ResolvedTheme,
} from "@enduragent/ui";
import {
  days,
  initialState,
  parseScenario,
  reduceDayReview,
  scenarios,
  type Day,
  type Scenario,
} from "./day-review";

declare const __UI_VERSION__: string;
declare const __SOURCE_REVISION__: string;

const dayOptions = days.map((day) => ({ label: day, value: day }));
const scenarioNames: Record<Scenario, string> = {
  editing: "Day selected",
  empty: "No day selected",
  review: "Review open",
  discard: "Discard confirmation",
};
const scenarioOptions = scenarios.map((value) => ({ label: scenarioNames[value], value }));

function App() {
  const [scenario, setScenario] = useState(() =>
    parseScenario(new URL(location.href).searchParams.get("scenario")),
  );
  const [state, dispatch] = useReducer(reduceDayReview, scenario, initialState);
  const [theme, setTheme] = useState<ResolvedTheme>(() =>
    matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
  );
  const discardButton = useRef<HTMLButtonElement>(null);
  const reviewButton = useRef<HTMLButtonElement>(null);
  const closeReviewButton = useRef<HTMLButtonElement>(null);
  const dayTrigger = useRef<HTMLButtonElement>(null);
  const current = state.stage === "discard" ? state.previous : state;

  useEffect(() => {
    applyPalette({
      root: document.documentElement,
      palette: paletteById("patrol"),
      appearance: theme,
    });
  }, [theme]);

  function reset(next: Scenario) {
    setScenario(next);
    dispatch({ type: "reset", scenario: next });
  }

  function cancelDiscard() {
    dispatch({ type: "cancel-discard" });
    requestAnimationFrame(() => discardButton.current?.focus());
  }

  function confirmDiscard() {
    dispatch({ type: "confirm-discard" });
    requestAnimationFrame(() => dayTrigger.current?.focus());
  }

  return (
    <main className="flex min-w-0 flex-1 flex-col bg-bg text-ink">
      <div
        className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3"
        aria-label="Experiment controls"
      >
        <span className="text-xs font-medium text-ink-2">Experimental · Fictional data</span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Select<Scenario>
            items={scenarioOptions}
            value={scenario}
            onValueChange={(value) => {
              if (value !== null) reset(value);
            }}
          >
            <SelectTrigger aria-label="Scenario" className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {scenarioOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" onClick={() => reset(scenario)}>
            Reset
          </Button>
          <Button
            variant="outline"
            size="sm"
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} appearance`}
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          >
            {theme === "light" ? "Dark" : "Light"}
          </Button>
        </div>
      </div>
      <Page
        title="Training day"
        action={
          <Button
            ref={reviewButton}
            disabled={current.day === null || state.stage === "discard"}
            onClick={() => dispatch({ type: "review" })}
          >
            Review
          </Button>
        }
      >
        <div className="flex flex-col gap-6">
          <div>
            <h2 className="m-0 text-sm font-medium">Choose a day</h2>
            <p className="mt-2 text-sm text-ink-2">
              Try selecting a training day, reviewing it, and discarding your selection.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 border-y border-line py-4">
            <label htmlFor="training-day" className="text-sm">
              Training day
            </label>
            <Select<Day>
              items={dayOptions}
              value={current.day}
              disabled={state.stage === "discard"}
              onValueChange={(day) => dispatch({ type: "select", day })}
            >
              <SelectTrigger
                ref={dayTrigger}
                id="training-day"
                aria-label="Training day"
                className="w-52"
              >
                <SelectValue placeholder="Choose a day" />
              </SelectTrigger>
              <SelectContent>
                {dayOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end">
            <Button
              ref={discardButton}
              variant="ghost"
              disabled={current.day === null || state.stage === "discard"}
              onClick={() => dispatch({ type: "discard" })}
            >
              Discard selection
            </Button>
          </div>
          {state.stage === "discard" ? (
            <InlineConfirmation
              name="day-selection"
              title="Discard your selection?"
              copy="You can choose another day afterward."
              confirmLabel="Discard"
              focusTarget="cancel"
              onCancel={cancelDiscard}
              onConfirm={confirmDiscard}
            />
          ) : null}
          <p className="text-xs text-ink-3">
            This experiment does not change a training plan or save your selection.
          </p>
          <details className="text-xs text-ink-3">
            <summary className="cursor-pointer">Review details</summary>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 py-3">
              <dt>Experiment</dt>
              <dd className="m-0">day-review</dd>
              <dt>Scenario</dt>
              <dd className="m-0">{scenario}</dd>
              <dt>UI version</dt>
              <dd className="m-0">{__UI_VERSION__}</dd>
              <dt>Source</dt>
              <dd className="m-0 break-all">{__SOURCE_REVISION__}</dd>
              <dt>Appearance</dt>
              <dd className="m-0">{theme}</dd>
            </dl>
          </details>
        </div>
      </Page>
      <Dialog
        open={state.stage === "review"}
        onOpenChange={(open) => {
          if (!open) dispatch({ type: "close-review" });
        }}
      >
        <DialogContent
          showCloseButton={false}
          initialFocus={closeReviewButton}
          finalFocus={reviewButton}
        >
          <DialogHeader>
            <DialogTitle>Review your day</DialogTitle>
            <DialogDescription>{current.day} is selected for this experiment.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button ref={closeReviewButton} onClick={() => dispatch({ type: "close-review" })}>
              Back to selection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

const root = document.getElementById("root");
if (root === null) throw new Error("Prototype root is missing");
createRoot(root).render(<App />);
