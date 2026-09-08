import { useLayoutEffect, useRef } from "react";
import { Moon, Sun } from "lucide-react";
import { useCatalogueController } from "./controller";
import { addDays } from "./model";
import { scenarios } from "./scenarios";
import { createCatalogueView } from "./view";
import "./styles.css";

export function PlanCatalogue() {
  const controller = useCatalogueController();
  const { snapshot, reset } = controller;
  const { state, ui, selected, variation, revision } = snapshot;
  const canvas = useRef<HTMLElement>(null);
  const scenario = scenarios.find((entry) => entry.id === selected) ?? scenarios[0]!;
  const view = createCatalogueView({ ...snapshot, ...controller });
  const question = view.question();
  const libraryView = ["library", "closed"].includes(state.destination.kind);
  const drawer = ui.width === "compact" && ui.contextDrawer && !libraryView;
  const body = view.content();

  useLayoutEffect(() => {
    document.documentElement.dataset.planCatalogue = "";
    document.documentElement.dataset.theme = ui.theme;
    document.title = "Enduragent Plan in Chat";
    controller.save();
    const frame = requestAnimationFrame(() => {
      const root = canvas.current;
      if (!root) return;
      const thread = root.querySelector<HTMLElement>(".thread");
      const dock = root.querySelector<HTMLElement>(".composer-dock");
      if (thread && dock) thread.style.paddingBottom = `${dock.offsetHeight + 28}px`;
      const focus = drawer
        ? "#close-context"
        : ui.source
          ? ".plan-projection-card:last-child h3"
          : state.dialog
            ? "[data-dialog-cancel]"
            : ui.editor
              ? "#answer-form input, #answer-form textarea, #answer-form select"
              : question
                ? "#choice-title"
                : !state.creation && !state.active
                  ? "#start-plan"
                  : ".plan-projection-card h3, #page-title";
      (
        root.querySelector<HTMLElement>(ui.focus || focus) ?? root.querySelector<HTMLElement>(focus)
      )?.focus({ preventScroll: true });
      if (ui.restoreText) {
        Array.from(root.querySelectorAll("button"))
          .find((button) => button.textContent === ui.restoreText)
          ?.focus({ preventScroll: true });
        ui.restoreText = null;
      }
      ui.focus = null;
    });
    return () => cancelAnimationFrame(frame);
  }, [revision]);

  useLayoutEffect(
    () => () => {
      delete document.documentElement.dataset.planCatalogue;
    },
    [],
  );

  return (
    <main className="studio" onKeyDown={controller.onKeyDown}>
      <header className="studio-header">
        <div>
          <p className="studio-kicker">Enduragent · design exploration</p>
          <h1>Plan in Chat</h1>
          <p className="studio-summary">
            Fictional journeys in the approved Reading-room composition. These fixtures demonstrate
            visible behavior only. They do not verify production, sport prescription, providers,
            migration or durable replay.
          </p>
        </div>
        <div className="studio-actions">
          <button
            className="studio-button"
            id="theme-toggle"
            type="button"
            aria-label="Switch appearance"
            onClick={controller.toggleTheme}
          >
            {ui.theme === "dark" ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
            <span id="theme-label">{ui.theme === "dark" ? "Light" : "Dark"}</span>
          </button>
          <div className="segmented" role="group" aria-label="Prototype width">
            {(["wide", "compact"] as const).map((width) => (
              <button
                key={width}
                className={`segment${ui.width === width ? " is-active" : ""}`}
                type="button"
                data-width={width}
                aria-pressed={ui.width === width}
                onClick={() => controller.setWidth(width)}
              >
                {width === "wide" ? "Wide" : "Compact"}
              </button>
            ))}
          </div>
        </div>
      </header>
      <section className="studio-controls" aria-label="Prototype controls">
        <label className="scenario-field">
          <span>Scenario</span>
          <select
            id="scenario-select"
            value={selected}
            onChange={(event) => reset(event.target.value, "")}
          >
            {scenarios.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </select>
        </label>
      </section>
      <section
        id="fixture-controls"
        className="studio-controls"
        aria-label="Fictional simulation controls"
        key={`controls-${revision}`}
      >
        {scenario.variations?.length ? (
          <label>
            Focused alternative{" "}
            <select
              id="variation-select"
              value={variation}
              onChange={(event) => reset(selected, event.target.value)}
            >
              <option value="">Default</option>
              {scenario.variations.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {view.button("Reset this fixture", { ui: "reset" })}
        {view.button("Next build checkpoint", { type: "build-next" })}
        {view.button("Finish fixture build", { ui: "finish-build" })}
        <label>
          Next simulated outcome{" "}
          <select
            id="failure-select"
            value={state.fixture.fail ?? "none"}
            onChange={(event) => controller.setFailure(event.target.value)}
          >
            {[
              "none",
              "build",
              "translation",
              "validation",
              "interruption",
              "local",
              "calendar",
              "source-drift",
              "stale-plan",
              "stale-sync",
              "race",
              "taper",
            ].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        {view.button("Advance to Plan end", {
          type: "fixture-clock",
          date: state.active ? addDays(state.active.end, 1) : state.fixture.today,
        })}
        {view.button("Project week closure", { type: "close-week" })}
        {view.button("Project Plan completion", { type: "complete-plan" })}
        {view.button("Retry calendar", { type: "retry-calendar" })}
        {view.button("Fresh source fixture", { ui: "fresh-evidence" })}
        {view.button("Replay last confirmation", { ui: "replay" })}
        {view.button("Apply retired preview", { ui: "retired-apply" })}
        {view.button("Deliver older preview result", { ui: "older-result" })}
        {view.button("Concurrent Plan update", { type: "bump-plan-revision" })}
        <label>
          <input
            id="reduced-motion"
            type="checkbox"
            checked={!!ui.reduced}
            onChange={(event) => controller.setReduced(event.target.checked)}
          />
          Reduced motion
        </label>
      </section>
      <p className="studio-summary">
        Build checkpoints and outcome controls above belong to the studio. Use Reset this fixture to
        start again. Browser reload restores only this isolated fictional example. Supported text
        examples are listed in SCENARIOS.md.
      </p>
      <section className="direction-note" id="direction-note" aria-live="polite">
        <div className="direction-note-copy">
          <strong>{scenario.name}</strong>
          <p>{scenario.purpose}</p>
          <p>{(scenario.steps ?? []).join(" → ")}</p>
        </div>
        <span className="experiment-label">
          {`Fictional UI · ${(scenario.acceptance ?? []).join(", ")}`}
        </span>
      </section>
      <section
        className="canvas"
        id="prototype-canvas"
        aria-label="Interactive Plan-in-Chat prototype"
        ref={canvas}
      >
        <div
          className="app-frame"
          data-width={ui.width}
          data-reduced-motion={ui.reduced ? "true" : undefined}
          key={revision}
        >
          <div className="catalogue-shell" inert={!!(state.dialog || drawer)}>
            {view.sidebar()}
            <section
              className={`${libraryView ? "plan-flow-surface" : "chat-surface direction-reading"} ${question ? "has-coach-answer-prompt" : ""} ${!ui.context ? "context-closed" : ""}`}
            >
              <header className="chat-header">
                <h2 id="page-title" tabIndex={-1}>
                  {libraryView ? "Plan" : "Current conversation"}
                </h2>
                {libraryView
                  ? !state.creation
                    ? view.button(
                        state.active ? "Start a new Plan" : "Start a Plan",
                        { type: "start" },
                        "primary",
                        { id: "start-plan" },
                      )
                    : null
                  : view.button(
                      ui.width === "compact"
                        ? "Training context"
                        : ui.context
                          ? "Hide context"
                          : "Show context",
                      { ui: "context" },
                      "",
                      {
                        id: "context-toggle",
                        "aria-expanded": ui.width === "compact" ? !!drawer : !!ui.context,
                      },
                    )}
              </header>
              <div
                className={`chat-layout-context ${ui.context && !libraryView ? "" : "is-closed"}`}
              >
                <div className="thread-region">
                  <div className="thread">
                    <div className="turn coach-turn">
                      <div className="coach-copy">
                        {body}
                        {ui.source ? view.sourceCard(ui.source) : null}
                      </div>
                    </div>
                  </div>
                </div>
                {ui.context && !libraryView && ui.width !== "compact" ? view.contextPanel() : null}
              </div>
              {libraryView ? null : view.composer(question)}
            </section>
          </div>
          {view.dialog()}
          {drawer ? <div className="context-drawer-layer">{view.contextPanel(true)}</div> : null}
        </div>
      </section>
      <section className="coverage">
        <div>
          <p className="studio-kicker">Coverage</p>
          <h2>Journey catalogue</h2>
          <p>
            Select a journey or focused alternative. Each entry names its acceptance references and
            the actions to exercise.
          </p>
        </div>
        <div className="coverage-grid" id="coverage-grid">
          {scenarios.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={`coverage-button ${entry.id === selected ? "is-active" : ""}`}
              data-scenario={entry.id}
              onClick={() => reset(entry.id, "")}
            >
              <strong>{entry.name}</strong>
              <span className="coverage-meta">
                {`${entry.group} · ${(entry.acceptance ?? []).join(", ")}`}
              </span>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
