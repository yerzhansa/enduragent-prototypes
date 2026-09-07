export type Mode = "fixed" | "flexible";
export type Goal = ({ kind: "fitness" } | { kind: "event"; date: string }) & {
  name: string;
  source: string;
  id?: string;
};
export interface Availability {
  days: number[];
  weeklyHours: number;
  longest: number;
  weekdayMinutes: number;
  poolCount?: number | null;
}
export type Restriction =
  | { kind: "none" }
  | { kind: "no-training" | "no-hard-training"; end?: string }
  | { kind: "max-duration"; minutes: number; end?: string };
export type Commitment = (
  | { kind: "unavailable" | "no-hard"; day: number }
  | { kind: "duration"; day: number; minutes: number }
  | { kind: "time-off"; start: string; end: string }
  | { kind: "pinned"; date: string; name: string; minutes?: number }
) & { id?: string; source?: string };
export interface SupportingEvent {
  id: string;
  name: string;
  date: string;
  role: string;
  source?: string;
  providerPriority?: string | null;
  minutes?: number;
}
export interface Answers {
  goal: Goal;
  length?: number;
  mode: Mode;
  availability: Availability;
  start: string;
  commitments: Commitment[];
  baseline: string;
  success: string;
  restriction: Restriction;
  supportingEvents?: SupportingEvent[];
}
export type AnswerKey = keyof Answers;
export type AnswerValue = Answers[AnswerKey];
export interface Workout {
  id: string;
  name: string;
  kind: string;
  date: string | null;
  minutes: number;
  status: "planned" | "completed" | "Not chosen";
  pinned: boolean;
  week: number;
  power: number | null;
  guidance: string;
  source?: string;
  commitmentId?: string;
  supportingEventId?: string;
  mirrored?: boolean;
}
export interface Week {
  number: number;
  start: string;
  end: string;
  workouts: Workout[];
  notes: string[];
}
export interface Draft {
  id: string;
  creationId: string;
  revision: number;
  inputs: Answers;
  sources: Partial<Record<AnswerKey, string>>;
  goal: Goal;
  mode: Mode;
  start: string;
  end: string;
  spanKind: string;
  computedWeeks: number;
  weeks: Week[];
  supportingEvents: SupportingEvent[];
  ftp: number | null;
  approach: string;
  mirrorStatus: string;
  inputFingerprint: string;
  outputFingerprint: string;
}
export type CloseReason = "Completed" | "Stopped" | "Closed to start a new Plan" | "Unknown";
export type Plan = Draft &
  (
    | { status: "active"; activated: string; mirrorStart?: string; mirrorEnd?: string }
    | {
        status: "closed";
        reason: CloseReason;
        closedAt: string;
        activated?: string;
        mirrorStart?: string;
        mirrorEnd?: string;
      }
  );
export type Destination =
  | { kind: "chat" | "library" }
  | { kind: "creation" | "change" | "closed"; id: string }
  | { kind: "recovery"; id?: string };
export type Dialog = (
  | { kind: "discard"; creationId: string }
  | {
      kind: "activate";
      creationId: string;
      revision: number;
      activeId: string | null;
      activeRevision: number | null;
    }
  | { kind: "close"; planId: string; revision: number }
) & { returnTarget: Destination };
export interface Creation {
  id: string;
  revision: number;
  answers: Partial<Answers>;
  sources: Partial<Record<AnswerKey, string>>;
  draft: Draft | null;
  status: "in-progress" | "review";
  paused: boolean;
  editing: AnswerKey | null;
  editor: string | null;
  editingReturn: { paused: boolean; status: Creation["status"]; destination: Destination } | null;
  pendingCommitment: {
    text: string;
    rule: Commitment | null;
    status: "confirm" | "clarify";
    previous: Commitment[];
  } | null;
  build: {
    completed: number;
    weeks: number;
    output: Week[];
    candidate: Draft;
    revision: number;
  } | null;
  error: string | null;
  uncertain: { key: AnswerKey; value: AnswerValue }[];
  requireCommitments?: boolean;
  poolCount?: number;
}
export type ChangeIntent =
  | { kind: "weekday-duration"; day: number; minutes: number }
  | { kind: "weekday-cap"; day: number; minutes: number }
  | { kind: "weekday-unavailable"; day: number }
  | { kind: "hard-weekday"; day: number }
  | { kind: "weekday-hard-block"; day: number }
  | { kind: "weekly-duration"; hours: number }
  | { kind: "weekly-cap"; hours: number }
  | { kind: "longest-workout"; minutes: number }
  | { kind: "longest-cap"; minutes: number }
  | { kind: "choose-workout"; workoutId: string }
  | {
      kind: "supporting-event";
      operation?: "add" | "remove" | "role" | "manual" | "source-update" | "name";
      event: Partial<SupportingEvent>;
    }
  | { kind: "ftp"; ftp: number }
  | { kind: "inverse" };
export interface FtpSource {
  value: number;
  source: string;
  selected: boolean;
}
export interface Fixture {
  connected: boolean;
  today: string;
  ftp: number | null;
  events: (Omit<SupportingEvent, "role"> & { role?: string })[];
  facts: {
    availability?: { value: Availability; source: string };
    baseline?: { value: string; source: string; avgWeeklyMinutes: number; longest: number };
  };
  ftpSources: FtpSource[];
  evidenceRevision: number;
  sourceRevision: number;
  guard: string | null;
  fail: string | null;
  activeMode?: Mode;
  restWeek?: number;
  noWorkouts?: boolean;
  syncStale?: boolean;
  evidenceMissing?: boolean;
  conflictingEvidence?: boolean;
  activationResult?: string;
  unknownHistory?: boolean;
  competingResult?: boolean;
  raceWindow?: boolean;
  taper?: boolean;
  recoveryNotice?: string;
}
export interface StateOptions {
  connected?: boolean;
  active?: boolean;
  history?: boolean;
  fixture?: Partial<Fixture>;
}
export interface SampleOptions {
  start?: string;
  kind?: Goal["kind"];
  eventDate?: string;
  length?: number;
  mode?: Mode;
  weeklyHours?: number;
  availability?: Partial<Availability>;
  answers?: Partial<Answers>;
}
export interface Totals {
  workouts: number;
  minutes: number;
  weeks: { number: number; minutes: number; workouts: number }[];
}
export type Premise = (
  | { id: "confirmed-limits"; value: Availability }
  | { id: "training-record"; value: { summary: string; revision: number } }
  | {
      id: "ftp-sources";
      value: {
        acceptedPlanFtp: number | null;
        requestedFtp: number | null;
        candidates: FtpSource[];
      };
    }
) & { label: string; source: string };
export interface Preview {
  id: string;
  planId: string;
  revision: number;
  title: string;
  intent: ChangeIntent;
  before: Plan;
  after: Plan;
  diff: { id: string; before: Workout | null; after: Workout | null }[];
  totals: { before: Totals; after: Totals };
  status: "pending" | "superseded" | "closed" | "applied" | "cancelled";
  details: string;
  sourceRevision: number;
  evidenceRevision: number;
  confidence: string;
  premises: Premise[];
  supersedes: string | null;
}
export type Legacy = (
  | { kind: "creation"; answers: Partial<Answers>; uncertain: Creation["uncertain"] }
  | { kind: "change"; intent: ChangeIntent }
) & { id: string; title: string; evidence: string };
export interface State {
  creation: Creation | null;
  active: Plan | null;
  closed: Plan[];
  change: Preview | null;
  changeHistory: Preview[];
  destination: Destination;
  notice: string;
  dialog: Dialog | null;
  fixture: Fixture;
  messages: { role: "you"; text: string }[];
  legacy: Legacy[];
  serial: number;
  outcomes: Record<string, { input: string; notice: string }>;
  recovery: { source: Legacy; status: "review" | "continued" } | null;
  lastApplied: { planId: string; before: Plan; afterRevision: number; previewId: string } | null;
  calendar: null;
  changeError?: string | null;
}
export type FixtureCommand = {
  [K in keyof Fixture]-?: { type: "set-fixture"; key: K; value: Fixture[K] };
}[keyof Fixture];
export type Command = (
  | {
      type:
        | "start"
        | "back"
        | "cancel-edit"
        | "later"
        | "bump-plan-revision"
        | "build-start"
        | "build-next"
        | "build-finish"
        | "commitment-confirm"
        | "commitment-cancel"
        | "open-discard"
        | "cancel-dialog"
        | "confirm-discard"
        | "open-activate"
        | "confirm-activate"
        | "retry-calendar"
        | "undo"
        | "close-plan"
        | "confirm-close"
        | "complete-plan"
        | "close-week"
        | "confirm-recovery"
        | "cancel-recovery";
    }
  | {
      type: "answer" | "recover-confirm-detail";
      key: AnswerKey;
      value: unknown;
      source?: string;
      creationId?: string;
      expectedRevision?: number;
    }
  | { type: "edit"; key: AnswerKey }
  | { type: "continue"; id?: string }
  | { type: "navigate"; destination: Destination }
  | FixtureCommand
  | { type: "fixture-clock"; date: string }
  | { type: "commitment-edit"; text: string; creationId?: string; expectedRevision?: number }
  | { type: "rule-remove" | "apply-change" | "cancel-change" | "recover"; id: string }
  | {
      type: "request-change";
      intent: ChangeIntent;
      expectedRevision?: number;
      expectedSerial?: number;
    }
  | { type: "notice" | "chat-message"; text: string }
) & { commandId?: string };
export interface TextExample {
  text: string;
  type: "answer";
  key: AnswerKey;
  value: unknown;
  source?: string;
  creationId: string;
  expectedRevision: number;
}
export interface Scenario {
  id: string;
  name: string;
  group: string;
  acceptance: string[];
  purpose: string;
  steps: string[];
  variations?: { id: string; label: string }[];
}
