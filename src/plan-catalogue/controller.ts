import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import * as M from "./model";
import { scenarios, seed } from "./scenarios";
import type { ChangeIntent, Command, State } from "./types";
import type { CatalogueAction, CatalogueSnapshot, CatalogueUi, FormValues } from "./ui-types";

const storageKey = "enduragent-fictional-plan-catalogue-v1";
const labels = {
  goal: "Main Goal",
  length: "Plan length",
  mode: "Schedule mode",
  availability: "Availability",
  start: "Start timing",
  commitments: "Commitments",
  baseline: "Recent training",
  success: "Success",
  restriction: "Training restriction",
  supportingEvents: "Supporting Events",
};
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function initialSnapshot(): CatalogueSnapshot {
  const params = new URLSearchParams(location.search);
  const selected =
    scenarios.find((item) => item.id === params.get("scenario"))?.id ?? "creation-start";
  const variation = params.get("variation") || "";
  let state = seed(selected, variation);
  let ui: CatalogueUi = {
    theme: params.get("theme") === "light" ? "light" : "dark",
    width: params.get("width") === "compact" ? "compact" : "wide",
    editor: null,
    values: {},
    how: false,
    editHub: false,
    context: true,
    source: null,
    error: "",
  };
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (
      record(saved) &&
      saved.version === 1 &&
      saved.selected === selected &&
      saved.variation === variation &&
      record(saved.state) &&
      record(saved.ui)
    ) {
      const candidate = saved.state;
      if (
        record(candidate.fixture) &&
        record(candidate.destination) &&
        typeof candidate.destination.kind === "string" &&
        Array.isArray(candidate.closed) &&
        Array.isArray(candidate.changeHistory) &&
        Array.isArray(candidate.messages) &&
        Array.isArray(candidate.legacy) &&
        record(candidate.outcomes) &&
        typeof candidate.serial === "number" &&
        typeof candidate.notice === "string" &&
        (candidate.creation === null || record(candidate.creation)) &&
        (candidate.active === null || record(candidate.active)) &&
        (candidate.change === null || record(candidate.change)) &&
        (candidate.dialog === null || record(candidate.dialog)) &&
        typeof candidate.fixture.today === "string" &&
        typeof candidate.fixture.connected === "boolean" &&
        record(candidate.fixture.facts) &&
        Array.isArray(candidate.fixture.events) &&
        Array.isArray(candidate.fixture.ftpSources) &&
        record(saved.ui.values) &&
        (saved.ui.theme === "light" || saved.ui.theme === "dark") &&
        (saved.ui.width === "wide" || saved.ui.width === "compact")
      ) {
        state = candidate as unknown as State;
        ui = {
          ...ui,
          ...saved.ui,
          theme: params.has("theme") ? ui.theme : saved.ui.theme,
          width: params.has("width") ? ui.width : saved.ui.width,
        };
      }
    }
  } catch {}
  if (selected === "custom-answer" && !ui.editor) ui.editor = "goal";
  return { state, ui, selected, variation, revision: 0 };
}

function values(form: HTMLFormElement): FormValues {
  const data = new FormData(form);
  const result: FormValues = {};
  for (const [key, value] of data) if (typeof value === "string") result[key] = value;
  result.days = data.getAll("days").filter((value): value is string => typeof value === "string");
  return result;
}

function changeIntent(data: FormData, state: State): ChangeIntent {
  const text = (key: string) => {
    const value = data.get(key);
    return typeof value === "string" ? value : undefined;
  };
  const operation = text("operation");
  if (
    operation !== undefined &&
    operation !== "add" &&
    operation !== "remove" &&
    operation !== "role" &&
    operation !== "manual" &&
    operation !== "source-update" &&
    operation !== "name"
  )
    throw new Error("Unknown Supporting Event operation");
  const fields = {
    day: Number(text("day")),
    minutes: Number(text("minutes")),
    hours: Number(text("hours")),
    ftp: Number(text("ftp")),
    operation,
    event: {
      id: operation === "add" ? "support-local" : text("eventId"),
      name: text("name"),
      date: text("date"),
      role: text("role"),
      source:
        state.active?.supportingEvents.find((event) => event.id === text("eventId"))?.source ||
        "Your answer",
    },
  };
  const kind = text("kind");
  switch (kind) {
    case "weekday-duration":
    case "weekday-unavailable":
    case "hard-weekday":
    case "weekly-duration":
    case "longest-workout":
    case "ftp":
    case "supporting-event":
      return { kind, ...fields, operation };
    default:
      throw new Error("Unknown Plan change");
  }
}

export function useCatalogueController() {
  const current = useRef<CatalogueSnapshot | null>(null);
  if (!current.current) current.current = initialSnapshot();
  const snapshot = current.current;
  const [, setRevision] = useState(0);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const save = () =>
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        version: 1,
        selected: snapshot.selected,
        variation: snapshot.variation,
        state: snapshot.state,
        ui: snapshot.ui,
      }),
    );
  const render = () => {
    snapshot.revision += 1;
    save();
    setRevision(snapshot.revision);
  };
  const transition = (command: Command) => {
    snapshot.state = M.transition(snapshot.state, command);
  };
  const reset = (id = snapshot.selected, variation = snapshot.variation) => {
    snapshot.selected = id;
    snapshot.variation = variation;
    snapshot.state = seed(id, variation);
    snapshot.ui = {
      ...snapshot.ui,
      editor: null,
      values: {},
      contextDrawer: false,
      editHub: false,
      source: null,
      error: "",
      daily: false,
      pausedEditor: null,
      planDetails: null,
      lastCommand: null,
      commandSerial: 0,
      dialogFocus: null,
      restoreText: null,
    };
    if (id === "custom-answer") snapshot.ui.editor = "goal";
    const url = new URL(location.href);
    url.searchParams.set("scenario", id);
    if (variation) url.searchParams.set("variation", variation);
    else url.searchParams.delete("variation");
    history.replaceState(null, "", url);
    render();
  };
  const run = (input: CatalogueAction) => {
    const ui = snapshot.ui;
    ui.error = "";
    if ("ui" in input) {
      const action = input;
      switch (action.ui) {
        case "reset":
          reset();
          return;
        case "finish-build": {
          let remaining = snapshot.state.creation?.build?.weeks || 0;
          while (
            snapshot.state.creation?.build &&
            snapshot.state.creation.build.completed < snapshot.state.creation.build.weeks &&
            remaining-- > 0
          )
            transition({ type: "build-next" });
          transition({ type: "build-finish" });
          break;
        }
        case "replay": {
          const last = snapshot.state.changeHistory.at(-1);
          if (!ui.lastCommand && last?.status === "cancelled") {
            const action: Command = {
              type: "cancel-change",
              id: last.id,
              commandId: "fixture-cancel-retry",
            };
            transition(action);
            ui.lastCommand = action;
          }
          transition(
            ui.lastCommand || { type: "confirm-activate", commandId: "fixture-result-retry" },
          );
          break;
        }
        case "retired-apply":
          transition({
            type: "apply-change",
            id: snapshot.state.changeHistory.at(-1)?.id || "retired",
          });
          break;
        case "older-result":
          transition({
            type: "request-change",
            intent: { kind: "ftp", ftp: 220 },
            expectedRevision: 0,
            expectedSerial: 0,
          });
          break;
        case "refresh-preview":
          transition({
            type: "request-change",
            intent: snapshot.state.change?.intent || {
              kind: "weekday-duration",
              day: 3,
              minutes: 30,
            },
          });
          break;
        case "fresh-evidence":
          transition({ type: "set-fixture", key: "guard", value: null });
          transition({ type: "set-fixture", key: "syncStale", value: false });
          transition({ type: "set-fixture", key: "evidenceMissing", value: false });
          transition({ type: "set-fixture", key: "fail", value: null });
          transition({ type: "set-fixture", key: "connected", value: true });
          transition({
            type: "notice",
            text: "Sources are available again. Request a fresh preview before applying.",
          });
          break;
        case "plan-details":
          ui.planDetails = action.id;
          transition({ type: "navigate", destination: { kind: "library" } });
          break;
        case "editor": {
          ui.editHub = false;
          ui.editor = action.key;
          ui.values = {};
          const creation = snapshot.state.creation;
          if (
            action.key !== "change" &&
            action.key !== "supporting" &&
            creation &&
            M.nextQuestion(creation) !== action.key
          )
            transition({ type: "edit", key: action.key });
          break;
        }
        case "back-editor": {
          const key = ui.editor,
            editing = snapshot.state.creation?.editing,
            returnToDraft = editing && snapshot.state.creation?.draft;
          ui.editor = null;
          ui.values = {};
          if (key) {
            ui.focus = `[data-editor-trigger="${key}"]`;
            if (key === "change") ui.restoreText = "Change one thing";
          } else {
            transition({ type: editing ? "cancel-edit" : "later" });
            if (returnToDraft) ui.restoreText = "Edit answers";
            else ui.focus = editing ? "#choice-title" : "#coach-composer";
          }
          break;
        }
        case "edit-hub":
          ui.editHub = true;
          break;
        case "leave-hub":
          ui.editHub = false;
          transition({ type: "cancel-edit" });
          ui.restoreText = "Edit answers";
          break;
        case "context":
          if (ui.width === "compact") {
            ui.contextDrawer = !ui.contextDrawer;
            ui.focus = ui.contextDrawer ? "#close-context" : "#context-toggle";
          } else {
            ui.context = !ui.context;
            ui.focus = "#context-toggle";
          }
          break;
        case "source":
          ui.source = action.value || {
            Source: "Confirmed athlete limits",
            Confidence: "Based on confirmed details",
          };
          break;
        case "close-source":
          ui.source = null;
          break;
        case "daily":
          ui.daily = !ui.daily;
          break;
        case "send": {
          const text = composerRef.current?.value.trim();
          if (text) {
            transition({ type: "chat-message", text });
            const interpreted = M.interpret(text, snapshot.state);
            if (
              interpreted.type === "request-change" ||
              interpreted.type === "answer" ||
              interpreted.type === "commitment-edit" ||
              snapshot.state.destination.kind === "change"
            ) {
              transition(interpreted);
              if (interpreted.type === "answer" || interpreted.type === "commitment-edit") {
                transition({ type: "continue", id: interpreted.creationId });
                ui.pausedEditor = null;
              }
            } else
              transition({
                type: "notice",
                text: "Your message is in Chat. Your unfinished planning work is unchanged.",
              });
          }
          break;
        }
      }
    } else {
      let action: Command = input;
      const creation = snapshot.state.creation;
      if (action.type === "edit") {
        ui.editHub = false;
        ui.editor = null;
      }
      if (
        (action.type === "later" || action.type === "navigate") &&
        creation &&
        (ui.editor || Object.keys(ui.values).length)
      )
        ui.pausedEditor = {
          key: ui.editor || creation.editing || M.nextQuestion(creation),
          values: ui.values,
        };
      if (
        [
          "answer",
          "later",
          "back",
          "continue",
          "navigate",
          "confirm-discard",
          "cancel-edit",
        ].includes(action.type)
      ) {
        ui.editor = null;
        ui.values = {};
      }
      if (action.type === "continue" && ui.pausedEditor) {
        ui.editor = ui.pausedEditor.key;
        ui.values = ui.pausedEditor.values;
        ui.pausedEditor = null;
      }
      if (action.type === "answer" || action.type === "confirm-discard") ui.pausedEditor = null;
      if (action.type === "navigate") {
        ui.editHub = false;
        ui.contextDrawer = false;
      }
      if (action.type === "open-discard") ui.dialogFocus = "Discard";
      if (action.type === "open-activate") ui.dialogFocus = "Activate Plan";
      if (action.type === "close-plan") ui.dialogFocus = "Stop Plan";
      if (action.type === "cancel-dialog")
        ui.restoreText =
          ui.dialogFocus ||
          (snapshot.state.dialog?.kind === "discard"
            ? "Discard"
            : snapshot.state.dialog?.kind === "close"
              ? "Stop Plan"
              : "Activate Plan");
      if (
        ["confirm-activate", "apply-change", "cancel-change", "confirm-close"].includes(action.type)
      ) {
        ui.commandSerial = (ui.commandSerial || 0) + 1;
        action = { ...action, commandId: `fixture-command-${ui.commandSerial}` };
        ui.lastCommand = action;
      }
      const previous = snapshot.state;
      transition(action);
      if (action.type === "commitment-cancel") transition({ type: "cancel-edit" });
      if (
        action.type === "answer" &&
        action.key === "mode" &&
        snapshot.state.fixture.facts.availability
      ) {
        const facts = snapshot.state.fixture.facts;
        if (facts.availability)
          snapshot.state = M.answer(
            snapshot.state,
            "availability",
            facts.availability.value,
            facts.availability.source,
          );
        if (!snapshot.state.creation?.answers.baseline && facts.baseline)
          snapshot.state = M.answer(
            snapshot.state,
            "baseline",
            facts.baseline.value,
            facts.baseline.source,
          );
      }
      if (action.type === "confirm-discard" && previous.creation && !snapshot.state.creation)
        ui.focus = "#start-plan";
      if (action.type === "later") ui.focus = "#coach-composer";
      if (action.type === "cancel-edit") {
        ui.editHub = !!snapshot.state.creation?.draft;
        if (ui.editHub && previous.creation?.editing)
          ui.focus = `[aria-label="Edit ${labels[previous.creation.editing]}"]`;
      }
    }
    render();
  };
  const onFormInput = (event: FormEvent<HTMLFormElement>) => {
    snapshot.ui.values = values(event.currentTarget);
    save();
  };
  const onFormChange = (event: FormEvent<HTMLFormElement>) => {
    const target = event.target;
    if (
      (target instanceof HTMLInputElement ||
        target instanceof HTMLSelectElement ||
        target instanceof HTMLTextAreaElement) &&
      ["kind", "operation", "eventId"].includes(target.name)
    ) {
      snapshot.ui.focus = `#field-${target.name}`;
      render();
    }
  };
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget,
      key = form.dataset.editor,
      data = new FormData(form);
    const text = (name: string) => String(data.get(name) ?? "");
    let action: Command;
    switch (key) {
      case "goal":
        action = {
          type: "answer",
          key,
          value: {
            kind: "event",
            name: text("name").trim(),
            date: text("date"),
            source: "your answer",
          },
        };
        break;
      case "success":
        action = { type: "answer", key, value: text("success").trim() };
        break;
      case "availability":
        action = {
          type: "answer",
          key,
          value: {
            days: data.getAll("days").map(Number),
            weeklyHours: Number(text("weeklyHours")),
            longest: Number(text("longest")),
            weekdayMinutes: Number(text("weekdayMinutes") || text("longest")),
            ...(text("poolCount") ? { poolCount: Number(text("poolCount")) } : {}),
          },
        };
        break;
      case "start":
        action = { type: "answer", key, value: text("start") };
        break;
      case "restriction":
        action = {
          type: "answer",
          key,
          value: {
            kind: text("kind"),
            ...(text("kind") === "max-duration" ? { minutes: Number(text("minutes")) } : {}),
            ...(text("end") ? { end: text("end") } : {}),
          },
        };
        break;
      case "commitments":
        action = { type: "commitment-edit", text: text("text") };
        break;
      case "change":
        action = { type: "request-change", intent: changeIntent(data, snapshot.state) };
        break;
      case "supporting": {
        const supportingEvent = snapshot.state.fixture.events.find(
          (candidate) => candidate.id === text("eventId"),
        );
        if (!supportingEvent) throw new Error("Missing Supporting Event");
        action = {
          type: "answer",
          key: "supportingEvents",
          value: [
            ...(snapshot.state.creation?.answers.supportingEvents || []).filter(
              (candidate) => candidate.id !== supportingEvent.id,
            ),
            ...(text("role") === "Ignore for this Plan"
              ? []
              : [{ ...supportingEvent, role: text("role") }]),
          ],
        };
        break;
      }
      default:
        throw new Error("Unknown Plan editor");
    }
    const next = M.transition(snapshot.state, action);
    snapshot.state = next;
    const error = next.creation?.error || next.changeError;
    if (error) {
      snapshot.ui.error = error;
      render();
      return;
    }
    snapshot.ui.editor = null;
    snapshot.ui.values = {};
    snapshot.ui.error = "";
    render();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      if (snapshot.state.dialog) run({ type: "cancel-dialog" });
      else if (snapshot.ui.contextDrawer && snapshot.ui.width === "compact") run({ ui: "context" });
      else if (snapshot.ui.source) run({ ui: "close-source" });
      else if (snapshot.ui.editor || event.currentTarget.querySelector("#answer-form"))
        run({ ui: "back-editor" });
      else if (snapshot.state.creation) run({ type: "later" });
    }
    const dialog = event.currentTarget.querySelector('[role="dialog"]');
    if (dialog && event.key === "Tab") {
      const list = [...dialog.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")],
        first = list[0],
        last = list.at(-1);
      if (event.shiftKey && document.activeElement === first && last) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last && first) {
        event.preventDefault();
        first.focus();
      }
    }
  };
  const setWidth = (width: CatalogueUi["width"]) => {
    snapshot.ui.width = width;
    snapshot.ui.contextDrawer = false;
    render();
  };
  const toggleTheme = () => {
    snapshot.ui.theme = snapshot.ui.theme === "dark" ? "light" : "dark";
    render();
  };
  const setReduced = (reduced: boolean) => {
    snapshot.ui.reduced = reduced;
    render();
  };
  const setFailure = (value: string) => {
    if (value === "stale-plan") run({ type: "bump-plan-revision" });
    else if (value === "source-drift")
      run({
        type: "set-fixture",
        key: "sourceRevision",
        value: snapshot.state.fixture.sourceRevision + 1,
      });
    else if (["race", "taper", "stale-sync"].includes(value))
      run({ type: "set-fixture", key: "guard", value });
    else run({ type: "set-fixture", key: "fail", value: value === "none" ? null : value });
  };
  return {
    snapshot,
    run,
    reset,
    setWidth,
    toggleTheme,
    setReduced,
    setFailure,
    onFormInput,
    onFormChange,
    onSubmit,
    onKeyDown,
    composerRef,
    save,
  };
}
