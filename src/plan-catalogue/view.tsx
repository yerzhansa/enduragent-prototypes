import {
  Children,
  Fragment,
  isValidElement,
  type ComponentProps,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  PlanAction,
  PlanChoiceOption,
  PlanEvidenceRow,
  PlanEvidenceTable,
  PlanProjectionCard,
  PlanResultNotice,
} from "@enduragent/ui";
import { ArrowUp, Check, ChevronDown, Paperclip } from "lucide-react";
import * as M from "./model";
import type {
  AnswerKey,
  AnswerValue,
  Commitment,
  Draft,
  Plan,
  Premise,
  Preview,
  Week,
  Workout,
} from "./types";
import type { CatalogueAction, CatalogueViewContext, EditorKey, EvidenceSource } from "./ui-types";

const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const labels: Record<AnswerKey, string> = {
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
const answerKeys: AnswerKey[] = [
  "goal",
  "length",
  "mode",
  "availability",
  "start",
  "commitments",
  "baseline",
  "success",
  "restriction",
];
const allAnswerKeys: AnswerKey[] = [...answerKeys, "supportingEvents"];
function isPreview(source: Exclude<EvidenceSource, Premise[]>): source is Preview {
  return (
    "before" in source &&
    typeof source.before === "object" &&
    "after" in source &&
    typeof source.after === "object" &&
    "diff" in source &&
    Array.isArray(source.diff) &&
    "premises" in source &&
    Array.isArray(source.premises)
  );
}
const date = (value: string | null | undefined) =>
  value
    ? new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(value + "T12:00:00Z"))
    : "Undated";
const total = (snapshot: Draft) =>
  M.workouts(snapshot).reduce((sum, workout) => sum + workout.minutes, 0);
const nodes = (value: ReactNode): ReactNode[] =>
  Children.toArray(value).flatMap((node) =>
    isValidElement<{ children?: ReactNode }>(node) && node.type === Fragment
      ? nodes(node.props.children)
      : node === ""
        ? []
        : [node],
  );
const slot = (value: ReactNode): ReactNode => {
  const children = nodes(value);
  return children.length
    ? children.map((child, index) => <Fragment key={index}>{child}</Fragment>)
    : undefined;
};
type ButtonAttributes = ComponentProps<"button"> & {
  [key: `data-${string}`]: string | boolean | undefined;
};
type CardProps = {
  eyebrow?: string;
  title: string;
  status?: string;
  plainStatus?: boolean;
  summary?: string;
  body?: ReactNode;
  buttons?: ReactNode;
};

export function createCatalogueView(ctx: CatalogueViewContext) {
  const { state, ui, selected } = ctx;
  const creation = state.creation;
  let choiceNumber = 0;
  let evidenceNumber = 0;
  function button(
    label: string,
    action: CatalogueAction,
    style = "",
    attrs: ButtonAttributes = {},
  ) {
    return (
      <PlanAction {...attrs} className={style} onClick={() => ctx.run(action)}>
        {label}
      </PlanAction>
    );
  }
  function fact(label: string, value: ReactNode) {
    return <PlanEvidenceRow key={evidenceNumber++} label={label} value={value} />;
  }
  function table(rows: ReactNode, label = "Facts") {
    return <PlanEvidenceTable label={label}>{Children.toArray(rows)}</PlanEvidenceTable>;
  }
  function card({
    eyebrow = "",
    title,
    status = "",
    plainStatus = false,
    summary = "",
    body,
    buttons,
  }: CardProps) {
    return (
      <PlanProjectionCard
        eyebrow={eyebrow}
        title={title}
        status={status}
        plainStatus={plainStatus}
        summary={summary}
        actions={slot(buttons)}
      >
        {slot(body)}
      </PlanProjectionCard>
    );
  }
  function notice(text: string | null | undefined) {
    return text ? <PlanResultNotice text={text} /> : null;
  }
  function ruleText(rule: Commitment) {
    return (
      rule.kind +
      ("day" in rule && rule.day ? " · " + days[rule.day - 1] : "") +
      ("minutes" in rule && rule.minutes ? " · " + rule.minutes + " min" : "") +
      ("start" in rule && rule.start ? " · " + date(rule.start) : "") +
      ("end" in rule && rule.end ? " to " + date(rule.end) : "")
    );
  }
  function answerText(key: AnswerKey, value: AnswerValue, mode = creation?.answers.mode): string {
    if (value == null) return "Not answered";
    if (key === "goal" && typeof value === "object" && "kind" in value && "name" in value)
      return value.kind === "event"
        ? value.name + " · " + date(value.date)
        : value.name || "Improve without an event";
    if (key === "length") return value + " weeks";
    if (key === "start" && typeof value === "string") return date(value);
    if (key === "mode") return value === "flexible" ? "Flexible Workout pool" : "Fixed Schedule";
    if (key === "availability" && typeof value === "object" && "weeklyHours" in value)
      return (
        value.weeklyHours +
        " h weekly · " +
        value.longest +
        " min longest" +
        (mode === "fixed"
          ? " · " + value.days.map((day) => days[day - 1]).join(", ")
          : " · " + M.poolSize(value.weeklyHours, value.poolCount) + " Workouts per week")
      );
    if (key === "commitments" && Array.isArray(value))
      return value.length
        ? value.map((rule) => ("kind" in rule ? ruleText(rule) : "")).join("; ")
        : "No fixed commitments";
    if (key === "restriction" && typeof value === "object" && "kind" in value) {
      const text =
        value.kind === "none"
          ? "No training restrictions"
          : value.kind === "no-training"
            ? "No training"
            : value.kind === "no-hard-training"
              ? "No hard training"
              : value.kind === "max-duration"
                ? "Maximum " + value.minutes + " min"
                : "";
      return text + ("end" in value && value.end ? " through " + date(value.end) : "");
    }
    return String(value);
  }
  function summaries() {
    if (!creation) return null;
    return M.requiredKeys(creation)
      .filter((key) => creation.answers[key] != null)
      .map((key) => {
        const value = creation.answers[key];
        const source =
          value && typeof value === "object" && "source" in value ? value.source : undefined;
        return (
          <section key={key} className="choice-result" aria-label={labels[key] + " answer"}>
            <span className="choice-result-mark" aria-hidden="true">
              <Check />
            </span>
            <div>
              <p className="artifact-eyebrow">Answer recorded</p>
              <strong>{answerText(key, value)}</strong>
              <p>{labels[key] + " · " + (creation.sources[key] || source || "your answer")}</p>
            </div>
            {button("Edit", { type: "edit", key }, "", { "aria-label": "Edit " + labels[key] })}
          </section>
        );
      });
  }
  function progress(inLibrary = false) {
    if (!creation) return null;
    const keys = M.requiredKeys(creation),
      count = keys.filter((key) => creation.answers[key] != null).length;
    return card({
      eyebrow: "Plan creation",
      title: creation.answers.goal ? answerText("goal", creation.answers.goal) : "New Plan",
      status: creation.draft ? "Draft" : creation.paused ? "Paused" : "In progress",
      summary:
        count +
        " of " +
        keys.length +
        " answered. " +
        (state.active ? M.title(state.active) + " keeps running." : "No Plan is active."),
      buttons: (
        <>
          {button("Discard", { type: "open-discard" }, "danger")}
          {creation.paused || inLibrary
            ? button("Continue in Chat", { type: "continue", id: creation.id }, "primary")
            : null}
        </>
      ),
    });
  }
  function input(
    name: string,
    label: string,
    type: ComponentProps<"input">["type"] = "text",
    value: string | number = "",
    extra: ComponentProps<"input"> = {},
  ) {
    return (
      <label key={name} className="catalogue-field" htmlFor={"field-" + name}>
        <span>{label}</span>
        <input
          id={"field-" + name}
          name={name}
          type={type}
          defaultValue={ui.values[name] ?? value}
          {...extra}
          aria-describedby="form-error"
        />
      </label>
    );
  }
  function select(
    name: string,
    label: string,
    options: [string | number, string][],
    value: string | number = "",
  ) {
    return (
      <label key={name} className="catalogue-field" htmlFor={"field-" + name}>
        <span>{label}</span>
        <span className="catalogue-select">
          <select id={"field-" + name} name={name} defaultValue={ui.values[name] ?? value}>
            {options.map(([optionValue, text]) => (
              <option key={optionValue} value={optionValue}>
                {text}
              </option>
            ))}
          </select>
          <ChevronDown aria-hidden="true" />
        </span>
      </label>
    );
  }
  function answerForEditor(key: AnswerKey) {
    return (
      creation?.answers[key] ||
      creation?.uncertain.find((item) => item.key === key)?.value ||
      (key === "availability" ? state.fixture.facts.availability?.value : undefined)
    );
  }
  function editorFields(key: EditorKey): ReactNode {
    const answers = creation?.answers || {};
    const value = key === "change" || key === "supporting" ? undefined : answerForEditor(key);
    if (key === "goal") {
      const goal =
        value && typeof value === "object" && "kind" in value && value.kind === "event"
          ? value
          : null;
      return (
        <>
          {input("name", "Event name", "text", goal?.name || "", {
            required: true,
            maxLength: 512,
          })}
          {input("date", "Exact event date", "date", goal?.date || "", { required: true })}
        </>
      );
    }
    if (key === "success")
      return (
        <label className="catalogue-field" htmlFor="field-success">
          <span>What would success look like?</span>
          <textarea
            id="field-success"
            name="success"
            maxLength={2000}
            rows={2}
            required
            defaultValue={ui.values.success ?? (typeof value === "string" ? value : "")}
          />
        </label>
      );
    if (key === "availability") {
      const availability =
        value && typeof value === "object" && "weeklyHours" in value ? value : null;
      const checked = ui.values.days || (availability?.days || []).map(String);
      return (
        <>
          {select(
            "weeklyHours",
            "Weekly time limit",
            [
              [5, "5 hours"],
              [6, "6 hours"],
              [8, "8 hours"],
              [9, "9 hours"],
            ],
            availability?.weeklyHours || 6,
          )}
          {input("longest", "Longest Workout in minutes", "number", availability?.longest || 90, {
            min: 1,
            max: 540,
            required: true,
          })}
          {answers.mode === "fixed"
            ? input(
                "weekdayMinutes",
                "Normal weekday duration in minutes",
                "number",
                availability?.weekdayMinutes || 60,
                { min: 1, max: 540, required: true },
              )
            : null}
          {answers.mode === "fixed" ? (
            <fieldset>
              <legend>Usable weekdays</legend>
              {days.map((day, index) => (
                <label key={day}>
                  <input
                    type="checkbox"
                    name="days"
                    value={index + 1}
                    defaultChecked={checked.includes(String(index + 1))}
                  />
                  {day}
                </label>
              ))}
            </fieldset>
          ) : (
            <>
              <p className="plan-support">
                The weekly limit determines 3, 4 or 5 Workouts. You can correct that count.
              </p>
              {input(
                "poolCount",
                "Workouts per week, optional correction",
                "number",
                availability?.poolCount || "",
                { min: 3, max: 5 },
              )}
            </>
          )}
        </>
      );
    }
    if (key === "start")
      return input(
        "start",
        "Earliest start date",
        "date",
        (typeof value === "string" && value) || state.fixture.today || M.TODAY,
        { required: true },
      );
    if (key === "restriction") {
      const restriction = value && typeof value === "object" && "kind" in value ? value : null;
      const kind = ui.values.kind || restriction?.kind || "none";
      return (
        <>
          {select(
            "kind",
            "Operational training limit",
            [
              ["none", "No training restrictions"],
              ["no-training", "No training"],
              ["no-hard-training", "No hard training"],
              ["max-duration", "Maximum duration"],
            ],
            typeof kind === "string" ? kind : "",
          )}
          {kind === "max-duration"
            ? input(
                "minutes",
                "Maximum duration in minutes",
                "number",
                (restriction && "minutes" in restriction && restriction.minutes) || 30,
                { min: 1, max: 540, required: true },
              )
            : null}
          {kind !== "none"
            ? input(
                "end",
                "End date, optional",
                "date",
                (restriction && "end" in restriction && restriction.end) || "",
              )
            : null}
        </>
      );
    }
    if (key === "commitments")
      return (
        <label className="catalogue-field" htmlFor="field-text">
          <span>Commitments or time off</span>
          <textarea
            id="field-text"
            name="text"
            rows={2}
            maxLength={2000}
            required
            defaultValue={ui.values.text || ""}
          />
        </label>
      );
    if (key === "change") {
      const kind = typeof ui.values.kind === "string" ? ui.values.kind : "weekday-duration";
      const operation = typeof ui.values.operation === "string" ? ui.values.operation : "add";
      const fields: ReactNode[] = [
        select(
          "kind",
          "Change",
          [
            ["weekday-duration", "Weekday duration cap"],
            ["weekday-unavailable", "Weekday unavailable"],
            ["hard-weekday", "No hard training on a weekday"],
            ["weekly-duration", "Weekly duration cap"],
            ["longest-workout", "Longest-Workout cap"],
            ["ftp", "Correct FTP"],
            ["supporting-event", "Supporting Event"],
          ],
          kind,
        ),
      ];
      if (["weekday-duration", "weekday-unavailable", "hard-weekday"].includes(kind))
        fields.push(
          select(
            "day",
            "Weekday",
            days.map((day, index) => [index + 1, day]),
            kind === "hard-weekday" ? 1 : 3,
          ),
        );
      if (["weekday-duration", "longest-workout"].includes(kind))
        fields.push(
          input(
            "minutes",
            "Duration limit in minutes",
            "number",
            kind === "weekday-duration" ? 30 : 60,
            { min: 1, required: true },
          ),
        );
      if (kind === "weekly-duration")
        fields.push(
          input("hours", "Weekly limit in hours", "number", 3, { min: 1, required: true }),
        );
      if (kind === "ftp")
        fields.push(input("ftp", "FTP in watts", "number", 220, { min: 1, required: true }));
      if (kind === "supporting-event") {
        fields.push(
          select(
            "operation",
            "Supporting Event operation",
            [
              ["add", "Add"],
              ["remove", "Remove"],
              ["role", "Change role"],
              ["manual", "Correct manual name or date"],
              ["source-update", "Accept synchronized details"],
              ["name", "Name only"],
            ],
            operation,
          ),
        );
        const list = state.active?.supportingEvents || [];
        const chosen = list.find(
          (item) =>
            item.id ===
            (ui.values.eventId || (["manual", "name"].includes(operation) ? "meadow" : "river")),
        );
        if (operation !== "add")
          fields.push(
            select(
              "eventId",
              "Accepted Supporting Event",
              list.map((item) => [item.id, item.name]),
              chosen?.id,
            ),
          );
        if (operation !== "remove")
          fields.push(
            input("name", "Supporting Event name", "text", chosen?.name || "River ride"),
            input(
              "date",
              "Supporting Event date",
              "date",
              chosen?.date || M.addDays(state.fixture.today, 14),
            ),
            select(
              "role",
              "Plan role",
              [
                ["Important", "Important"],
                ["Training", "Training"],
              ],
              chosen?.role || "Training",
            ),
          );
      }
      return Children.toArray(fields);
    }
    if (key === "supporting")
      return (
        <>
          {select(
            "eventId",
            "Event",
            state.fixture.events
              .filter((event) => event.id !== answers.goal?.id)
              .map((event) => [event.id, event.name + " · " + date(event.date)]),
          )}
          {select(
            "role",
            "Role in this Plan",
            [
              ["Important", "Important"],
              ["Training", "Training"],
              ["Ignore for this Plan", "Ignore for this Plan"],
            ],
            "Ignore for this Plan",
          )}
        </>
      );
    return null;
  }
  function editor(key: EditorKey, returnToAnswers = false) {
    return (
      <form
        id="answer-form"
        data-editor={key}
        onInput={ctx.onFormInput}
        onChange={ctx.onFormChange}
        onSubmit={ctx.onSubmit}
      >
        <div className="choice-custom-editor is-standalone">
          {editorFields(key)}
          <p id="form-error" role="alert">
            {ui.error || (key === "change" ? state.changeError : creation?.error) || ""}
          </p>
          <div className="choice-custom-actions">
            {returnToAnswers
              ? button("Back to answers", { type: "cancel-edit" }, "back-to-answers")
              : null}
            <div className="choice-custom-actions">
              {button("Back", { ui: "back-editor" })}
              <PlanAction className="primary" type="submit">
                {key === "change"
                  ? "Preview change"
                  : key === "commitments"
                    ? "Review interpretation"
                    : "Continue"}
              </PlanAction>
            </div>
          </div>
        </div>
      </form>
    );
  }
  function option(
    label: string,
    value: unknown,
    key: AnswerKey,
    detail = "",
    edit: EditorKey | null = null,
  ) {
    const action: CatalogueAction = edit
      ? { ui: "editor", key: edit }
      : {
          type: "answer",
          key,
          value,
          ...(key === "availability" && state.fixture.facts.availability
            ? { source: state.fixture.facts.availability.source }
            : {}),
        };
    return (
      <PlanChoiceOption
        key={label}
        marker={++choiceNumber}
        label={label}
        detail={detail}
        data-editor-trigger={edit || undefined}
        onClick={() => ctx.run(action)}
      />
    );
  }
  function scheduleOverview() {
    const facts = state.fixture.facts.availability ? state.fixture.facts : null;
    return (
      <div className="schedule-overview">
        <p>
          {facts?.availability
            ? answerText("availability", facts.availability.value, "fixed")
            : "No saved availability"}
        </p>
        <p>{facts?.availability?.source || ""}</p>
        <p>
          {facts?.baseline
            ? "Recent riding · " +
              facts.baseline.avgWeeklyMinutes +
              " min weekly · longest " +
              facts.baseline.longest +
              " min · " +
              facts.baseline.source
            : ""}
        </p>
      </div>
    );
  }
  function question(): ReactNode {
    if (
      !creation ||
      creation.paused ||
      (creation.pendingCommitment && ui.editor !== "commitments") ||
      ui.editHub ||
      ui.editor === "supporting" ||
      !["creation", "chat"].includes(state.destination.kind)
    )
      return null;
    choiceNumber = 0;
    const key = creation.editing || M.nextQuestion(creation);
    if (!key) return null;
    const titles: Record<AnswerKey, string> = {
      goal: "What do you want this Plan to prepare you for?",
      length: "How long should this Plan run?",
      mode: state.fixture.connected
        ? "Does this usual week look right?"
        : "How should your weeks work?",
      availability: "How much time can you protect?",
      start: "When should this Plan start?",
      commitments: "Any fixed commitments or time off?",
      baseline: "How has your recent training been?",
      success: "What would make this Plan a success?",
      restriction: "Does anything need to limit training right now?",
      supportingEvents: "Supporting Events",
    };
    const formOpen =
      ui.editor === key ||
      key === "restriction" ||
      (key === "availability" && !state.fixture.connected);
    let content: ReactNode = null;
    if (ui.editor === key)
      content = (
        <>
          {key === "availability" && state.fixture.connected ? scheduleOverview() : null}
          {editor(key, !!creation.editing)}
        </>
      );
    else {
      if (key === "goal")
        content = (
          <>
            {state.fixture.connected
              ? state.fixture.events.map((event) =>
                  option(
                    event.name + " · " + date(event.date),
                    { ...event, kind: "event", source: event.source || "intervals.icu" },
                    key,
                    "Synchronized event",
                  ),
                )
              : null}
            {option("Event not listed", null, key, "Enter its name and exact date.", "goal")}
            {option(
              "Improve without an event",
              { kind: "fitness", name: "Improve fitness", source: "your answer" },
              key,
              "Build fitness for a fixed number of weeks.",
            )}
          </>
        );
      if (key === "length")
        content = [4, 8, 12, 16].map((length) => option(length + " weeks", length, key));
      if (key === "mode")
        content = (
          <>
            {state.fixture.connected ? scheduleOverview() : null}
            {option(
              state.fixture.connected ? "Looks right" : "Fixed days",
              "fixed",
              key,
              "Workouts use your confirmed days and limits.",
            )}
            {option("My week varies", "flexible", key, "An ordered pool. Choose a day later.")}
          </>
        );
      if (key === "availability")
        content =
          state.fixture.connected && ui.editor !== "availability" ? (
            <>
              {scheduleOverview()}
              {option(
                "Looks right",
                state.fixture.facts.availability?.value,
                key,
                "Use the saved limits shown above.",
              )}
              {option("My week varies", "flexible", "mode", "Keep an undated weekly pool.")}
              {option(
                "Change one thing",
                null,
                key,
                "Correct the availability or limits.",
                "availability",
              )}
            </>
          ) : (
            editor(key, !!creation.editing)
          );
      if (key === "start")
        content = (
          <>
            {option(
              "Next valid Plan day",
              state.fixture.today || M.TODAY,
              key,
              "Today if allowed, otherwise the earliest day your Schedule allows.",
            )}
            {option("Start later", null, key, "Choose the earliest date.", "start")}
          </>
        );
      if (key === "commitments")
        content = (
          <>
            {option("No fixed commitments", [], key)}
            {option(
              "Add commitments or time off",
              null,
              key,
              "Review the exact interpreted limits.",
              "commitments",
            )}
          </>
        );
      if (key === "baseline")
        content = ["Regular", "Occasional", "Starting again"].map((value) =>
          option(value, value, key),
        );
      if (key === "success")
        content = (
          <>
            {(creation.answers.goal?.kind === "event"
              ? ["Finish comfortably", "Finish fast", "Race for a result"]
              : ["Train consistently", "Climb stronger", "Ride farther comfortably"]
            ).map((value) => option(value, value, key))}
            {option("Something else", null, key, "Answer in your own words.", "success")}
          </>
        );
      if (key === "restriction") content = editor(key, !!creation.editing);
      content = (
        <div className="choice-list" role="group" aria-label={labels[key]}>
          {content}
        </div>
      );
    }
    const keys = M.requiredKeys(creation);
    return (
      <section
        className={"choice-card " + (ui.editor ? "choice-card-custom" : "")}
        aria-labelledby="choice-title"
      >
        <header className="choice-header">
          <div>
            <p>{"Plan creation · question " + (keys.indexOf(key) + 1) + " of " + keys.length}</p>
            <h3 id="choice-title" tabIndex={-1}>
              {titles[key]}
            </h3>
          </div>
          {button("Later", { type: "later" }, "", { "aria-label": "Later" })}
        </header>
        {content}
        {creation.editing && !formOpen ? (
          <div className="choice-custom-actions">
            {button("Back to answers", { type: "cancel-edit" }, "back-to-answers")}
          </div>
        ) : null}
      </section>
    );
  }
  function workoutList(week: Week) {
    return (
      <Fragment key={week.number}>
        <p className="plan-section-label">
          {"Week " +
            week.number +
            " · " +
            date(week.start) +
            " to " +
            date(week.end) +
            " · " +
            week.workouts.reduce((sum, workout) => sum + workout.minutes, 0) +
            " min"}
        </p>
        <div
          className="plan-week-list"
          role="list"
          aria-label={"Week " + week.number + " Workouts"}
        >
          {week.workouts.length ? (
            week.workouts.map((workout, index) => (
              <div key={workout.id} role="listitem">
                <span>
                  {workout.date ? date(workout.date) : "Priority " + (index + 1) + " · Undated"}
                </span>
                <strong>
                  {workout.name +
                    " · " +
                    workout.minutes +
                    " min" +
                    (workout.power
                      ? " · " + workout.power + " W"
                      : " · " + (workout.guidance || "Perceived effort"))}
                </strong>
                <span className="status-chip">
                  {workout.status + (workout.pinned ? " · Pinned" : "")}
                </span>
              </div>
            ))
          ) : (
            <p>No Workouts this week.</p>
          )}
        </div>
        {week.notes.map((note, index) => (
          <p key={index} className="plan-support">
            {note}
          </p>
        ))}
      </Fragment>
    );
  }
  function snapshotFacts(snapshot: Draft | Plan) {
    const answers = snapshot.inputs;
    return table(
      [
        fact(
          "Main Goal · " + (answers.goal.source || snapshot.goal.source || "your answer"),
          answerText("goal", answers.goal || snapshot.goal),
        ),
        fact(
          "Calendar",
          "mirrorStart" in snapshot && snapshot.mirrorStart
            ? date(snapshot.mirrorStart) +
                " to " +
                date(snapshot.mirrorEnd) +
                " · " +
                snapshot.mirrorStatus
            : snapshot.mirrorStatus || "Local only",
        ),
        fact(
          "Plan span",
          date(snapshot.start) +
            " to " +
            date(snapshot.end) +
            " · " +
            snapshot.weeks.length +
            " weeks · " +
            snapshot.spanKind,
        ),
        ...answerKeys
          .filter((key) => key !== "goal" && answers[key] != null)
          .map((key) =>
            fact(
              labels[key] + " · " + (snapshot.sources[key] || "confirmed"),
              answerText(key, answers[key], answers.mode),
            ),
          ),
      ],
      "Draft inputs",
    );
  }
  function draft() {
    const snapshot = creation?.draft;
    if (!snapshot || !creation) return null;
    const stale = snapshot.revision !== creation.revision;
    return (
      <>
        {card({
          eyebrow: "Draft inputs",
          title: M.title(snapshot),
          status: stale ? "Stale" : "Needs review",
          summary: stale
            ? "This Draft preserves the earlier answers and Workouts. Rebuild before activation."
            : "Review the whole Draft before activating.",
          body: (
            <>
              {snapshotFacts(snapshot)}
              {sourceSummary()}
              <details className="plan-card-disclosure">
                <summary>How this Plan was built</summary>
                {table([
                  fact(
                    "Guidance",
                    snapshot.ftp
                      ? snapshot.ftp + " W · selected FTP"
                      : "Heart rate or perceived effort. No FTP test.",
                  ),
                  fact("Training approach", "Balanced · default"),
                ])}
              </details>
            </>
          ),
        })}
        {card({
          eyebrow: "Training outline",
          title: "Every week and Workout",
          status: stale ? "Out of date" : "Draft",
          summary:
            snapshot.weeks.length +
            " weeks · " +
            M.workouts(snapshot).length +
            " Workouts · " +
            total(snapshot) +
            " min",
          body: snapshot.weeks.map(workoutList),
          buttons: (
            <>
              {button("Discard", { type: "open-discard" }, "danger")}
              {button("Edit answers", { ui: "edit-hub" })}
              {button(
                stale ? "Rebuild Draft" : "Activate Plan",
                { type: stale ? "build-start" : "open-activate" },
                "primary",
              )}
            </>
          ),
        })}
      </>
    );
  }
  function ruleControls() {
    return (
      creation?.answers.commitments?.map((rule) => (
        <Fragment key={rule.id}>
          {card({
            title: ruleText(rule),
            summary: rule.source,
            buttons: (
              <>
                {button("Edit rule", { ui: "editor", key: "commitments" })}
                {button("Remove rule", { type: "rule-remove", id: rule.id || "" }, "danger")}
              </>
            ),
          })}
        </Fragment>
      )) || null
    );
  }
  function sourceSummary() {
    if (!creation) return null;
    const facts = state.fixture.facts;
    const rows = state.fixture.connected
      ? [
          fact(
            "Usual week · saved availability",
            facts.availability
              ? answerText("availability", facts.availability.value, "fixed")
              : "6 h weekly · Mon, Wed, Sat · 120 min longest",
          ),
          fact("Recent riding · intervals.icu", "6 h 40 weekly · longest 2 h 10"),
          fact("Starting point · intervals.icu", "Regular"),
        ]
      : [
          fact(
            "Recent riding",
            "No connected history. Your baseline answer supplies the starting point.",
          ),
        ];
    if (state.fixture.conflictingEvidence)
      rows.push(
        fact(
          "Weekly limit · observed riding",
          "6 h 40 observed; your saved 6 h limit takes precedence.",
        ),
      );
    rows.push(
      ...state.fixture.ftpSources.map((source) =>
        fact(
          "FTP · " + source.source,
          source.value + " W" + (source.selected ? " · selected" : ""),
        ),
      ),
    );
    if (!state.fixture.ftp)
      rows.push(fact("FTP", "No credible FTP. Use heart rate or perceived effort."));
    rows.push(fact("Training approach", "Balanced · disclosed default"));
    return (
      <details className="plan-card-disclosure">
        <summary>Already taken into account</summary>
        {table(rows)}
        <div className="card-actions">
          {button("Correct availability", { type: "edit", key: "availability" })}
          {button("Correct recent training", { type: "edit", key: "baseline" })}
          {state.fixture.events.some((event) => event.id !== creation.answers.goal?.id)
            ? button("Supporting Events", { ui: "editor", key: "supporting" })
            : null}
        </div>
      </details>
    );
  }
  function pendingCommitment() {
    const pending = creation?.pendingCommitment;
    if (!pending) return null;
    return card({
      eyebrow: "Schedule correction",
      title: pending.status === "clarify" ? "Clarify your commitment" : "Confirm these limits",
      status: "Not yet confirmed",
      summary:
        "Your last confirmed limits remain effective. Draft building and activation wait for this correction.",
      body: table([
        fact("Submitted", pending.text),
        ...(pending.rule ? [fact("Interpreted limit", ruleText(pending.rule))] : []),
      ]),
      buttons: (
        <>
          {button("Cancel correction", { type: "commitment-cancel" })}
          {button("Clarify", { ui: "editor", key: "commitments" })}
          {pending.rule
            ? button("Confirm limits", { type: "commitment-confirm" }, "primary")
            : null}
        </>
      ),
    });
  }
  function creationContent() {
    if (!creation) return null;
    if (ui.editor === "supporting")
      return card({
        title: "Supporting Events",
        summary:
          "The Main Goal stays unchanged. Provider priority is separate from your Plan role.",
        body: editor("supporting"),
      });
    if (creation.build) {
      const build = creation.build;
      const progressStyle: CSSProperties & { "--progress": string } = {
        "--progress": (build.completed / build.weeks) * 100 + "%",
      };
      return (
        <>
          {progress()}
          {notice(creation.error)}
          {card({
            eyebrow: "Draft",
            title: "Building your Draft",
            status: "In progress",
            summary: build.completed + " of " + build.weeks + " weeks complete.",
            body: (
              <>
                <div
                  className="progress-track"
                  role="progressbar"
                  aria-label="Weeks complete"
                  aria-valuemin={0}
                  aria-valuemax={build.weeks}
                  aria-valuenow={build.completed}
                  style={progressStyle}
                />
                {build.output.map(workoutList)}
                {build.completed < build.weeks ? (
                  <>
                    <p className="plan-section-label">Later weeks</p>
                    <div className="plan-phase-list" role="list" aria-label="Later build outline">
                      <div role="listitem">
                        <span>{"Weeks " + (build.completed + 1) + " to " + build.weeks}</span>
                        <strong>Not started</strong>
                        <small>Workouts will appear here</small>
                      </div>
                    </div>
                  </>
                ) : null}
              </>
            ),
          })}
        </>
      );
    }
    if (ui.editHub)
      return (
        <>
          {card({
            eyebrow: "Plan creation",
            title: "Edit answers",
            summary: "A changed answer makes the Draft stale.",
            buttons: button("Back to Draft", { ui: "leave-hub" }),
          })}
          {summaries()}
          {ruleControls()}
          {pendingCommitment()}
        </>
      );
    if (creation.draft && !creation.editing && !M.nextQuestion(creation))
      return (
        <>
          {notice(creation.error)}
          {pendingCommitment()}
          {creation.draft.revision !== creation.revision
            ? card({
                title: "Changed answers",
                body: table(
                  M.requiredKeys(creation)
                    .filter((key) => creation.answers[key] != null)
                    .map((key) =>
                      fact(
                        labels[key] + " · current answer",
                        answerText(key, creation.answers[key]),
                      ),
                    ),
                ),
              })
            : null}
          {draft()}
        </>
      );
    return (
      <>
        {summaries()}
        {progress()}
        {creation.uncertain.length
          ? card({
              eyebrow: "Recovered details",
              title: "Confirm uncertain answers",
              body: table(
                creation.uncertain.map((item) =>
                  fact(
                    labels[item.key] + " · earlier unconfirmed detail",
                    answerText(item.key, item.value),
                  ),
                ),
              ),
            })
          : null}
        {sourceSummary()}
        {notice(creation.error)}
        {pendingCommitment()}
        {creation.draft ? draft() : null}
        {!M.nextQuestion(creation) && !creation.draft
          ? card({
              eyebrow: "Plan creation",
              title: "Ready to build",
              summary: "The essentials are complete.",
              buttons: button("Build Draft", { type: "build-start" }, "primary"),
            })
          : null}
      </>
    );
  }
  function planCard(plan: Plan, closed = false) {
    const detail = closed
      ? ("reason" in plan && plan.reason) || "Unknown reason"
      : plan.mirrorStatus === "Up to date"
        ? "Calendar up to date"
        : "";
    const summary =
      date(plan.start) +
      " to " +
      date(plan.end) +
      " · " +
      plan.weeks.length +
      " weeks" +
      (detail ? " · " + detail : "");
    const body = closed
      ? plan.spanKind === "Base Plan"
        ? notice(
            "Your Event Goal is still " +
              date(plan.goal.kind === "event" ? plan.goal.date : undefined) +
              ". Start a new Plan for event preparation when it is within 24 weeks.",
          )
        : null
      : plan.mirrorStatus !== "Up to date"
        ? notice(plan.mirrorStatus || "")
        : null;
    return card({
      eyebrow: closed ? "Closed Plan" : "Active Plan",
      title: M.title(plan),
      status: closed ? "Closed" : "Active",
      summary,
      body,
      buttons: closed ? (
        button("Read final details", {
          type: "navigate",
          destination: { kind: "closed", id: plan.id },
        })
      ) : (
        <>
          {button("Stop Plan", { type: "close-plan" }, "danger")}
          {button("Read Plan details", { ui: "plan-details", id: plan.id })}
          {button(
            "Change in Chat",
            { type: "navigate", destination: { kind: "change", id: plan.id } },
            "primary",
          )}
        </>
      ),
    });
  }
  function library() {
    return (
      <>
        {creation ? progress(true) : null}
        {state.active
          ? planCard(state.active)
          : card({ title: "No active Plan", summary: "Create a Plan when you are ready." })}
        {state.closed.map((plan) => (
          <Fragment key={plan.id}>{planCard(plan, true)}</Fragment>
        ))}
        {state.active && ui.planDetails === state.active.id
          ? card({
              title: "Plan details",
              body: (
                <>
                  {snapshotFacts(state.active)}
                  {state.active.weeks.map(workoutList)}
                </>
              ),
            })
          : null}
        {state.legacy.length ? (
          <div className="card-actions">
            {button("Recover earlier planning work", {
              type: "navigate",
              destination: { kind: "recovery" },
            })}
          </div>
        ) : null}
      </>
    );
  }
  function workoutValue(workout: Workout | null) {
    return workout
      ? date(workout.date) +
          " · " +
          workout.minutes +
          " min" +
          (workout.power ? " · " + workout.power + " W" : "")
      : "Not in Plan";
  }
  function changeDiff(preview: Preview) {
    return (
      <>
        {table(
          preview.diff.map((diff) =>
            fact(
              diff.before?.name || diff.after?.name || "Workout",
              workoutValue(diff.before) + " → " + workoutValue(diff.after),
            ),
          ),
          "Affected individual Workouts",
        )}
        {table(
          [
            fact("Plan totals", total(preview.before) + " min → " + total(preview.after) + " min"),
            ...preview.before.weeks.map((week, index) =>
              fact(
                "Week " + week.number,
                week.workouts.reduce((sum, workout) => sum + workout.minutes, 0) +
                  " min → " +
                  (preview.after.weeks[index]?.workouts.reduce(
                    (sum, workout) => sum + workout.minutes,
                    0,
                  ) || 0) +
                  " min",
              ),
            ),
          ],
          "Before and after totals",
        )}
        {!preview.diff.length ? notice("No Workout changes.") : null}
      </>
    );
  }
  function eventSummary(plan: Plan) {
    return (
      plan.supportingEvents
        .map(
          (event) =>
            event.name +
            " · " +
            date(event.date) +
            " · " +
            event.role +
            " · " +
            event.source +
            (event.providerPriority ? " · provider priority " + event.providerPriority : ""),
        )
        .join("; ") || "None"
    );
  }
  function changeContent() {
    const preview = state.change;
    if (!state.active)
      return (
        <>
          {notice("This Plan is closed. Its final details remain in your library.")}
          {button("Open Plan", { type: "navigate", destination: { kind: "library" } })}
        </>
      );
    return (
      <>
        {card({
          eyebrow: "Active Plan",
          title: M.title(state.active),
          summary: creation
            ? "Your separate Plan creation is still open."
            : "Changes affect future, uncompleted training.",
          buttons: (
            <>
              {button("Change one thing", { ui: "editor", key: "change" })}
              {button("What should I ride today?", { ui: "daily" })}
              {button("Open Plan", { type: "navigate", destination: { kind: "library" } })}
            </>
          ),
        })}
        {ui.editor === "change"
          ? card({ eyebrow: "Plan Change", title: "What needs to change?", body: editor("change") })
          : null}
        {ui.daily || selected === "daily-choice"
          ? card({
              eyebrow: "Today",
              title: "Choose one eligible Workout",
              body: M.eligibleWorkouts(state).map((item) => (
                <div key={item.workout.id} className="evidence-row">
                  <span>{item.workout.name + " · " + item.workout.minutes + " min"}</span>
                  <div>
                    {item.eligible === false
                      ? item.reason
                      : button("Review " + item.workout.name, {
                          type: "request-change",
                          intent: { kind: "choose-workout", workoutId: item.workout.id },
                        })}
                  </div>
                </div>
              )),
            })
          : null}
        {preview
          ? card({
              eyebrow: "Plan Change",
              title: preview.title,
              status: preview.status || "Preview",
              plainStatus: true,
              summary: "Review this exact difference. Training stays unchanged until you confirm.",
              body: (
                <>
                  {notice(preview.details)}
                  {changeDiff(preview)}
                  {table([
                    fact(
                      "Main Goal",
                      answerText("goal", preview.before.goal || preview.before.inputs.goal),
                    ),
                    fact("Supporting Events before", eventSummary(preview.before)),
                    fact("Supporting Events after", eventSummary(preview.after)),
                    fact("Confidence", preview.confidence || "Based on your confirmed limits"),
                  ])}
                  <div className="card-actions">
                    {button("View evidence", { ui: "source", value: preview.premises })}
                    {button("Refresh preview", { ui: "refresh-preview" })}
                  </div>
                </>
              ),
              buttons: (
                <>
                  {button("Cancel", { type: "cancel-change", id: preview.id })}
                  {button("Apply to Plan", { type: "apply-change", id: preview.id }, "primary")}
                </>
              ),
            })
          : null}
        {state.changeHistory.map((previous) => (
          <Fragment key={previous.id}>
            {card({
              eyebrow: "Plan Change history",
              title: previous.title,
              status: previous.status,
              plainStatus: true,
              summary: "Earlier decisions remain readable.",
              buttons: (
                <>
                  {button("Read historical evidence", { ui: "source", value: previous.premises })}
                  {button("Read this difference", { ui: "source", value: previous })}
                  {previous.status === "applied" ? button("Undo", { type: "undo" }) : null}
                </>
              ),
            })}
          </Fragment>
        ))}
      </>
    );
  }
  function recovery() {
    const source = state.recovery?.source;
    return (
      <>
        {card({
          eyebrow: "Earlier planning work",
          title: "Choose details to continue",
          summary:
            "Originals remain readable. Continuing requires a fresh Draft or Change preview.",
          body: state.legacy.map((source) => (
            <div key={source.id} className="evidence-row">
              <span>{source.title + " · " + source.kind}</span>
              <div className="card-actions">
                {button("Read source", { ui: "source", value: source })}
                {button("Continue", { type: "recover", id: source.id })}
              </div>
            </div>
          )),
        })}
        {source
          ? card({
              title: "Confirm recovered details",
              summary:
                "Continue into a fresh creation to confirm each uncertain answer. The earlier work remains readable.",
              body: table([
                fact("Source", source.title),
                ...(source.kind === "creation"
                  ? source.uncertain.map((item) =>
                      fact(
                        "Needs confirmation · " + labels[item.key],
                        answerText(item.key, item.value, source.answers.mode),
                      ),
                    )
                  : []),
              ]),
              buttons: (
                <>
                  {button("Cancel", { type: "cancel-recovery" })}
                  {button("Continue", { type: "confirm-recovery" }, "primary")}
                </>
              ),
            })
          : null}
      </>
    );
  }
  function content() {
    const destination = state.destination;
    const note = notice(state.notice);
    if (destination.kind === "library")
      return (
        <>
          {note}
          {library()}
        </>
      );
    if (destination.kind === "closed") {
      const plan = state.closed.find((plan) => plan.id === destination.id);
      return (
        <>
          {note}
          {plan ? (
            <>
              {planCard(plan, true)}
              {card({
                title: "Final Plan details",
                body: (
                  <>
                    {snapshotFacts(plan)}
                    {plan.weeks.map(workoutList)}
                  </>
                ),
              })}
            </>
          ) : null}
          {button("Back to library", { type: "navigate", destination: { kind: "library" } })}
        </>
      );
    }
    if (destination.kind === "recovery")
      return (
        <>
          {note}
          {recovery()}
        </>
      );
    if (destination.kind === "change")
      return (
        <>
          {note}
          {changeContent()}
        </>
      );
    return (
      <>
        {note}
        {state.messages.map((message, index) => (
          <div key={index} className="turn user">
            <div className="user-bubble">{message.text}</div>
          </div>
        ))}
        {creationContent()}
        {!creation ? (
          <>
            {state.active ? planCard(state.active) : null}
            <div className="card-actions">
              {button("Start a Plan", { type: "start" }, "", { id: "start-plan" })}
            </div>
          </>
        ) : null}
      </>
    );
  }
  function dialog() {
    if (!state.dialog) return null;
    const kind = state.dialog.kind,
      discard = kind === "discard",
      close = kind === "close";
    const title = discard
      ? "Discard this Plan creation?"
      : close
        ? "Stop this Plan?"
        : state.active
          ? "Close and activate?"
          : "Activate Plan?";
    const today = state.fixture.today || M.TODAY;
    const keepsToday =
      state.active &&
      M.workouts(state.active).some((workout) => workout.date === today && workout.mirrored);
    const calendar = !state.fixture.connected
      ? "Calendar updates wait until intervals.icu is connected."
      : "Dated Workouts sync " +
        (keepsToday ? "from tomorrow" : "from today") +
        " through " +
        date(M.addDays(today, 6)) +
        ".";
    const copy = discard
      ? "Your answers are discarded. Your active Plan, Schedule, restrictions, saved preferences, and history stay unchanged."
      : close
        ? "Final training stays readable. Calendar cleanup can finish later."
        : (state.active ? M.title(state.active) + " closes. " : "") +
          (keepsToday ? "Today’s calendar Workout stays. " : "") +
          "The new Plan activates now.";
    return (
      <div className="dialog-layer">
        <section
          className="dialog-card"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dialog-title"
          aria-describedby="dialog-copy"
        >
          <h3 id="dialog-title">{title}</h3>
          <div id="dialog-copy">
            <p>{copy}</p>
            {!discard && !close ? <p>{calendar}</p> : null}
          </div>
          {notice(creation?.error)}
          <div className="card-actions">
            {button(discard ? "Keep creating" : "Cancel", { type: "cancel-dialog" }, "", {
              "data-dialog-cancel": "",
            })}
            {button(
              discard
                ? "Discard creation"
                : close
                  ? "Stop Plan"
                  : state.active
                    ? "Activate new Plan"
                    : "Activate Plan",
              { type: discard ? "confirm-discard" : close ? "confirm-close" : "confirm-activate" },
              discard || close ? "danger confirm-danger" : "primary",
            )}
          </div>
        </section>
      </div>
    );
  }
  function sidebar() {
    const inPlan = ["library", "closed"].includes(state.destination.kind);
    return (
      <aside className="app-sidebar">
        <div className="brand-block">
          <div className="brand-name">Enduragent</div>
        </div>
        <nav className="nav-list" aria-label="Main navigation">
          {button(
            "Chat",
            {
              type: "navigate",
              destination: creation ? { kind: "creation", id: creation.id } : { kind: "chat" },
            },
            "nav-item" + (!inPlan ? " is-active" : ""),
            { "aria-current": !inPlan ? "page" : "false" },
          )}
          {button(
            "Plan",
            { type: "navigate", destination: { kind: "library" } },
            "nav-item" + (inPlan ? " is-active" : ""),
            { "aria-current": inPlan ? "page" : "false" },
          )}
        </nav>
        <div className="sidebar-footer">
          <div className="side-status">
            {state.fixture.connected ? "intervals.icu connected" : "Local planning"}
          </div>
        </div>
      </aside>
    );
  }
  function contextPanel(drawer = false) {
    return (
      <aside
        className={"context-panel " + (drawer ? "context-drawer-panel" : "")}
        {...(drawer
          ? { role: "dialog", "aria-modal": true, "aria-labelledby": "context-title" }
          : { "aria-label": "Training context" })}
      >
        {drawer ? (
          <div className="context-drawer-head">
            {button("Close", { ui: "context" }, "", { id: "close-context" })}
          </div>
        ) : null}
        <h3 id="context-title">Training context</h3>
        <p>Available to Coach</p>
        <section className="context-section">
          <h4>Current Plan</h4>
          <strong>{state.active ? M.title(state.active) : "No active Plan"}</strong>
          <p>{creation ? "A separate creation is unfinished." : ""}</p>
          {button("Open Plan", { type: "navigate", destination: { kind: "library" } })}
        </section>
        <section className="context-section">
          <h4>Power guidance</h4>
          <p>{state.fixture.ftp ? state.fixture.ftp + " W" : "Heart rate or perceived effort"}</p>
        </section>
      </aside>
    );
  }
  function premiseValue(value: Premise["value"]) {
    if ("candidates" in value)
      return (
        "Plan FTP " +
        value.acceptedPlanFtp +
        " W · requested " +
        value.requestedFtp +
        " W · " +
        value.candidates
          .map(
            (candidate) =>
              candidate.value +
              " W · " +
              candidate.source +
              (candidate.selected ? " · selected" : ""),
          )
          .join("; ")
      );
    return Object.entries(value)
      .map(([key, entry]) => key + " " + entry)
      .join(" · ");
  }
  function sourceCard(source: EvidenceSource) {
    let body: ReactNode;
    if (Array.isArray(source))
      body = table(
        source.map((item) => fact(item.label + " · " + item.source, premiseValue(item.value))),
      );
    else if (isPreview(source))
      body = (
        <>
          {notice(source.status)}
          {changeDiff(source)}
          {table(
            source.premises.map((item) =>
              fact(item.label + " · " + item.source, premiseValue(item.value)),
            ),
          )}
        </>
      );
    else if (
      "kind" in source &&
      "evidence" in source &&
      (source.kind === "creation" || source.kind === "change")
    ) {
      const rows = [fact("Earlier work", source.title), fact("Source", source.evidence)];
      if (source.kind === "change" && "intent" in source && typeof source.intent === "object") {
        const intent = source.intent;
        rows.push(
          fact(
            "Earlier requested change",
            intent.kind +
              ("day" in intent && intent.day ? " · " + days[intent.day - 1] : "") +
              ("minutes" in intent && intent.minutes ? " · " + intent.minutes + " min" : "") +
              ("ftp" in intent && intent.ftp ? " · " + intent.ftp + " W" : ""),
          ),
        );
      }
      if (source.kind === "creation" && "answers" in source && typeof source.answers === "object") {
        const answers = source.answers;
        rows.push(
          ...Object.keys(answers).flatMap((suppliedKey) => {
            const key = allAnswerKeys.find((key) => key === suppliedKey);
            return key ? [fact(labels[key] || key, answerText(key, answers[key]))] : [];
          }),
        );
        if (Array.isArray(source.uncertain))
          rows.push(
            ...source.uncertain.map((item) =>
              fact(
                "Needs confirmation · " + labels[item.key],
                answerText(item.key, item.value, answers.mode),
              ),
            ),
          );
      }
      body = table(rows);
    } else
      body = table(
        Object.entries(source).map(([key, value]) =>
          fact(key, typeof value === "object" ? JSON.stringify(value) : String(value)),
        ),
      );
    return card({
      eyebrow: "Evidence",
      title: "Source details",
      body,
      buttons: button("Back", { ui: "close-source" }),
    });
  }
  function composer(question: ReactNode) {
    const hasQuestion = !!question;
    return (
      <div className="composer-dock">
        {hasQuestion ? <div className="coach-answer-prompt">{question}</div> : null}
        {ui.editor && hasQuestion ? null : (
          <div className="composer-anchor">
            <div className="composer">
              <textarea
                ref={ctx.composerRef}
                id="coach-composer"
                rows={1}
                aria-label="Message your coach"
                placeholder={hasQuestion ? "Finish the Plan question above" : "Message your coach"}
                disabled={hasQuestion}
              />
              <div className="composer-toolbar">
                <button className="icon-button" type="button" aria-label="Attach a file" disabled>
                  <Paperclip aria-hidden="true" />
                </button>
                <button
                  className="send"
                  type="button"
                  aria-label="Send message"
                  onClick={() => ctx.run({ ui: "send" })}
                  disabled={hasQuestion}
                >
                  <ArrowUp aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        )}
        <p className="composer-disclaimer">
          Not medical advice, and not a substitute for a doctor or a certified coach.
        </p>
      </div>
    );
  }
  return { question, content, sidebar, contextPanel, dialog, composer, sourceCard, button };
}
