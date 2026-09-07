export const TODAY = '1998-08-24';
const copy = value => structuredClone(value);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const civil = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
export const addDays = (date, days) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
const weekday = date => new Date(`${date}T00:00:00Z`).getUTCDay() || 7;
const duration = snapshot => workouts(snapshot).filter(w => w.status !== 'Not chosen').reduce((sum, w) => sum + w.minutes, 0);
const today = state => state.fixture.today || TODAY;
const id = (state, prefix) => `${prefix}-${++state.serial}`;
export const workouts = snapshot => snapshot?.weeks?.flatMap(week => week.workouts) || [];
export const title = snapshot => snapshot?.goal?.name || snapshot?.answers?.goal?.name || 'New Plan';
export function totals(snapshot) {
  return { workouts: workouts(snapshot).filter(w => w.status !== 'Not chosen').length, minutes: duration(snapshot), weeks: (snapshot?.weeks || []).map(w => ({ number: w.number, minutes: w.workouts.filter(x => x.status !== 'Not chosen').reduce((n, x) => n + x.minutes, 0), workouts: w.workouts.length })) };
}
export function eventSpan(start, event) {
  if (!civil(start) || !civil(event) || event < start) throw new Error('Choose an event date on or after the Plan start.');
  const computedWeeks = Math.ceil(((Date.parse(event) - Date.parse(start)) / 86400000 + 1) / 7);
  const weeks = computedWeeks > 24 ? 12 : computedWeeks;
  return { weeks, computedWeeks, kind: computedWeeks <= 4 ? 'Short block' : computedWeeks > 24 ? 'Base Plan' : 'Event preparation', end: addDays(start, weeks * 7 - 1) };
}
export function poolSize(hours, override = null) {
  if (!Number.isFinite(Number(hours)) || Number(hours) <= 0) throw new Error('Enter a weekly limit above zero.');
  if (override !== null && override !== undefined) {
    if (![3, 4, 5].includes(Number(override))) throw new Error('Choose 3, 4, or 5 Workouts.');
    return Number(override);
  }
  return hours <= 6 ? 3 : hours <= 8 ? 4 : 5;
}
export function requiredKeys(creation) {
  const keys = ['goal'];
  if (creation?.answers?.goal?.kind === 'fitness') keys.push('length');
  return [...keys, 'mode', 'availability', 'start', ...(creation?.requireCommitments || creation?.answers?.commitments || creation?.pendingCommitment ? ['commitments'] : []), 'baseline', 'success', 'restriction'];
}
export function nextQuestion(creation) {
  if (!creation) return null;
  if (creation.editing) return creation.editing;
  return requiredKeys(creation).find(key => creation.answers[key] === undefined || creation.answers[key] === null || creation.answers[key] === '') || null;
}
export function sampleAnswers(options = {}) {
  const start = options.start || TODAY;
  const kind = options.kind || 'event';
  return {
    goal: kind === 'fitness' ? { kind, name: 'Build lasting fitness', source: 'Your answer' } : { kind, name: 'Autumn Hills Ride', date: options.eventDate || addDays(start, 41), source: 'Your answer' },
    ...(kind === 'fitness' ? { length: options.length || 4 } : {}),
    mode: options.mode || 'fixed',
    availability: { days: [1, 3, 6], weeklyHours: options.weeklyHours || 6, longest: 120, weekdayMinutes: 60, ...(options.availability || {}) },
    start, commitments: [], baseline: 'Regular', success: kind === 'fitness' ? 'Train consistently' : 'Finish comfortably', restriction: { kind: 'none' },
    ...(options.answers || {})
  };
}
function blankCreation(state) {
  return { id: id(state, 'creation'), revision: 1, answers: {}, sources: {}, draft: null, status: 'in-progress', paused: false, editing: null, editor: null, editingReturn: null, pendingCommitment: null, build: null, error: null, uncertain: [] };
}
function validateAnswer(key, value, creation) {
  if (key === 'goal') {
    if (!['event', 'fitness'].includes(value?.kind) || !String(value.name || '').trim()) throw new Error('Enter the goal name.');
    if (value.kind === 'event' && !civil(value.date)) throw new Error('Enter the event name and exact date.');
    return { kind: value.kind, name: value.name.trim(), ...(value.kind === 'event' ? { date: value.date } : {}), source: value.source || 'Your answer', ...(value.id ? { id: value.id } : {}) };
  }
  if (key === 'length' && ![4, 8, 12, 16].includes(Number(value))) throw new Error('Choose 4, 8, 12, or 16 weeks.');
  if (key === 'mode' && !['fixed', 'flexible'].includes(value)) throw new Error('Choose Fixed or Flexible.');
  if (key === 'availability') {
    if (!(Number(value?.weeklyHours) > 0) || !(Number(value?.longest) > 0) || !(Number(value?.weekdayMinutes) > 0)) throw new Error('Enter weekly, weekday, and longest-Workout limits above zero.');
    if (Number(value.longest) > Number(value.weeklyHours) * 60) throw new Error('The longest Workout cannot exceed the weekly duration limit.');
    if (creation.answers.mode === 'fixed' && (!Array.isArray(value.days) || !value.days.length || value.days.some(d => ![1, 2, 3, 4, 5, 6, 7].includes(Number(d))))) throw new Error('Choose at least one usable weekday.');
    if (value.poolCount !== undefined && value.poolCount !== null) poolSize(value.weeklyHours, value.poolCount);
    return { ...copy(value), days: [...new Set((value.days || []).map(Number))], weeklyHours: Number(value.weeklyHours), longest: Number(value.longest), weekdayMinutes: Number(value.weekdayMinutes) };
  }
  if (key === 'start' && !civil(value)) throw new Error('Choose an exact start date.');
  if (key === 'baseline' && !String(value || '').trim()) throw new Error('Choose a recent-training starting point.');
  if (key === 'success' && !String(value || '').trim()) throw new Error('Choose or write what success means for you.');
  if (key === 'restriction') {
    if (!['none', 'no-training', 'no-hard-training', 'max-duration'].includes(value?.kind)) throw new Error('Choose an operational training limit.');
    if (Object.keys(value).some(k => !['kind', 'minutes', 'end'].includes(k))) throw new Error('Use only the training limit and optional end date.');
    if (value.kind === 'max-duration' && !(Number(value.minutes) > 0)) throw new Error('Enter the maximum Workout duration above zero.');
    if (value.end && !civil(value.end)) throw new Error('Enter an exact restriction end date.');
    return { kind: value.kind, ...(value.kind === 'max-duration' ? { minutes: Number(value.minutes) } : {}), ...(value.kind !== 'none' && value.end ? { end: value.end } : {}) };
  }
  if (key === 'commitments') {
    if (!Array.isArray(value)) throw new Error('Confirm the interpreted limits first.');
    const rules = [];
    for (const rule of value) {
      if (!['unavailable', 'duration', 'no-hard', 'time-off', 'pinned'].includes(rule.kind)) throw new Error('Choose a supported scheduling rule.');
      if (rule.kind === 'time-off' && (!civil(rule.start) || !civil(rule.end) || rule.end < rule.start)) throw new Error('Enter exact time-off dates in order.');
      if (['unavailable', 'duration', 'no-hard'].includes(rule.kind) && ![1, 2, 3, 4, 5, 6, 7].includes(Number(rule.day))) throw new Error('Choose the weekday for this limit.');
      if (rule.kind === 'duration' && !(Number(rule.minutes) > 0)) throw new Error('Enter a duration above zero.');
      if (rule.kind === 'pinned' && (!civil(rule.date) || !rule.name)) throw new Error('Enter the commitment name and exact date.');
      const ruleId = rule.id || `${rule.kind}-${rule.day || rule.start || rule.date}`;
      const existing = rules.findIndex(r => r.id === ruleId || (r.kind === rule.kind && r.day === rule.day && r.start === rule.start && r.date === rule.date));
      const normalized = { ...copy(rule), id: existing >= 0 ? rules[existing].id : ruleId, source: rule.source || 'Your confirmed commitment' };
      if (existing >= 0) rules[existing] = normalized;
      else rules.push(normalized);
    }
    return rules;
  }
  return key === 'length' ? Number(value) : copy(value);
}
function answerInto(state, key, value, source) {
  const creation = state.creation;
  if (!creation) return;
  try {
    let validated = validateAnswer(key, value, creation);
    if (key === 'start') {
      if (validated < today(state)) throw new Error('Choose today or a later Plan start.');
      if (creation.answers.availability && creation.answers.mode) validated = nextValidStart(creation.answers, validated) || validated;
    }
    if (key === 'mode' && creation.answers.mode && creation.answers.mode !== validated) { delete creation.answers.availability; delete creation.sources.availability; delete creation.poolCount; }
    if (key === 'goal' && creation.answers.goal?.kind !== validated.kind) {
      delete creation.answers.length;
      delete creation.answers.success;
      delete creation.sources.length;
      delete creation.sources.success;
    }
    creation.answers[key] = validated;
    creation.sources[key] = source || (key === 'goal' ? validated.source : 'Your confirmed answer');
    creation.revision++;
    creation.status = 'in-progress';
    creation.editing = null;
    creation.editingReturn = null;
    creation.build = null;
    creation.error = null;
    creation.uncertain = (creation.uncertain || []).filter(item => item.key !== key);
    if (key === 'commitments') creation.pendingCommitment = null;
    if (key === 'availability' && creation.answers.mode === 'flexible') creation.poolCount = poolSize(validated.weeklyHours, validated.poolCount);
  } catch (error) {
    creation.error = error.message;
  }
}
export function answer(state, key, value, source) {
  return transition(state, { type: 'answer', key, value, source });
}
function rulesFor(answers, date) {
  const rules = (answers.commitments || []).filter(rule => rule.day === weekday(date) || (rule.start && date >= rule.start && date <= rule.end) || rule.date === date);
  const restriction = answers.restriction || { kind: 'none' };
  const restricted = !restriction.end || date <= restriction.end;
  const unavailable = rules.some(r => ['unavailable', 'time-off'].includes(r.kind)) || (restricted && restriction.kind === 'no-training');
  const limits = [answers.availability.longest, weekday(date) <= 5 ? answers.availability.weekdayMinutes : answers.availability.longest, ...rules.filter(r => r.kind === 'duration').map(r => Number(r.minutes))];
  if (restricted && restriction.kind === 'max-duration') limits.push(restriction.minutes);
  return { unavailable, minutes: Math.min(...limits), noHard: rules.some(r => r.kind === 'no-hard') || (restricted && restriction.kind === 'no-hard-training') };
}
export function nextValidStart(answers, from = TODAY) {
  for (let offset = 0; offset < 370; offset++) {
    const date = addDays(from, offset);
    if ((answers.mode === 'flexible' || answers.availability.days.includes(weekday(date))) && !rulesFor(answers, date).unavailable) return date;
  }
  return null;
}
export function buildDraft(creation, fixture = {}) {
  if (nextQuestion({ ...creation, editing: null })) throw new Error('Answer the remaining question before building.');
  if (creation.pendingCommitment) throw new Error('Clarify or cancel the pending commitment correction.');
  if (creation.uncertain?.length) throw new Error('Confirm the uncertain recovered details.');
  const answers = copy(creation.answers);
  answers.commitments ||= [];
  const span = answers.goal.kind === 'event' ? eventSpan(answers.start, answers.goal.date) : { weeks: answers.length, end: addDays(answers.start, answers.length * 7 - 1), kind: 'Fitness Plan' };
  const templates = [{ name: 'Controlled effort', kind: 'hard', minutes: 45 }, { name: 'Endurance ride', kind: 'endurance', minutes: 60 }, { name: 'Long ride', kind: 'long', minutes: 100 }, { name: 'Optional easy ride', kind: 'easy', minutes: 30 }, { name: 'Additional endurance ride', kind: 'endurance', minutes: 45 }];
  const weeks = [];
  const count = answers.mode === 'flexible' ? poolSize(answers.availability.weeklyHours, answers.availability.poolCount) : 3;
  const ftp = Number.isFinite(fixture.ftp) && fixture.ftp > 0 ? fixture.ftp : null;
  for (let n = 1; n <= span.weeks; n++) {
    const start = addDays(answers.start, (n - 1) * 7);
    const end = addDays(start, 6);
    const week = { number: n, start, end, workouts: [], notes: [] };
    let remaining = Math.floor(answers.availability.weeklyHours * 60);
    const dates = Array.from({ length: 7 }, (_, i) => addDays(start, i));
    const usable = dates.filter(date => answers.availability.days.includes(weekday(date)) && !rulesFor(answers, date).unavailable);
    if (fixture.restWeek === n || fixture.noWorkouts) {
      week.notes.push('Confirmed limits leave no Workouts in this week.');
      weeks.push(week);
      continue;
    }
    const pins = [...(answers.supportingEvents || []), ...(answers.commitments || []).filter(rule => rule.kind === 'pinned').map(rule => ({ ...rule, role: 'Commitment' }))].filter(event => event.date >= start && event.date <= end && event.role !== 'Ignore for this Plan');
    if (answers.goal.kind === 'event' && answers.goal.date >= start && answers.goal.date <= end) pins.push({ ...answers.goal, id: 'main-goal', role: 'Main Goal' });
    for (const pin of pins) {
      const rule = rulesFor(answers, pin.date);
      if (rule.unavailable || remaining <= 0) { week.notes.push(`${pin.name} has no training assigned under your confirmed limits.`); continue; }
      const minutes = Math.min(pin.minutes || 60, rule.minutes, remaining);
      week.workouts.push({ id: `${creation.id}-w${n}-${pin.id || 'event'}`, name: pin.name, kind: 'event', date: pin.date, minutes, status: 'planned', pinned: true, week: n, power: null, guidance: 'Follow the confirmed event limit', source: pin.source || 'Your answer', ...(pin.role === 'Commitment' ? { commitmentId: pin.id } : pin.id !== 'main-goal' ? { supportingEventId: pin.id } : {}) });
      remaining -= minutes;
    }
    for (let index = 0; index < count; index++) {
      const template = templates[index];
      const available = usable.filter(date => !week.workouts.some(w => w.date === date));
      const assigned = answers.mode === 'fixed' ? available[0] : null;
      const possible = dates.filter(date => !rulesFor(answers, date).unavailable);
      if ((answers.mode === 'fixed' && !assigned) || (answers.mode === 'flexible' && !possible.length) || remaining <= 0) {
        week.notes.push(`${template.name} removed because no compatible time remains.`);
        continue;
      }
      const rule = assigned ? rulesFor(answers, assigned) : { minutes: Math.min(answers.availability.longest, ...possible.map(date => rulesFor(answers, date).minutes)), noHard: possible.some(date => rulesFor(answers, date).noHard) };
      const minutes = Math.min(template.minutes, rule.minutes, remaining);
      const kind = template.kind === 'hard' && rule.noHard ? 'easy' : template.kind;
      const name = template.kind === 'hard' && rule.noHard ? 'Easy ride' : template.name;
      if (minutes < template.minutes) week.notes.push(`${name} limited to ${minutes} minutes by your confirmed limits.`);
      if (kind !== template.kind) week.notes.push('Hard training replaced with an easy ride under the confirmed restriction.');
      week.workouts.push({ id: `${creation.id}-w${n}-${index + 1}`, name, kind, date: assigned, minutes, status: 'planned', pinned: false, week: n, power: ftp && kind !== 'event' ? ftp : null, guidance: ftp ? `Use your confirmed FTP of ${ftp} W` : 'Use comfortable perceived effort or your known heart-rate guidance' });
      remaining -= minutes;
    }
    weeks.push(week);
  }
  return { id: `${creation.id}-draft-${creation.revision}`, creationId: creation.id, revision: creation.revision, inputs: answers, sources: copy(creation.sources), goal: copy(answers.goal), mode: answers.mode, start: answers.start, end: span.end, spanKind: span.kind, computedWeeks: span.computedWeeks || span.weeks, weeks, supportingEvents: copy(answers.supportingEvents || []), ftp, approach: 'Balanced', mirrorStatus: 'Local review only', inputFingerprint: JSON.stringify(answers), outputFingerprint: JSON.stringify(weeks) };
}
export function createState(options = {}) {
  const connected = options.connected !== false;
  const fixture = { connected, today: TODAY, ftp: connected ? 210 : null, events: connected ? [{ id: 'hills', name: 'Autumn Hills Ride', date: '1998-10-04', source: 'Intervals.icu event', providerPriority: 'B' }, { id: 'social', name: 'Autumn Social Ride', date: '1998-09-03', source: 'Intervals.icu event', providerPriority: 'A' }] : [], facts: connected ? { availability: { value: { days: [1, 3, 6], weeklyHours: 6, longest: 120, weekdayMinutes: 60 }, source: 'Saved athlete preference' }, baseline: { value: 'Regular', source: 'Intervals.icu recent rides', avgWeeklyMinutes: 400, longest: 130 } } : {}, ftpSources: connected ? [{ value: 210, source: 'Saved athlete FTP', selected: true }, { value: 205, source: 'Intervals.icu FTP', selected: false }, { value: 215, source: 'Intervals.icu eFTP', selected: false }] : [], evidenceRevision: 1, sourceRevision: 1, guard: null, fail: null, ...copy(options.fixture || {}) };
  const state = { creation: null, active: null, closed: [], change: null, changeHistory: [], destination: { kind: 'chat' }, notice: '', dialog: null, fixture, messages: [], legacy: [], serial: 0, outcomes: {}, recovery: null, lastApplied: null, calendar: null };
  if (options.active) {
    const creation = blankCreation(state);
    creation.answers = sampleAnswers({ start: addDays(fixture.today, -7), mode: fixture.activeMode || 'fixed' });
    creation.sources = Object.fromEntries(Object.keys(creation.answers).map(key => [key, 'Previously confirmed']));
    creation.answers.supportingEvents = [{ id: 'river', name: 'River Circuit', date: addDays(fixture.today, 10), role: 'Training', source: 'Intervals.icu event', providerPriority: 'C' }, { id: 'meadow', name: 'Meadow Social Ride', date: addDays(fixture.today, 17), role: 'Training', source: 'Your answer', providerPriority: null }];
    state.active = { ...buildDraft(creation, fixture), id: 'plan-active', revision: 1, status: 'active', mirrorStatus: connected ? 'Up to date' : 'Connect to mirror Workouts', activated: addDays(fixture.today, -7) };
    for (const workout of workouts(state.active)) workout.mirrored = connected && !!workout.date && workout.date >= fixture.today && workout.date <= addDays(fixture.today, 6);
    const past = workouts(state.active).find(w => w.date && w.date < fixture.today);
    if (past) past.status = 'completed';
    if (fixture.activeMode === 'flexible') {
      const completed = state.active.weeks[0].workouts[0];
      completed.date = addDays(fixture.today, -5);
      completed.status = 'completed';
    }
  }
  if (options.history) {
    const creation = blankCreation(state);
    creation.answers = sampleAnswers({ kind: 'fitness', length: 4, start: addDays(fixture.today, -42) });
    creation.sources = { goal: 'Previously confirmed' };
    state.closed.push({ ...buildDraft(creation, fixture), id: 'plan-closed', status: 'closed', reason: 'Completed', revision: 1, closedAt: addDays(fixture.today, -15), mirrorStatus: 'Final history' });
  }
  state.legacy = [{ id: 'legacy-creation', kind: 'creation', title: 'Earlier Autumn Hills details', answers: { goal: { kind: 'event', name: 'Autumn Hills Ride', date: '1998-10-04', source: 'Recovered answer' }, mode: 'fixed' }, uncertain: [{ key: 'availability', value: sampleAnswers().availability }], evidence: 'Preserved earlier conversation. Weekly limits need your confirmation.' }, { id: 'legacy-change', kind: 'change', title: 'Earlier weekday limit', intent: { kind: 'weekday-duration', day: 3, minutes: 30 }, evidence: 'Earlier unapplied request. No current confirmation.' }];
  return state;
}
function mutableWorkout(workout, state) {
  const week = state.active?.weeks.find(item => item.number === workout.week);
  return workout.status === 'planned' && (workout.date ? workout.date >= today(state) : week && week.end >= today(state));
}
export function eligibleWorkouts(state) {
  if (!state.active || state.active.mode !== 'flexible') return [];
  const date = today(state);
  const week = state.active.weeks.find(w => date >= w.start && date <= w.end);
  if (!week) return [];
  const rule = rulesFor(state.active.inputs, date);
  const occupied = workouts(state.active).some(w => w.date === date) || state.closed.some(plan => workouts(plan).some(w => w.date === date && w.mirrored));
  return week.workouts.filter(w => !w.pinned && !w.date && w.status === 'planned').map(workout => {
    const reason = occupied ? 'Today already belongs to a dated Workout.' : rule.unavailable ? 'Today is unavailable under your confirmed limits.' : workout.minutes > rule.minutes ? `Today is limited to ${rule.minutes} minutes.` : workout.kind === 'hard' && rule.noHard ? 'No hard training today.' : '';
    return { workout: copy(workout), eligible: !reason, reason };
  });
}
const intentNames = { 'weekday-duration': 'Limit weekday duration', 'weekday-unavailable': 'Keep a weekday free', 'hard-weekday': 'No hard training on a weekday', 'weekly-duration': 'Limit weekly duration', 'longest-workout': 'Limit the longest Workout', 'choose-workout': 'Choose a Workout for today', 'supporting-event': 'Change a Supporting Event', ftp: 'Correct FTP', inverse: 'Undo the latest Change' };
export function creationTextExamples(state) {
  const creation = state.creation;
  const key = nextQuestion(creation);
  if (!key) return [];
  const choices = [];
  const add = (text, value, source) => choices.push({ text, type: 'answer', key, value, ...(source ? { source } : {}), creationId: creation.id, expectedRevision: creation.revision });
  if (key === 'goal') {
    for (const event of state.fixture.events || []) add(event.name, { ...event, kind: 'event' });
    add('Improve without an event', { kind: 'fitness', name: 'Improve fitness', source: 'Your answer' });
    const eventDate = addDays(today(state), 28);
    add(`Event: Park ride on ${eventDate}`, { kind: 'event', name: 'Park ride', date: eventDate, source: 'Your answer' });
  }
  if (key === 'length') for (const length of [4, 8, 12, 16]) add(`${length} weeks`, length);
  if (key === 'mode') { add('Fixed days', 'fixed'); add('My week varies', 'flexible'); if (state.fixture.facts?.availability) add('Looks right', 'fixed'); }
  if (key === 'availability') {
    if (state.fixture.facts?.availability) add('Looks right', copy(state.fixture.facts.availability.value), state.fixture.facts.availability.source);
    if (creation.answers.mode === 'flexible') add('6 hours weekly, 120 minutes longest', { days: [], weeklyHours: 6, longest: 120, weekdayMinutes: 120 });
    else add('6 hours weekly, 120 minutes longest, 60 minutes weekdays, Monday Wednesday Saturday', sampleAnswers().availability);
  }
  if (key === 'start') add('Next valid Plan day', today(state));
  if (key === 'commitments') add('No fixed commitments', []);
  if (key === 'baseline') for (const value of ['Regular', 'Occasional', 'Starting again']) add(value, value);
  if (key === 'success') {
    const values = creation.answers.goal?.kind === 'event' ? ['Finish comfortably', 'Finish fast', 'Race for a result'] : ['Train consistently', 'Climb stronger', 'Ride farther comfortably'];
    for (const value of values) add(value, value);
    add('Success: ride to the lake comfortably', 'Ride to the lake comfortably');
  }
  if (key === 'restriction') {
    add('No training restrictions', { kind: 'none' });
    add('No training', { kind: 'no-training' });
    add('No hard training', { kind: 'no-hard-training' });
    add('Maximum 30 minutes', { kind: 'max-duration', minutes: 30 });
    const end = addDays(today(state), 4);
    add(`No hard training through ${end}`, { kind: 'no-hard-training', end });
    add(`Maximum 30 minutes through ${end}`, { kind: 'max-duration', minutes: 30, end });
  }
  return choices;
}
function commitmentRule(text) {
  const recurring = text.match(/^(?:wednesdays|Wednesday) (?:at most |maximum )?(\d+) minutes$/i);
  const absence = text.match(/^time off (\d{4}-\d{2}-\d{2}) to (\d{4}-\d{2}-\d{2})$/i);
  if (recurring) return { id: 'duration-3', kind: 'duration', day: 3, minutes: Number(recurring[1]), source: 'Your written commitment' };
  if (absence) return { id: `time-off-${absence[1]}`, kind: 'time-off', start: absence[1], end: absence[2], source: 'Your written commitment' };
  return null;
}
export function interpret(text, state) {
  const input = String(text).trim().toLowerCase();
  const creationContext = state.destination.kind !== 'change';
  if (creationContext && state.creation && (nextQuestion(state.creation) === 'commitments' || state.creation.pendingCommitment) && commitmentRule(String(text).trim())) return { type: 'commitment-edit', text: String(text).trim(), creationId: state.creation.id, expectedRevision: state.creation.revision };
  const matches = (creationContext ? creationTextExamples(state) : []).filter(example => example.text.toLowerCase() === input);
  if (matches.length === 1) { const { text: exampleText, ...action } = matches[0]; return action; }
  const exact = { 'wednesdays at most 30 minutes': { kind: 'weekday-duration', day: 3, minutes: 30 }, 'no training on wednesdays': { kind: 'weekday-unavailable', day: 3 }, 'no hard training on mondays': { kind: 'hard-weekday', day: 1 }, 'at most 3 hours each week': { kind: 'weekly-duration', hours: 3 }, 'long rides at most 60 minutes': { kind: 'longest-workout', minutes: 60 }, 'my ftp is 220': { kind: 'ftp', ftp: 220 } };
  if (exact[input]) return { type: 'request-change', intent: exact[input] };
  if (input === 'what should i ride today') {
    const eligible = eligibleWorkouts(state).find(entry => entry.eligible);
    return eligible ? { type: 'request-change', intent: { kind: 'choose-workout', workoutId: eligible.workout.id } } : { type: 'notice', text: 'No eligible Workout can be selected today.' };
  }
  return { type: 'notice', text: 'This example is not supported. Choose one of the available actions.' };
}
function previewDiff(before, after) {
  const old = new Map(workouts(before).map(w => [w.id, w]));
  const next = new Map(workouts(after).map(w => [w.id, w]));
  return [...new Set([...old.keys(), ...next.keys()])].flatMap(key => same(old.get(key), next.get(key)) ? [] : [{ id: key, before: copy(old.get(key) || null), after: copy(next.get(key) || null) }]);
}
function changeError(state, message) {
  state.notice = message;
  state.changeError = message;
}
function makePreview(state, suppliedIntent) {
  const aliases = { 'weekday-cap': 'weekday-duration', 'weekday-hard-block': 'hard-weekday', 'weekly-cap': 'weekly-duration', 'longest-cap': 'longest-workout' };
  const intent = { ...suppliedIntent, kind: aliases[suppliedIntent?.kind] || suppliedIntent?.kind };
  if (!state.active) return changeError(state, 'This Plan is closed. Its final details remain available.');
  if (state.fixture.syncStale || state.fixture.guard === 'stale-sync') return changeError(state, 'Plan Changes are paused because synchronized training is older than 24 hours. Refresh the connection, then request a fresh preview.');
  if (state.fixture.evidenceMissing) return changeError(state, 'The cited training source is unavailable. Restore that source before requesting a fresh preview.');
  if (['translation', 'validation', 'build', 'interruption'].includes(state.fixture.fail)) return changeError(state, `The new request could not be prepared (${state.fixture.fail}). Your current preview and training are unchanged.`);
  if (!intentNames[intent?.kind]) return changeError(state, 'Choose a supported Plan Change.');
  const before = copy(state.active);
  let after = copy(before);
  let details = '';
  try {
    if (['weekday-duration', 'weekday-unavailable', 'hard-weekday'].includes(intent.kind) && ![1, 2, 3, 4, 5, 6, 7].includes(Number(intent.day))) throw new Error('Choose the weekday to change.');
    if (['weekday-duration', 'longest-workout'].includes(intent.kind) && !(Number(intent.minutes) > 0)) throw new Error('Enter a duration above zero.');
    if (intent.kind === 'weekly-duration' && !(Number(intent.hours) > 0)) throw new Error('Enter a weekly duration above zero.');
    if (intent.kind === 'ftp' && !(Number(intent.ftp) > 0)) throw new Error('Enter FTP above zero.');
    if (intent.kind === 'inverse') {
      if (!state.lastApplied || state.lastApplied.planId !== before.id || state.lastApplied.afterRevision !== before.revision) throw new Error('The latest Change is no longer eligible for Undo.');
      after = copy(state.lastApplied.before);
      after.id = before.id;
      after.revision = before.revision;
      const current = new Map(workouts(before).map(w => [w.id, w]));
      for (const week of after.weeks) {
        week.workouts = week.workouts.filter(w => current.has(w.id) || mutableWorkout(w, state)).map(w => current.has(w.id) && !mutableWorkout(current.get(w.id), state) ? copy(current.get(w.id)) : w);
        const restoredIds = new Set(week.workouts.map(w => w.id));
        week.workouts.push(...workouts(before).filter(w => w.week === week.number && !mutableWorkout(w, state) && !restoredIds.has(w.id)).map(copy));
      }
      details = 'Restore the previewed future training. Completed and past training stays unchanged.';
    } else if (intent.kind === 'choose-workout') {
      const eligible = eligibleWorkouts(state).find(entry => entry.workout.id === intent.workoutId);
      if (!eligible || !eligible.eligible) throw new Error(eligible?.reason || 'This Workout is no longer an eligible choice.');
      workouts(after).find(w => w.id === intent.workoutId).date = today(state);
      details = 'Only this Workout will receive today’s date after confirmation.';
    } else if (intent.kind === 'supporting-event') {
      const event = copy(intent.event || {});
      const operation = intent.operation || 'add';
      const existing = after.supportingEvents.find(e => e.id === event.id);
      if (operation !== 'add' && !existing) throw new Error('Choose a Supporting Event already accepted in this Plan.');
      if (operation === 'remove') after.supportingEvents = after.supportingEvents.filter(e => e.id !== event.id);
      else {
        const changed = { ...existing, ...event, id: existing?.id || event.id || `support-${state.serial + 1}`, providerPriority: existing?.providerPriority || event.providerPriority || null };
        if (!changed.name?.trim() || !civil(changed.date)) throw new Error('Enter the event name and exact date.');
        if (!['Important', 'Training'].includes(changed.role)) throw new Error('Choose Important or Training.');
        if (['manual', 'name'].includes(operation) && existing?.source?.includes('Intervals')) throw new Error('Accept synchronized event updates through a fresh source-update preview.');
        if (existing) Object.assign(existing, changed);
        else after.supportingEvents.push(changed);
      }
      const changed = after.supportingEvents.find(e => e.id === event.id) || after.supportingEvents.at(-1);
      const metadataOnly = existing && operation !== 'remove' && existing.date === before.supportingEvents.find(e => e.id === existing.id)?.date && existing.role === before.supportingEvents.find(e => e.id === existing.id)?.role;
      if (!metadataOnly) {
        for (const week of after.weeks) week.workouts = week.workouts.filter(w => !(w.supportingEventId === event.id && mutableWorkout(w, state)));
        if (operation !== 'remove' && changed.date >= today(state)) {
          const week = after.weeks.find(w => changed.date >= w.start && changed.date <= w.end);
          if (!week) throw new Error('Choose a Supporting Event inside this Plan span.');
          const rule = rulesFor(after.inputs, changed.date);
          if (rule.unavailable) throw new Error('The event date conflicts with a confirmed training limit.');
          const eventMinutes = Math.min(45, rule.minutes);
          const sameDay = week.workouts.find(w => w.date === changed.date && !w.pinned && mutableWorkout(w, state));
          if (sameDay) week.workouts = week.workouts.filter(w => w.id !== sameDay.id);
          week.workouts.push({ id: `${before.id}-event-${changed.id}`, name: changed.name, kind: 'event', date: changed.date, minutes: eventMinutes, status: 'planned', pinned: true, week: week.number, power: null, guidance: 'Use the accepted event limit', supportingEventId: changed.id });
          for (const w of week.workouts) if (!w.pinned && mutableWorkout(w, state) && changed.role === 'Important') { w.minutes = Math.min(w.minutes, 30); if (w.kind === 'hard') { w.kind = 'easy'; w.name = 'Easy ride'; } }
          let used = week.workouts.reduce((sum, w) => sum + w.minutes, 0);
          for (const w of [...week.workouts].reverse()) if (used > after.inputs.availability.weeklyHours * 60 && !w.pinned && mutableWorkout(w, state)) { const cut = Math.min(w.minutes, used - after.inputs.availability.weeklyHours * 60); w.minutes -= cut; used -= cut; }
          week.workouts = week.workouts.filter(w => w.minutes > 0);
        }
      }
      after.inputs.supportingEvents = copy(after.supportingEvents);
      details = operation === 'remove' ? `${existing.name} removed from this Plan. The source event stays unchanged.` : `${changed.name}, ${changed.date}, ${changed.role}. The Main Goal and provider priority stay unchanged.`;
    } else {
      for (const week of after.weeks) {
        for (const w of week.workouts) {
          if (!mutableWorkout(w, state) || w.pinned) continue;
          const selectedDay = w.date && weekday(w.date) === Number(intent.day);
          if (intent.kind === 'weekday-duration' && selectedDay) w.minutes = Math.min(w.minutes, Number(intent.minutes));
          if (intent.kind === 'weekday-unavailable' && selectedDay) w.minutes = 0;
          if (intent.kind === 'hard-weekday' && selectedDay && w.kind === 'hard') { w.kind = 'easy'; w.name = 'Easy ride'; }
          if (intent.kind === 'longest-workout') w.minutes = Math.min(w.minutes, Number(intent.minutes));
          if (intent.kind === 'ftp') { w.power = Number(intent.ftp); w.guidance = `Use your confirmed FTP of ${intent.ftp} W`; }
        }
        if (intent.kind === 'weekly-duration') {
          let used = week.workouts.reduce((sum, w) => sum + w.minutes, 0);
          for (const w of [...week.workouts].reverse()) if (mutableWorkout(w, state) && !w.pinned && used > intent.hours * 60) { const cut = Math.min(w.minutes, used - intent.hours * 60); w.minutes -= cut; used -= cut; }
        }
        week.workouts = week.workouts.filter(w => w.minutes > 0);
      }
      if (intent.kind === 'ftp') after.ftp = Number(intent.ftp);
      if (intent.kind === 'weekly-duration') after.inputs.availability.weeklyHours = Number(intent.hours);
      if (intent.kind === 'longest-workout') after.inputs.availability.longest = Number(intent.minutes);
      if (['weekday-duration', 'weekday-unavailable', 'hard-weekday'].includes(intent.kind)) {
        const kind = { 'weekday-duration': 'duration', 'weekday-unavailable': 'unavailable', 'hard-weekday': 'no-hard' }[intent.kind];
        const rule = { id: `change-${kind}-${intent.day}`, kind, day: Number(intent.day), ...(intent.minutes ? { minutes: Number(intent.minutes) } : {}), source: 'Your confirmed Plan Change' };
        after.inputs.commitments = [...after.inputs.commitments.filter(r => !(r.kind === kind && r.day === rule.day)), rule];
      }
    }
    const diff = previewDiff(before, after);
    const increases = diff.some(d => d.after && (!d.before || d.after.minutes > d.before.minutes || (d.after.power || 0) > (d.before.power || 0)));
    if (['race', 'taper'].includes(state.fixture.guard) && increases) throw new Error(`Only training reductions are allowed during this ${state.fixture.guard === 'race' ? 'race window' : 'taper block'}. Training is unchanged.`);
    const previous = state.change;
    const preview = { id: id(state, 'change'), planId: before.id, revision: before.revision, title: intentNames[intent.kind], intent: copy(intent), before, after, diff, totals: { before: totals(before), after: totals(after) }, status: 'pending', details, sourceRevision: state.fixture.sourceRevision, evidenceRevision: state.fixture.evidenceRevision, confidence: 'Moderate confidence. Based on your confirmed limits and the available training record.', premises: [{ id: 'confirmed-limits', label: 'Confirmed Plan limits', value: copy(before.inputs.availability), source: 'Your confirmed answers' }, { id: 'training-record', label: 'Recent training record', value: { summary: 'Two recent rides and one completed Workout', revision: state.fixture.evidenceRevision }, source: state.fixture.connected ? 'Intervals.icu training record' : 'Your confirmed training answer' }, ...(intent.kind === 'ftp' || before.ftp !== after.ftp ? [{ id: 'ftp-sources', label: 'FTP source comparison at this decision', value: { acceptedPlanFtp: before.ftp, requestedFtp: after.ftp, candidates: copy(state.fixture.ftpSources || []) }, source: 'Saved profile and synchronized FTP evidence' }] : [])], supersedes: previous?.id || null };
    if (previous) { previous.status = 'superseded'; state.changeHistory.push(previous); }
    state.change = preview;
    state.destination = { kind: 'change', id: before.id };
    state.changeError = null;
    state.notice = previous ? `This preview supersedes “${previous.title}”. Training is unchanged until confirmation.` : 'Review the exact changes before confirming.';
  } catch (error) { changeError(state, error.message); }
}
function retirePreview(state, status) {
  if (state.change) { state.change.status = status; state.changeHistory.push(state.change); state.change = null; }
}
function closeActive(state, reason) {
  if (!state.active) return;
  retirePreview(state, 'closed');
  const plan = state.active;
  plan.status = 'closed';
  plan.reason = reason;
  plan.closedAt = today(state);
  plan.mirrorStatus = state.fixture.connected && state.fixture.fail !== 'calendar' ? 'Cleanup complete' : 'Calendar cleanup pending';
  for (const w of workouts(plan)) if (!w.date && !w.pinned && w.status === 'planned') w.status = 'Not chosen';
  state.closed.unshift(plan);
  state.active = null;
  state.destination = { kind: 'closed', id: plan.id };
  state.notice = `Plan closed. ${plan.mirrorStatus}.`;
}
function currentDraft(state) {
  return state.creation?.draft && state.creation.draft.revision === state.creation.revision && !state.creation.pendingCommitment && !nextQuestion(state.creation) && workouts(state.creation.draft).length > 0;
}
function command(state, action) {
  const creation = state.creation;
  switch (action.type) {
    case 'start':
      if (!creation) state.creation = blankCreation(state);
      state.creation.paused = false;
      state.destination = { kind: 'creation', id: state.creation.id };
      state.notice = '';
      break;
    case 'answer':
      if (action.creationId && action.creationId !== creation?.id || action.expectedRevision !== undefined && action.expectedRevision !== creation?.revision) { state.notice = 'This answer changed elsewhere. Continue with the current answers.'; break; }
      answerInto(state, action.key, action.value, action.source);
      break;
    case 'edit':
      if (creation) { creation.editingReturn = { paused: creation.paused, status: creation.status, destination: copy(state.destination) }; creation.editing = action.key; creation.paused = false; creation.error = null; state.destination = { kind: 'creation', id: creation.id }; }
      break;
    case 'back':
      if (creation) { creation.editor = null; creation.error = null; }
      break;
    case 'cancel-edit':
      if (creation) { const prior = creation.editingReturn; creation.editing = null; creation.editor = null; creation.error = null; if (prior) { creation.paused = prior.paused; creation.status = prior.status; state.destination = prior.destination; } creation.editingReturn = null; }
      break;
    case 'later':
      if (creation) creation.paused = true;
      state.destination = { kind: 'chat' };
      break;
    case 'continue':
      if (creation && (!action.id || action.id === creation.id)) { creation.paused = false; state.destination = { kind: 'creation', id: creation.id }; }
      else state.notice = 'This creation is no longer unfinished. Open the Plan library for its current result.';
      break;
    case 'navigate':
      state.destination = copy(action.destination);
      break;
    case 'set-fixture':
      state.fixture[action.key] = copy(action.value);
      break;
    case 'fixture-clock':
      if (civil(action.date)) state.fixture.today = action.date;
      break;
    case 'bump-plan-revision':
      if (state.active) state.active.revision++;
      state.notice = 'The active Plan has a newer confirmed revision. Review a fresh Change.';
      break;
    case 'build-start':
      if (!creation) break;
      creation.editing = null;
      creation.error = null;
      if (nextQuestion(creation)) { creation.error = 'Answer the remaining question before building.'; break; }
      try { const snapshot = buildDraft(creation, state.fixture); creation.build = { completed: 0, weeks: snapshot.weeks.length, output: [], candidate: snapshot, revision: creation.revision }; }
      catch (error) { creation.error = error.message; }
      break;
    case 'build-next':
      if (!creation?.build) break;
      if (['build', 'translation', 'validation', 'interruption'].includes(state.fixture.fail)) { creation.error = `Build ${state.fixture.fail === 'interruption' ? 'interrupted' : 'failed'}. Your answers and last complete Draft are preserved.`; creation.build = null; break; }
      if (creation.build.revision !== creation.revision) { creation.error = 'The answers changed. Start a fresh build.'; creation.build = null; break; }
      if (creation.build.completed < creation.build.weeks) { creation.build.output.push(copy(creation.build.candidate.weeks[creation.build.completed])); creation.build.completed++; }
      break;
    case 'build-finish':
      if (!creation?.build || creation.build.completed !== creation.build.weeks) break;
      if (!workouts(creation.build.candidate).length) { creation.error = 'No Workouts fit anywhere in this Plan under your confirmed limits. Edit those limits to continue.'; creation.build = null; break; }
      creation.draft = creation.build.candidate;
      creation.build = null;
      creation.status = 'review';
      creation.error = null;
      break;
    case 'commitment-edit': {
      if (!creation) break;
      if (action.creationId && action.creationId !== creation.id || action.expectedRevision !== undefined && action.expectedRevision !== creation.revision) { state.notice = 'This commitment targeted older creation details. Continue with the current creation.'; break; }
      const text = String(action.text || '').trim();
      const rule = commitmentRule(text);
      creation.pendingCommitment = { text, rule, status: rule ? 'confirm' : 'clarify', previous: copy(creation.answers.commitments || []) };
      creation.error = rule ? null : 'Give the weekday and exact limit, or the exact time-off dates.';
      break;
    }
    case 'commitment-confirm':
      if (creation?.pendingCommitment?.rule) { const rule = creation.pendingCommitment.rule; answerInto(state, 'commitments', [...(creation.answers.commitments || []).filter(r => r.id !== rule.id), rule]); }
      break;
    case 'commitment-cancel':
      if (creation) { creation.pendingCommitment = null; creation.error = null; }
      break;
    case 'rule-remove':
      if (creation) answerInto(state, 'commitments', (creation.answers.commitments || []).filter(rule => rule.id !== action.id));
      break;
    case 'open-discard':
      if (creation) state.dialog = { kind: 'discard', creationId: creation.id, returnTarget: copy(state.destination) };
      break;
    case 'cancel-dialog':
      if (state.dialog) state.destination = state.dialog.returnTarget || { kind: 'chat' };
      state.dialog = null;
      break;
    case 'confirm-discard':
      if (state.dialog?.kind === 'discard' && creation?.id === state.dialog.creationId) { state.creation = null; state.dialog = null; state.destination = { kind: 'chat' }; state.notice = 'Plan creation discarded'; }
      break;
    case 'open-activate':
      if (!currentDraft(state)) { if (creation) creation.error = 'Build a current complete Draft and resolve pending answers before activation.'; break; }
      state.dialog = { kind: 'activate', creationId: creation.id, revision: creation.revision, activeId: state.active?.id || null, activeRevision: state.active?.revision || null, returnTarget: copy(state.destination) };
      break;
    case 'confirm-activate': {
      const dialog = state.dialog;
      if (dialog?.kind !== 'activate') { state.notice = 'No activation is waiting for confirmation. The current Plan is unchanged.'; break; }
      if (!currentDraft(state) || dialog.creationId !== creation.id || dialog.revision !== creation.revision || dialog.activeId !== (state.active?.id || null) || dialog.activeRevision !== (state.active?.revision || null)) { state.notice = 'The Plan or creation changed. Review the current Draft before confirming again.'; break; }
      if (['local', 'validation'].includes(state.fixture.fail)) { creation.error = 'Activation could not be saved locally. Your previous Plan is unchanged.'; break; }
      const previous = state.active;
      const todayWorkouts = previous ? workouts(previous).filter(w => w.date === today(state) && w.mirrored) : [];
      if (previous) { for (const w of todayWorkouts) w.mirrored = true; closeActive(state, 'Closed to start a new Plan'); }
      const plan = { ...copy(creation.draft), id: id(state, 'plan'), revision: 1, status: 'active', activated: today(state), mirrorStart: todayWorkouts.length ? addDays(today(state), 1) : today(state), mirrorEnd: addDays(today(state), 6), mirrorStatus: !state.fixture.connected ? 'Connect to mirror Workouts' : state.fixture.fail === 'calendar' ? 'Calendar sync failed. Retry available.' : 'Up to date' };
      state.active = plan;
      state.creation = null;
      state.dialog = null;
      state.destination = { kind: 'library' };
      state.notice = `Plan activated locally. ${plan.mirrorStatus}.${todayWorkouts.length ? ' Today’s old Workout stays; the new mirror starts tomorrow.' : ''}`;
      break;
    }
    case 'retry-calendar':
      if (state.fixture.fail === 'calendar' || !state.fixture.connected) { state.notice = 'Calendar work is still unavailable. Local Plan state is unchanged.'; break; }
      if (state.active) state.active.mirrorStatus = 'Up to date';
      for (const plan of state.closed) if (plan.mirrorStatus === 'Calendar cleanup pending') plan.mirrorStatus = 'Cleanup complete';
      state.notice = 'Calendar work completed. Local Plan history is unchanged.';
      break;
    case 'request-change':
      if (action.expectedRevision !== undefined && action.expectedRevision !== state.active?.revision) { changeError(state, 'This request used an older Plan revision. Request a fresh preview.'); break; }
      if (action.expectedSerial !== undefined && action.expectedSerial !== state.serial) { changeError(state, 'A newer result already exists. This older preview result was ignored.'); break; }
      makePreview(state, action.intent);
      break;
    case 'apply-change': {
      const preview = state.change;
      if (!preview || preview.id !== action.id || preview.status !== 'pending') { changeError(state, 'This preview is no longer pending. Training is unchanged.'); break; }
      if (!state.active || preview.planId !== state.active.id || preview.revision !== state.active.revision || preview.sourceRevision !== state.fixture.sourceRevision || preview.evidenceRevision !== state.fixture.evidenceRevision || state.fixture.evidenceMissing || state.fixture.syncStale || state.fixture.guard === 'stale-sync') { changeError(state, 'This preview is stale because the Plan or its sources changed. Request a fresh preview; no training changed.'); break; }
      if (state.fixture.fail === 'local' || state.fixture.fail === 'validation') { changeError(state, 'This Change could not be applied. Training and the pending preview are unchanged.'); break; }
      if (preview.intent.kind === 'choose-workout') { if (workouts(preview.after).find(w => w.id === preview.intent.workoutId)?.date !== today(state)) { changeError(state, 'The day changed while this choice was open. Request a fresh choice for today; no date was assigned.'); break; } const eligible = eligibleWorkouts(state).find(entry => entry.workout.id === preview.intent.workoutId); if (!eligible?.eligible) { changeError(state, eligible?.reason || 'This Workout is no longer eligible.'); break; } }
      const ftpPremise = preview.premises.find(premise => premise.id === 'ftp-sources');
      if (ftpPremise && !same(ftpPremise.value.candidates, state.fixture.ftpSources || [])) { changeError(state, 'The FTP sources changed. Request a fresh preview before applying this correction.'); break; }
      const increasing = preview.diff.some(d => d.after && (!d.before || d.after.minutes > d.before.minutes || (d.after.power || 0) > (d.before.power || 0)));
      if (['race', 'taper'].includes(state.fixture.guard) && increasing) { changeError(state, 'Only training reductions are allowed in the current race or taper window. This Change was not applied.'); break; }
      state.lastApplied = { planId: state.active.id, before: copy(state.active), afterRevision: state.active.revision + 1, previewId: preview.id };
      state.active = { ...copy(preview.after), revision: state.active.revision + 1, mirrorStatus: state.fixture.fail === 'calendar' ? 'Calendar sync failed. Retry available.' : state.active.mirrorStatus };
      retirePreview(state, 'applied');
      state.changeError = null;
      state.notice = 'Change applied locally. Training now matches the confirmed preview.';
      break;
    }
    case 'cancel-change':
      if (state.change?.id !== action.id) { state.notice = 'This preview is already retired. Training is unchanged.'; break; }
      retirePreview(state, 'cancelled');
      state.changeError = null;
      state.notice = 'Change cancelled. Training is unchanged; the preview remains in history.';
      break;
    case 'undo':
      makePreview(state, { kind: 'inverse' });
      break;
    case 'close-plan':
      if (state.active) state.dialog = { kind: 'close', planId: state.active.id, revision: state.active.revision, returnTarget: copy(state.destination) };
      break;
    case 'confirm-close':
      if (state.dialog?.kind === 'close' && state.dialog.planId === state.active?.id && state.dialog.revision === state.active?.revision) { closeActive(state, 'Stopped'); state.dialog = null; }
      else state.notice = 'The Plan changed. Review its current details before stopping.';
      break;
    case 'complete-plan':
      if (state.active && today(state) >= state.active.end) closeActive(state, 'Completed');
      else state.notice = 'The Plan has not reached its actual end. It remains active.';
      break;
    case 'close-week':
      if (state.active) for (const week of state.active.weeks) if (week.end < today(state)) for (const w of week.workouts) if (!w.date && !w.pinned && w.status === 'planned') w.status = 'Not chosen';
      state.notice = 'Ended weeks retain unchosen Workouts as Not chosen, with no assigned date.';
      break;
    case 'recover': {
      const source = state.legacy.find(item => item.id === action.id);
      if (!source) { state.notice = 'Choose a preserved source.'; break; }
      state.recovery = { source: copy(source), status: 'review' };
      state.destination = { kind: 'recovery', id: source.id };
      break;
    }
    case 'confirm-recovery': {
      const source = state.recovery?.source;
      if (!source) break;
      if (state.fixture.fail) { state.notice = 'Recovery could not continue. The original source and current Plan remain intact.'; break; }
      if (source.kind === 'creation' && creation) { state.notice = 'Finish or explicitly discard your open creation before continuing these earlier details. Both sources remain intact.'; break; }
      if (source.kind === 'change') makePreview(state, source.intent);
      else { state.creation = blankCreation(state); state.creation.answers = copy(source.answers); state.creation.uncertain = copy(source.uncertain || []); state.creation.sources = Object.fromEntries(Object.keys(source.answers).map(key => [key, 'Recovered answer, confirm before activation'])); state.destination = { kind: 'creation', id: state.creation.id }; state.notice = 'Recovered details need fresh confirmation and a fresh Draft. The original remains readable.'; }
      if (state.recovery) state.recovery.status = 'continued';
      break;
    }
    case 'recover-confirm-detail':
      answerInto(state, action.key, action.value, 'Recovered detail confirmed by you');
      break;
    case 'cancel-recovery':
      state.recovery = null;
      state.destination = { kind: 'library' };
      state.notice = 'Recovery cancelled. The original source remains readable.';
      break;
    case 'notice':
      state.notice = action.text;
      break;
    case 'chat-message':
      if (String(action.text || '').trim()) state.messages.push({ role: 'you', text: String(action.text).trim() });
      break;
  }
}
export function transition(previous, action) {
  const state = copy(previous);
  if (action.commandId && state.outcomes[action.commandId]) {
    const prior = state.outcomes[action.commandId];
    state.notice = prior.input === JSON.stringify(action) ? `This command was already handled. ${prior.notice}` : 'This command identifier was already used for different input. No state changed.';
    return state;
  }
  command(state, action);
  if (action.commandId) state.outcomes[action.commandId] = { input: JSON.stringify(action), notice: state.notice };
  return state;
}
