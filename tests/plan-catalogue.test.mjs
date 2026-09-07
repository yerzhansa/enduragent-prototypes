import { test } from "vitest";
import assert from "node:assert/strict";
import {
  TODAY,
  addDays,
  eventSpan,
  poolSize,
  requiredKeys,
  nextQuestion,
  nextValidStart,
  sampleAnswers,
  createState,
  answer,
  transition,
  workouts,
  totals,
  eligibleWorkouts,
  interpret,
  creationTextExamples,
} from "../experiments/plan-in-chat/model.mjs";
import { scenarios, acceptance, seed } from "../experiments/plan-in-chat/scenarios.mjs";
const step = (state, type, payload = {}) => transition(state, { type, ...payload });
const saved = (state) => JSON.parse(JSON.stringify(state));
const fill = (state, values = sampleAnswers()) =>
  Object.entries(values).reduce((current, [key, value]) => answer(current, key, value), state);
const start = (options) => step(createState(options), "start");
const build = (state) => {
  state = step(state, "build-start");
  for (
    let count = 0;
    count < 25 &&
    state.creation.build &&
    state.creation.build.completed < state.creation.build.weeks;
    count++
  )
    state = step(state, "build-next");
  return step(state, "build-finish");
};
const review = (values = sampleAnswers(), options = {}) => build(fill(start(options), values));
const preview = (state, intent = { kind: "weekday-duration", day: 3, minutes: 30 }) =>
  step(state, "request-change", { intent });
const active = (fixture) => createState({ active: true, history: true, fixture });
const activate = (state) => step(step(state, "open-activate"), "confirm-activate");
const weekday = (date) => new Date(`${date}T00:00:00Z`).getUTCDay() || 7;
const protectedWorkouts = (state) =>
  workouts(state.active).filter(
    (w) => w.status === "completed" || (w.date && w.date < state.fixture.today),
  );
function inspectSnapshot(snapshot) {
  const all = workouts(snapshot);
  assert.equal(new Set(all.map((w) => w.id)).size, all.length);
  assert.equal(
    totals(snapshot).minutes,
    all.filter((w) => w.status !== "Not chosen").reduce((sum, w) => sum + w.minutes, 0),
  );
  for (const [index, week] of snapshot.weeks.entries()) {
    assert.equal(week.number, index + 1);
    assert.equal(week.start, addDays(snapshot.start, index * 7));
    assert.equal(week.end, addDays(week.start, 6));
    for (const workout of week.workouts) {
      assert.equal(workout.week, week.number);
      assert(workout.minutes > 0);
      assert(workout.name && workout.guidance);
      if (workout.date) assert(workout.date >= week.start && workout.date <= week.end);
      else assert.equal(snapshot.mode, "flexible");
    }
  }
}
test("accepted question order and optional commitment policy", () => {
  let state = start({ connected: false });
  assert.equal(nextQuestion(state.creation), "goal");
  assert.deepEqual(requiredKeys(state.creation), [
    "goal",
    "mode",
    "availability",
    "start",
    "baseline",
    "success",
    "restriction",
  ]);
  state = answer(state, "goal", { kind: "fitness", name: "Climb stronger", source: "Your answer" });
  assert.equal(nextQuestion(state.creation), "length");
  const values = sampleAnswers({ kind: "fitness" });
  for (const key of [
    "length",
    "mode",
    "availability",
    "start",
    "baseline",
    "success",
    "restriction",
  ]) {
    assert.equal(nextQuestion(state.creation), key);
    state = answer(state, key, values[key]);
  }
  assert.equal(nextQuestion(state.creation), null);
  assert.equal(state.fixture.ftp, null);
  assert.deepEqual(state.fixture.events, []);
  assert.deepEqual(state.fixture.facts, {});
  assert.deepEqual(state.fixture.ftpSources, []);
  const connected = createState();
  assert.equal(connected.fixture.facts.baseline.avgWeeklyMinutes, 400);
  assert.equal(connected.fixture.ftpSources.find((value) => value.selected).value, 210);
});
test("missing crucial success or explicit restriction never creates a Plan", () => {
  for (const missing of ["success", "restriction"]) {
    const values = sampleAnswers();
    delete values[missing];
    const state = build(fill(start(), values));
    assert.equal(nextQuestion(state.creation), missing);
    assert.equal(state.creation.draft, null);
    assert.equal(state.active, null);
    assert.match(state.creation.error, /remaining question/);
  }
});
test("manual Event requires name and exact date and preserves authored provenance", () => {
  let state = start({ connected: false });
  for (const value of [
    { kind: "event", name: "", date: TODAY },
    { kind: "event", name: "Park ride", date: "" },
    { kind: "event", name: "Park ride", date: "1998-02-31" },
  ]) {
    state = answer(state, "goal", value);
    assert.equal(state.creation.answers.goal, undefined);
    assert(state.creation.error);
  }
  state = answer(state, "goal", { kind: "event", name: "Park ride", date: "1998-09-21" });
  assert.equal(state.creation.answers.goal.source, "Your answer");
  assert.equal(state.creation.sources.goal, "Your answer");
});
test("all Fitness lengths and Event boundary spans produce complete inspectable weeks", () => {
  for (const length of [4, 8, 12, 16]) {
    const draft = review(sampleAnswers({ kind: "fitness", length })).creation.draft;
    assert.equal(draft.weeks.length, length);
    assert.equal(draft.goal.kind, "fitness");
    assert.equal(draft.goal.date, undefined);
    inspectSnapshot(draft);
  }
  for (const computed of [4, 5, 24, 25]) {
    const eventDate = addDays(TODAY, computed * 7 - 1);
    const span = eventSpan(TODAY, eventDate);
    const draft = review(sampleAnswers({ eventDate })).creation.draft;
    assert.equal(span.computedWeeks, computed);
    assert.equal(draft.weeks.length, computed === 25 ? 12 : computed);
    assert.equal(draft.goal.date, eventDate);
    assert.equal(draft.end, addDays(TODAY, draft.weeks.length * 7 - 1));
    assert.equal(
      draft.spanKind,
      computed === 4 ? "Short block" : computed === 25 ? "Base Plan" : "Event preparation",
    );
    inspectSnapshot(draft);
  }
  let state = answer(start(), "goal", sampleAnswers({ kind: "fitness" }).goal);
  for (const length of [0, 1, 3, 5, "custom", 20]) {
    state = answer(state, "length", length);
    assert.equal(state.creation.answers.length, undefined);
    assert.match(state.creation.error, /4, 8, 12, or 16/);
  }
});
test("goal-family editing invalidates dependent answers and restores approved order", () => {
  let state = review(sampleAnswers({ kind: "fitness", length: 8 }));
  const original = saved(state.creation.draft);
  state = answer(state, "goal", sampleAnswers().goal);
  assert.equal(state.creation.answers.length, undefined);
  assert.equal(state.creation.answers.success, undefined);
  assert.equal(nextQuestion(state.creation), "success");
  assert.deepEqual(state.creation.draft, original);
  state = answer(state, "goal", sampleAnswers({ kind: "fitness" }).goal);
  assert.equal(nextQuestion(state.creation), "length");
  state = answer(state, "length", 12);
  assert.equal(nextQuestion(state.creation), "success");
  for (const success of [
    "Train consistently",
    "Climb stronger",
    "Ride farther comfortably",
    "Complete my weekly rides with confidence",
  ]) {
    state = answer(state, "success", success);
    assert.equal(state.creation.answers.success, success);
  }
  state = answer(state, "mode", "flexible");
  assert.equal(state.creation.answers.availability, undefined);
  assert.equal(nextQuestion(state.creation), "availability");
});
test("Draft edit, Back, pause and failed rebuild preserve the last complete facts and Workouts", () => {
  for (const failure of ["build", "translation", "validation", "interruption"]) {
    let state = review(sampleAnswers(), { active: true, history: true });
    const oldDraft = saved(state.creation.draft);
    const oldActive = saved(state.active);
    const creationId = state.creation.id;
    const beforeEdit = saved(state.creation);
    state = step(step(state, "edit", { key: "restriction" }), "cancel-edit");
    assert.deepEqual(state.creation, beforeEdit);
    state = step(state, "edit", { key: "restriction" });
    assert.equal(state.creation.revision, oldDraft.revision);
    state = step(state, "back");
    assert.equal(state.creation.editing, "restriction");
    state = step(step(state, "later"), "chat-message", { text: "My ordinary Chat message" });
    state = saved(state);
    state = step(state, "continue", { id: creationId });
    assert.equal(state.destination.id, creationId);
    assert.equal(state.creation.editing, "restriction");
    state = answer(state, "restriction", { kind: "max-duration", minutes: 30 });
    assert.notEqual(state.creation.revision, oldDraft.revision);
    state = step(state, "set-fixture", { key: "fail", value: failure });
    state = build(state);
    assert.deepEqual(state.creation.draft, oldDraft);
    assert.deepEqual(state.active, oldActive);
    assert.match(state.creation.error, /preserved/);
    assert.equal(step(state, "open-activate").dialog, null);
    state = step(state, "set-fixture", { key: "fail", value: null });
    state = build(state);
    assert.equal(state.creation.draft.revision, state.creation.revision);
    assert(workouts(state.creation.draft).every((w) => w.minutes <= 30));
    assert.deepEqual(oldDraft.inputs.restriction, { kind: "none" });
  }
});
test("all pool thresholds and count corrections stay Flexible and preserve exact pins", () => {
  for (const hours of [6, 8, 9]) {
    let state = review(sampleAnswers({ mode: "flexible", weeklyHours: hours }));
    assert.equal(
      state.creation.draft.weeks[0].workouts.length,
      hours === 6 ? 3 : hours === 8 ? 4 : 5,
    );
    assert(
      workouts(state.creation.draft)
        .filter((w) => !w.pinned)
        .every((w) => w.date === null),
    );
    assert.equal(
      workouts(state.creation.draft).find((w) => w.pinned).date,
      state.creation.answers.goal.date,
    );
    for (const count of [3, 4, 5]) {
      state = answer(state, "availability", {
        ...state.creation.answers.availability,
        poolCount: count,
      });
      state = build(state);
      assert.equal(state.creation.answers.mode, "flexible");
      assert.equal(state.creation.draft.weeks[0].workouts.length, count);
      assert.equal(poolSize(hours, count), count);
    }
    const old = saved(state.creation.answers.availability);
    state = answer(state, "availability", { ...old, poolCount: 6 });
    assert.deepEqual(state.creation.answers.availability, old);
    assert.match(state.creation.error, /3, 4, or 5/);
  }
});
test("Fixed weekdays, weekly caps, longest limits and weekday caps govern each Workout", () => {
  const answers = sampleAnswers({
    availability: { days: [1, 3], weeklyHours: 1, longest: 35, weekdayMinutes: 25 },
  });
  answers.commitments = [{ kind: "unavailable", day: 1, id: "off-monday" }];
  const draft = review(answers).creation.draft;
  for (const week of draft.weeks) {
    assert(week.workouts.reduce((sum, w) => sum + w.minutes, 0) <= 60);
    assert(week.workouts.every((w) => w.minutes <= 35));
    assert(
      week.workouts.filter((w) => !w.pinned).every((w) => weekday(w.date) === 3 && w.minutes <= 25),
    );
    assert(week.notes.length);
  }
  assert.equal(nextValidStart(answers, TODAY), "1998-08-26");
  let current = fill(start(), {
    mode: "fixed",
    availability: answers.availability,
    commitments: answers.commitments,
  });
  current = answer(current, "start", TODAY);
  assert.equal(current.creation.answers.start, "1998-08-26");
  assert.match(answer(current, "start", "1998-08-23").creation.error, /today or a later/);
  assert.match(
    answer(current, "availability", { ...answers.availability, longest: 90 }).creation.error,
    /cannot exceed/,
  );
  assert.equal(nextValidStart(sampleAnswers(), TODAY), TODAY);
  const shifted = review({ ...sampleAnswers(), start: "1998-08-26" }).creation.draft;
  assert(
    workouts(shifted)
      .filter((w) => !w.pinned)
      .every((w) => [1, 3, 6].includes(weekday(w.date))),
  );
});
test("typed commitments preserve identity, exact dates, pending interpretation and cancellation", () => {
  let state = review();
  const draft = saved(state.creation.draft);
  state = step(state, "commitment-edit", { text: "Wednesdays at most 30 minutes" });
  assert.equal(state.creation.pendingCommitment.rule.day, 3);
  assert.equal(state.creation.pendingCommitment.rule.minutes, 30);
  assert.deepEqual(state.creation.answers.commitments, []);
  state = step(state, "commitment-confirm");
  const ruleId = state.creation.answers.commitments[0].id;
  state = step(state, "commitment-edit", { text: "Wednesdays at most 20 minutes" });
  state = step(state, "commitment-confirm");
  assert.equal(state.creation.answers.commitments.length, 1);
  assert.equal(state.creation.answers.commitments[0].id, ruleId);
  state = step(state, "commitment-edit", { text: "time off 1998-08-24 to 1998-08-30" });
  state = step(state, "commitment-confirm");
  state = build(state);
  assert.equal(state.creation.draft.weeks[0].workouts.length, 0);
  const confirmed = saved(state.creation.answers.commitments);
  state = step(state, "commitment-edit", { text: "Maybe away later" });
  state = saved(step(state, "navigate", { destination: { kind: "library" } }));
  assert.equal(state.creation.pendingCommitment.status, "clarify");
  assert.equal(step(state, "build-start").creation.build, null);
  assert.equal(step(state, "open-activate").dialog, null);
  state = step(state, "commitment-cancel");
  assert.deepEqual(state.creation.answers.commitments, confirmed);
  state = step(state, "rule-remove", { id: ruleId });
  assert.equal(
    state.creation.answers.commitments.some((r) => r.id === ruleId),
    false,
  );
  assert.deepEqual(draft.inputs.commitments, []);
  const pinned = review({
    ...sampleAnswers(),
    commitments: [
      { id: "fixed-ride", kind: "pinned", name: "Club ride", date: "1998-08-27", minutes: 35 },
    ],
  }).creation.draft;
  assert.equal(workouts(pinned).find((w) => w.commitmentId === "fixed-ride").date, "1998-08-27");
});
test("operational restrictions accept no health prose and expire on the exact end date", () => {
  for (const kind of ["none", "no-training", "no-hard-training", "max-duration"]) {
    const restriction = {
      kind,
      ...(kind === "max-duration" ? { minutes: 20 } : {}),
      end: "1998-08-30",
    };
    const draft = review({ ...sampleAnswers({ kind: "fitness" }), restriction }).creation.draft;
    const first = draft.weeks[0].workouts;
    if (kind === "no-training") assert.equal(first.length, 0);
    if (kind === "no-hard-training") assert(first.every((w) => w.kind !== "hard"));
    if (kind === "max-duration") assert(first.every((w) => w.minutes <= 20));
    assert(draft.weeks[1].workouts.some((w) => w.kind === "hard" && w.minutes > 20));
  }
  const state = answer(start(), "restriction", {
    kind: "no-hard-training",
    detail: "Unapproved health prose",
  });
  assert.equal(state.creation.answers.restriction, undefined);
  assert.equal(JSON.stringify(state).includes("Unapproved health prose"), false);
  assert.deepEqual(
    answer(start(), "restriction", { kind: "none", end: "1998-08-30" }).creation.answers
      .restriction,
    { kind: "none" },
  );
});
test("whole-Plan zero blocker differs from an empty week and completed checkpoints", () => {
  let state = review(sampleAnswers(), { active: true });
  const draft = saved(state.creation.draft);
  state = answer(state, "restriction", { kind: "no-training" });
  state = build(state);
  assert.match(state.creation.error, /No Workouts fit anywhere/);
  assert.deepEqual(state.creation.draft, draft);
  assert.equal(step(state, "open-activate").dialog, null);
  const rest = review(sampleAnswers(), { fixture: { restWeek: 2 } });
  assert.equal(rest.creation.draft.weeks[1].workouts.length, 0);
  assert(activate(rest).active);
  state = step(fill(start()), "build-start");
  assert.deepEqual(state.creation.build.output, []);
  state = step(state, "build-next");
  assert.equal(state.creation.build.completed, 1);
  assert.deepEqual(state.creation.build.output, [state.creation.build.candidate.weeks[0]]);
  assert.equal(step(saved(state), "build-finish").creation.draft, null);
});
test("no credible FTP produces permitted guidance without inventing power", () => {
  const draft = review(sampleAnswers(), { connected: false }).creation.draft;
  assert.equal(draft.ftp, null);
  for (const workout of workouts(draft).filter((w) => !w.pinned)) {
    assert.equal(workout.power, null);
    assert.match(workout.guidance, /perceived effort|heart-rate/);
    assert.doesNotMatch(workout.name, /FTP test/i);
  }
});
test("library navigation, exact Continue, discard cancellation and discard preserve active history", () => {
  let state = fill(start({ active: true, history: true }));
  const original = saved(state);
  state = step(state, "navigate", { destination: { kind: "library" } });
  state = step(state, "continue", { id: "different-creation" });
  assert.equal(state.destination.kind, "library");
  state = step(state, "continue", { id: original.creation.id });
  assert.equal(state.destination.id, original.creation.id);
  state = step(step(state, "open-discard"), "cancel-dialog");
  assert.deepEqual(state.creation, original.creation);
  state = step(step(state, "open-discard"), "confirm-discard");
  assert.equal(state.creation, null);
  assert.equal(state.notice, "Plan creation discarded");
  assert.deepEqual(state.active, original.active);
  assert.deepEqual(state.closed, original.closed);
});
test("activation keeps previous Plan through cancellation and local failure, then preserves today ownership", () => {
  let state = review(sampleAnswers(), { active: true });
  const original = saved(state.active);
  state = step(step(state, "open-activate"), "cancel-dialog");
  assert.deepEqual(state.active, original);
  state = step(state, "set-fixture", { key: "fail", value: "local" });
  state = activate(state);
  assert.deepEqual(state.active, original);
  assert(state.creation);
  state = step(state, "set-fixture", { key: "fail", value: "calendar" });
  state = activate(state);
  assert.equal(state.creation, null);
  assert.notEqual(state.active.id, original.id);
  assert.equal(state.active.mirrorStart, addDays(TODAY, 1));
  assert.equal(state.active.mirrorEnd, addDays(TODAY, 6));
  assert.match(state.active.mirrorStatus, /failed/);
  assert(workouts(state.closed[0]).some((w) => w.date === TODAY && w.mirrored));
  const id = state.active.id;
  state = step(state, "set-fixture", { key: "fail", value: null });
  state = step(state, "retry-calendar");
  assert.equal(state.active.id, id);
  assert.equal(state.active.mirrorStatus, "Up to date");
});
test("activation stale target and command retry never duplicate an active Plan", () => {
  let state = step(review(sampleAnswers(), { active: true }), "open-activate");
  const original = saved(state.active);
  state = step(state, "bump-plan-revision");
  state = step(state, "confirm-activate");
  assert.equal(state.active.id, original.id);
  assert(state.creation);
  state = step(state, "open-activate");
  state = step(state, "confirm-activate", { commandId: "activation-once" });
  const committed = saved(state.active);
  state = step(state, "confirm-activate", { commandId: "activation-once" });
  assert.deepEqual(state.active, committed);
  assert.equal(state.closed.length, 1);
});
const intents = [
  [{ kind: "weekday-duration", day: 3, minutes: 30 }, "wednesdays at most 30 minutes"],
  [{ kind: "weekday-unavailable", day: 3 }, "no training on wednesdays"],
  [{ kind: "hard-weekday", day: 1 }, "no hard training on mondays"],
  [{ kind: "weekly-duration", hours: 3 }, "at most 3 hours each week"],
  [{ kind: "longest-workout", minutes: 60 }, "long rides at most 60 minutes"],
];
test("all five scheduling intents share bounded text/card previews and preserve protected training", () => {
  for (const [intent, text] of intents) {
    const initial = start({ active: true });
    const state = preview(initial, intent);
    assert.deepEqual(state.active, initial.active);
    assert.deepEqual(transition(initial, interpret(text, initial)).change, state.change);
    assert(state.change.diff.length, intent.kind);
    const applied = step(state, "apply-change", { id: state.change.id });
    assert.deepEqual(protectedWorkouts(applied), protectedWorkouts(initial));
    assert.deepEqual(applied.creation, initial.creation);
    assert.deepEqual(applied.active.weeks, state.change.after.weeks);
    assert.equal(applied.active.revision, initial.active.revision + 1);
    const undone = step(applied, "undo");
    assert.deepEqual(undone.active, applied.active);
    assert.equal(undone.change.intent.kind, "inverse");
    const restored = step(undone, "apply-change", { id: undone.change.id });
    assert.deepEqual(restored.active.weeks, initial.active.weeks);
    assert.equal(restored.active.revision, initial.active.revision + 2);
  }
});
test("preview navigation survives reload, cancellation remains retired and stale apply has no effect", () => {
  let state = preview(start({ active: true }));
  const original = saved(state.active);
  const pending = saved(state.change);
  state = saved(step(state, "navigate", { destination: { kind: "library" } }));
  assert.deepEqual(state.change, pending);
  state = step(state, "cancel-change", { id: pending.id, commandId: "cancel-once" });
  state = saved(state);
  state = step(state, "cancel-change", { id: pending.id, commandId: "cancel-once" });
  state = step(state, "apply-change", { id: pending.id });
  assert.equal(state.change, null);
  assert.equal(state.changeHistory[0].status, "cancelled");
  assert.deepEqual(state.active, original);
  state = preview(state);
  state = step(state, "bump-plan-revision");
  const newer = saved(state.active);
  state = step(state, "apply-change", { id: state.change.id });
  assert.deepEqual(state.active, newer);
  assert.match(state.notice, /stale/);
});
test("supersession succeeds only after a valid new preview; old and competing commands never revive it", () => {
  const request = { type: "request-change", intent: intents[0][0], commandId: "original-request" };
  let state = transition(active(), request);
  const old = saved(state.change);
  const training = saved(state.active);
  for (const fail of ["translation", "validation", "build", "interruption"]) {
    state = step(state, "set-fixture", { key: "fail", value: fail });
    state = preview(state, { kind: "ftp", ftp: 220 });
    assert.deepEqual(state.change, old);
    assert.deepEqual(state.active, training);
  }
  state = step(state, "set-fixture", { key: "fail", value: null });
  state = preview(state, { kind: "ftp", ftp: 220 });
  assert.equal(state.change.supersedes, old.id);
  assert.equal(state.changeHistory.at(-1).status, "superseded");
  const current = saved(state.change);
  state = transition(state, request);
  state = step(state, "request-change", { intent: intents[1][0], expectedSerial: 0 });
  state = step(state, "apply-change", { id: old.id });
  assert.deepEqual(state.change, current);
  assert.deepEqual(state.active, training);
});
test("Flexible choice is unresolved across navigation and assigns only the confirmed original identity", () => {
  let state = active({ activeMode: "flexible" });
  const initial = saved(state.active);
  const entry = eligibleWorkouts(state).find((item) => item.eligible);
  assert(entry);
  state = preview(state, { kind: "choose-workout", workoutId: entry.workout.id });
  let nextDay = step(saved(state), "fixture-clock", { date: addDays(TODAY, 1) });
  nextDay = step(nextDay, "apply-change", { id: nextDay.change.id });
  assert.deepEqual(nextDay.active, initial);
  assert.match(nextDay.notice, /day changed/);
  state = saved(step(state, "navigate", { destination: { kind: "library" } }));
  assert.deepEqual(state.active, initial);
  state = step(state, "apply-change", { id: state.change.id });
  assert.deepEqual(
    workouts(state.active)
      .filter((w) => w.date === TODAY)
      .map((w) => w.id),
    [entry.workout.id],
  );
  assert(eligibleWorkouts(state).every((item) => !item.eligible && item.reason));
});
test("Supporting Event operations change only confirmed Plan facts and preserve provider evidence", () => {
  const operations = [
    [
      "add",
      {
        id: "park",
        name: "Park ride",
        date: "1998-09-09",
        role: "Training",
        source: "Your answer",
      },
    ],
    ["remove", { id: "river" }],
    ["role", { id: "river", role: "Important" }],
    ["manual", { id: "meadow", date: "1998-09-12" }],
    ["source-update", { id: "river", date: "1998-09-05" }],
    ["name", { id: "meadow", name: "Meadow renamed" }],
  ];
  for (const [operation, event] of operations) {
    const initial = start({ active: true });
    const state = preview(initial, { kind: "supporting-event", operation, event });
    assert(state.change, state.notice);
    assert.deepEqual(state.active, initial.active);
    assert.equal(state.change.diff.length === 0, operation === "name");
    const applied = step(state, "apply-change", { id: state.change.id });
    assert.deepEqual(applied.active.goal, initial.active.goal);
    assert.deepEqual(applied.fixture.events, initial.fixture.events);
    assert.deepEqual(protectedWorkouts(applied), protectedWorkouts(initial));
    assert.deepEqual(applied.creation, initial.creation);
    if (operation !== "remove")
      for (const event of initial.active.supportingEvents)
        assert.equal(
          applied.active.supportingEvents.find((e) => e.id === event.id).providerPriority,
          event.providerPriority,
        );
  }
  let state = seed("supporting-events", "source-update");
  const before = saved(state.active);
  state = step(state, "set-fixture", {
    key: "sourceRevision",
    value: state.fixture.sourceRevision + 1,
  });
  state = step(state, "apply-change", { id: state.change.id });
  assert.deepEqual(state.active, before);
  assert.match(state.notice, /stale/);
  state = preview(active(), {
    kind: "supporting-event",
    operation: "add",
    event: {
      id: "past-soon",
      name: "Park ride",
      date: "1998-08-27",
      role: "Training",
      source: "Your answer",
    },
  });
  state = step(state, "apply-change", { id: state.change.id });
  state = step(state, "fixture-clock", { date: "1998-08-28" });
  const protectedBeforeUndo = saved(protectedWorkouts(state));
  state = step(state, "undo");
  state = step(state, "apply-change", { id: state.change.id });
  assert.deepEqual(protectedWorkouts(state), protectedBeforeUndo);
});
test("FTP changes future power only and preserves dates, durations and completed training", () => {
  const initial = active();
  const state = preview(initial, { kind: "ftp", ftp: 220 });
  const applied = step(state, "apply-change", { id: state.change.id });
  assert.deepEqual(protectedWorkouts(applied), protectedWorkouts(initial));
  const prior = new Map(workouts(initial.active).map((w) => [w.id, w]));
  for (const workout of workouts(applied.active)) {
    assert.equal(workout.date, prior.get(workout.id).date);
    assert.equal(workout.minutes, prior.get(workout.id).minutes);
    if (workout.date >= TODAY && !workout.pinned && workout.status === "planned")
      assert.equal(workout.power, 220);
  }
});
test("race/taper, stale sync and by-value premises protect active Changes including inverse apply", () => {
  for (const guard of ["race", "taper"]) {
    let state = active({ guard });
    const initial = saved(state.active);
    assert.equal(preview(state, { kind: "ftp", ftp: 240 }).change, null);
    state = preview(state);
    assert(state.change);
    state = step(state, "apply-change", { id: state.change.id });
    assert.equal(step(state, "undo").change, null);
    assert.notDeepEqual(state.active.weeks, initial.weeks);
  }
  assert.equal(preview(active({ syncStale: true })).change, null);
  assert.equal(preview(active({ evidenceMissing: true })).change, null);
  let state = preview(active());
  const evidence = saved(state.change.premises);
  state = step(state, "set-fixture", { key: "evidenceRevision", value: 2 });
  state = saved(state);
  assert.deepEqual(state.change.premises, evidence);
  const training = saved(state.active);
  state = step(state, "apply-change", { id: state.change.id });
  assert.deepEqual(state.active, training);
  assert.doesNotMatch(state.change.confidence, /%/);
});
test("closure, actual completion and Flexible week closure preserve readable final facts", () => {
  let state = active({ connected: false });
  const id = state.active.id;
  state = step(step(state, "close-plan"), "confirm-close");
  assert.equal(state.active, null);
  assert.equal(state.closed[0].id, id);
  assert.equal(state.closed[0].reason, "Stopped");
  assert.equal(state.closed[0].mirrorStatus, "Calendar cleanup pending");
  state = step(state, "set-fixture", { key: "connected", value: true });
  state = step(state, "retry-calendar");
  assert.equal(state.active, null);
  assert.equal(state.closed[0].mirrorStatus, "Cleanup complete");
  state = seed("base-ending");
  assert(state.active.goal.date > state.active.end);
  assert(step(state, "complete-plan").active);
  state = step(state, "fixture-clock", { date: state.active.end });
  state = step(state, "complete-plan");
  assert.equal(state.closed[0].reason, "Completed");
  assert(state.closed[0].goal.date > state.closed[0].end);
  state = active({ activeMode: "flexible" });
  const pinned = workouts(state.active)
    .filter((w) => w.pinned)
    .map((w) => [w.id, w.date]);
  state = step(state, "close-week");
  const oldWeek = state.active.weeks[0];
  assert(oldWeek.workouts.filter((w) => !w.date).every((w) => w.status === "Not chosen"));
  assert.deepEqual(step(saved(state), "close-week").active, state.active);
  assert.deepEqual(
    workouts(state.active)
      .filter((w) => w.pinned)
      .map((w) => [w.id, w.date]),
    pinned,
  );
  assert.equal(seed("unknown-ending").closed[0].reason, "Unknown");
});
test("assisted recovery preserves originals, requires fresh work and protects another creation", () => {
  let state = active();
  const originals = saved(state.legacy);
  state = step(step(state, "recover", { id: "legacy-creation" }), "confirm-recovery");
  assert(state.creation);
  assert.equal(state.creation.draft, null);
  assert(state.creation.uncertain.length);
  assert.deepEqual(state.legacy, originals);
  const recoveredId = state.creation.id;
  state = step(step(state, "recover", { id: "legacy-creation" }), "confirm-recovery");
  assert.equal(state.creation.id, recoveredId);
  assert.match(state.notice, /Finish or explicitly discard/);
  state = step(step(state, "recover", { id: "legacy-change" }), "confirm-recovery");
  assert(state.change);
  assert.equal(state.creation.id, recoveredId);
  const plan = saved(state.active);
  state = step(state, "cancel-change", { id: state.change.id });
  assert.deepEqual(state.active, plan);
  assert.deepEqual(state.legacy, originals);
  state = step(state, "set-fixture", { key: "fail", value: "build" });
  state = step(step(state, "recover", { id: "legacy-change" }), "confirm-recovery");
  assert.equal(state.change, null);
  assert.deepEqual(state.legacy, originals);
  state = seed("recovery-notices", "source-drift");
  const pausedPlan = saved(state.active);
  state = step(step(state, "recover", { id: "legacy-creation" }), "confirm-recovery");
  assert.equal(state.creation, null);
  assert.deepEqual(state.active, pausedPlan);
  assert.match(state.notice, /Recovery could not continue/);
  state = step(state, "set-fixture", { key: "fail", value: null });
  state = step(state, "confirm-recovery");
  assert(state.creation);
});
test("catalogue maps exactly 53 named acceptance references and every deterministic seed is structurally usable", () => {
  const names =
    "Crucial answer missing|No connected data|Connected facts|Event length boundaries|Fitness lengths|No credible FTP|Fixed schedule conflict|Written commitments|Ambiguous commitment edit|No Workouts fit|Rest week|Flexible pool|Training restriction|Rebuild failure|Build interrupted|Review completeness|First activation|Existing active Plan|Activation races|Activation failure|Calendar failure|Current-day ownership|Library combinations|Stop offline|System completion|Base Plan ending|Unknown legacy ending|Flexible week ends|Change preview|Text and card equivalence|Stale change|Protected Workouts|Undo|Flexible daily choice|Interrupted daily choice|Supporting Event preview|Supporting Event operations|Updated synchronized event|Event source changes during review|Event metadata only|FTP correction|Explicit preview cancellation|Retry after cancellation|Navigate from preview|A different change request|New preview fails|Competing preview commands|Upgrade interrupted|Backup and restore|Assisted recovery|Recovery with open creation|Recovered change with open creation|Old unapplied change".split(
      "|",
    );
  assert.deepEqual(
    acceptance.map((row) => row.name),
    names,
  );
  assert.equal(new Set(scenarios.map((row) => row.id)).size, scenarios.length);
  for (const [index, row] of acceptance.entries()) {
    assert.equal(row.id, `A${String(index + 1).padStart(2, "0")}`);
    assert(row.scenarioIds.length && row.backendLimit);
    for (const id of row.scenarioIds)
      assert(scenarios.find((item) => item.id === id).acceptance.includes(row.id));
  }
  for (const scenario of scenarios) {
    assert(scenario.steps.length && scenario.purpose);
    for (const ref of scenario.acceptance) assert(acceptance.some((row) => row.id === ref));
    for (const variation of scenario.variations || [{ id: undefined }]) {
      const state = seed(scenario.id, variation.id);
      assert.deepEqual(seed(scenario.id, variation.id), state);
      assert(state.destination.kind);
      if (state.destination.kind === "creation")
        assert.equal(state.destination.id, state.creation.id);
      if (state.destination.kind === "change") assert.equal(state.destination.id, state.active.id);
      if (state.creation?.draft) inspectSnapshot(state.creation.draft);
      if (state.active) inspectSnapshot(state.active);
      if (state.change) {
        assert.equal(state.change.planId, state.active.id);
        assert.equal(state.change.status, "pending");
        assert.deepEqual(state.change.totals.before, totals(state.change.before));
        assert.deepEqual(state.change.totals.after, totals(state.change.after));
      }
    }
  }
});
test("bounded creation text examples execute the same scoped answer commands as cards", () => {
  let state = start({ connected: false });
  const before = saved(state);
  assert.equal(interpret("Invent an arbitrary answer", state).type, "notice");
  assert.deepEqual(state, before);
  for (const text of [
    "Improve without an event",
    "8 weeks",
    "Fixed days",
    "6 hours weekly, 120 minutes longest, 60 minutes weekdays, Monday Wednesday Saturday",
    "Next valid Plan day",
    "Regular",
    "Train consistently",
    "No training restrictions",
  ]) {
    const action = interpret(text, state);
    assert.equal(action.type, "answer", text);
    assert.equal(action.creationId, state.creation.id);
    assert.equal(action.expectedRevision, state.creation.revision);
    assert.deepEqual(
      transition(state, action),
      answer(state, action.key, action.value, action.source),
    );
    state = transition(state, action);
  }
  assert.equal(nextQuestion(state.creation), null);
  assert.equal(build(state).creation.draft.weeks.length, 8);
  state = start();
  for (const example of creationTextExamples(state))
    assert.equal(interpret(example.text, state).type, "answer");
  const oldAction = interpret("Improve without an event", state);
  state = step(step(state, "open-discard"), "confirm-discard");
  state = step(state, "start");
  assert.equal(transition(state, oldAction).creation.answers.goal, undefined);
});
test("FTP previews preserve competing source values by value and refuse changed source evidence", () => {
  let state = preview(active(), { kind: "ftp", ftp: 220 });
  const premise = saved(state.change.premises.find((item) => item.id === "ftp-sources"));
  assert.deepEqual(premise.value.candidates, state.fixture.ftpSources);
  assert.equal(premise.value.acceptedPlanFtp, 210);
  assert.equal(premise.value.requestedFtp, 220);
  assert.equal(premise.value.candidates.find((item) => item.selected).source, "Saved athlete FTP");
  const original = saved(state.active);
  state = step(state, "set-fixture", {
    key: "ftpSources",
    value: [{ value: 230, source: "Updated saved FTP", selected: true }],
  });
  state = saved(state);
  assert.deepEqual(
    state.change.premises.find((item) => item.id === "ftp-sources"),
    premise,
  );
  state = step(state, "apply-change", { id: state.change.id });
  assert.deepEqual(state.active, original);
  assert.match(state.notice, /FTP sources changed/);
});
test("commitment text after Later proposes creation limits while Change text keeps its active Plan target", () => {
  const initial = step(seed("commitments"), "later");
  for (const text of ["Wednesdays at most 30 minutes", "time off 1998-08-24 to 1998-08-30"]) {
    const action = interpret(text, initial);
    assert.equal(action.type, "commitment-edit");
    assert.equal(action.creationId, initial.creation.id);
    const state = transition(initial, action);
    assert.deepEqual(state, step(initial, "commitment-edit", { text }));
    assert.equal(state.creation.pendingCommitment.status, "confirm");
    assert.deepEqual(state.creation.answers.commitments, initial.creation.answers.commitments);
    assert.deepEqual(state.active, initial.active);
    assert.equal(state.change, null);
    const confirmed = step(state, "commitment-confirm");
    assert.equal(confirmed.creation.answers.commitments.length, 1);
    assert.deepEqual(confirmed.active, initial.active);
  }
  const change = step(initial, "navigate", {
    destination: { kind: "change", id: initial.active.id },
  });
  assert.equal(interpret("Wednesdays at most 30 minutes", change).type, "request-change");
  assert.equal(interpret("No fixed commitments", change).type, "notice");
});
