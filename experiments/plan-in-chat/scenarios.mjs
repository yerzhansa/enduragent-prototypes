import { createState, answer, transition, sampleAnswers, TODAY, addDays } from './model.mjs';

const variants = (values) => values.map(([id, label]) => ({ id, label }));
const entry = (id, name, group, refs, purpose, steps, choices = []) => ({
  id, name, group, acceptance: refs.split(' ').filter(Boolean), purpose, steps,
  ...(choices.length ? { variations: variants(choices) } : {}),
});

export const scenarios = [
  entry('creation-start', 'Start Plan creation', 'Creation', 'A03 A23', 'Start a connected creation while an active Plan and closed history remain intact.', ['Choose a goal, then confirm only the missing answers.', 'Use Later, ordinary Chat, Plan, and Continue before returning to review.']),
  entry('goal-answered', 'Answer recorded', 'Creation', 'A03', 'A confirmed goal is a quiet summary with Edit and the next question.', ['Edit the goal and use Back.', 'Confirm the next answer and inspect its source.']),
  entry('custom-answer', 'Own answer', 'Creation', 'A02', 'A manual Event requires its name and exact date in the supported editor.', ['Submit empty fields to inspect adjacent validation.', 'Enter a name and date, confirm, then inspect the authored source.', 'Open Edit, then Back or Escape.']),
  entry('length-question', 'Fitness Plan length', 'Creation', 'A05', 'Choose only an approved Fitness length.', ['Select 4, 8, 12, or 16 weeks.', 'Complete the questions and inspect every generated week.']),
  entry('edit-answer', 'Edit an earlier answer', 'Creation', 'A14 A16', 'Confirming a changed answer preserves the immutable Draft and marks it stale.', ['Edit restriction, then use Back or Escape.', 'Confirm a different restriction and inspect the old Draft.', 'Rebuild before attempting activation.']),
  entry('schedule-summary', 'Schedule summary', 'Creation', 'A03 A12', 'Inspect the usual week and the sources of recent training and saved limits.', ['Open Change one thing while the summary remains visible.', 'Confirm a weekly limit, then choose My week varies.', 'Inspect the derived pool count.']),
  entry('success-question', 'Define success', 'Creation', 'A01', 'Success is explicitly confirmed after baseline and before restriction.', ['Choose an Event success or each Fitness success alternative.', 'For Something else, enter and confirm an authored outcome.'], [['event','Event success'],['fitness','Fitness success']]),
  entry('restrictions-question', 'Training restrictions', 'Creation', 'A01 A13', 'An unanswered restriction blocks review while all earlier answers remain available.', ['Attempt Build with the missing restriction.', 'Confirm an operational status and build.', 'Inspect Workouts through and after its end date.']),
  entry('resume', 'Resume Plan creation', 'Creation', 'A09 A23', 'A paused creation retains its exact question and answers.', ['Use ordinary Chat, then Continue.', 'Use Later and reload the browser.', 'Open Plan and Continue the same creation.']),
  entry('discard-confirm', 'Discard creation', 'Creation', 'A23', 'The accepted modal preserves active training and closed history.', ['Verify initial Keep creating focus.', 'Press Escape, then reopen the modal.', 'Discard and verify consequence before Start a Plan and returned focus.']),
  entry('discarded', 'Creation discarded', 'Creation', 'A23', 'The creation has ended without making a Plan.', ['Read the consequence, then Start a Plan.', 'Open Plan and inspect unchanged active and closed Plans.']),
  entry('building', 'Building the Draft', 'Review', 'A15 A16', 'Explicit fixture checkpoints reveal only completed weeks.', ['Inspect the first completed week.', 'Navigate away and reload before returning.', 'Advance the studio checkpoints and finish the Draft.']),
  entry('draft-review', 'Draft review', 'Review', 'A16', 'Every week and Workout is available before activation.', ['Read every listed training week and inspect its Workouts.', 'Inspect the displayed sources and open How this Plan was built.', 'Confirm a changed answer, then inspect the original stale Draft.'], [['fixed','Fixed dates'],['flexible','Flexible pools']]),
  entry('stale-draft', 'Stale Draft', 'Review', 'A14', 'Changed answers do not rewrite the last complete Draft.', ['Compare original Draft facts with the edited answer.', 'Attempt activation, then rebuild.', 'Inspect the new complete Draft only after successful finish.']),
  entry('activate-confirm', 'Close and activate', 'Activation', 'A18 A22', 'The confirmation reviews the current Draft and exact closure consequence.', ['Cancel and confirm the existing active Plan remains unchanged.', 'Reopen and confirm Close current Plan and activate new Plan.', 'Inspect the old Workout today and new calendar ownership tomorrow.']),
  entry('activated', 'Plan activated', 'Activation', 'A18 A22', 'The new Plan is active and the old Plan is readable in closed history.', ['Inspect the preserved old Workout today.', 'Open Plan and read both final and active facts.', 'Start a new creation without replacing the active Plan.']),
  entry('plan-change', 'Plan Change preview', 'Changes', 'A29 A30 A32 A33 A44', 'A pending weekday cap shows an exact diff without changing training.', ['Read the listed affected Workouts and totals.', 'Navigate to Plan and reload, then return to the same pending preview.', 'Apply, request Undo, inspect its inverse, and confirm or cancel.']),
  entry('plan-change-stale', 'Stale Plan Change', 'Changes', 'A31', 'A preview for an older Plan revision cannot apply.', ['Attempt Apply and inspect the refusal.', 'Prepare a fresh preview, inspect the updated diff, then confirm.']),
  entry('plan-library', 'Plan page library', 'Library', 'A23', 'Each combination shows truthful creation, active Plan, and history sections.', ['Use Start, Continue, Change, and closed details when present.', 'Return to Chat and verify the exact target and preserved other work.'], [['mixed','Creation, active and history'],['empty','Empty'],['creation','Creation only'],['active','Active only'],['history','History only'],['creation-active','Creation and active Plan'],['creation-history','Creation and history'],['active-history','Active and history']]),
  entry('manual-event', 'Disconnected Event creation', 'Creation', 'A02 A06', 'Create a local Event Draft from confirmed manual answers.', ['Enter the event name and exact date.', 'Choose Fixed or Flexible and supply only missing crucial answers.', 'Build and review the local Draft without FTP or invented history.']),
  entry('manual-fitness', 'Disconnected Fitness creation', 'Creation', 'A02 A05 A06', 'Create a local Fitness Draft with a broad baseline answer.', ['Choose a Fitness outcome and length.', 'Confirm the schedule, start, baseline, success and restriction.', 'Review effort guidance without an FTP test.']),
  entry('connected-conflict', 'Conflicting connected facts', 'Creation', 'A03', 'Saved and synchronized sources remain visible; the confirmed correction wins.', ['Open Already taken into account and the source details.', 'Correct the weekly limit and inspect the confirmed source.', 'Build and verify the corrected limit.']),
  entry('event-boundaries', 'Event length boundaries', 'Review', 'A04 A16', 'Computed inclusive weeks determine the block while retaining the exact Event date.', ['Choose each boundary in the studio.', 'Inspect the goal date, block description, actual start and end.', 'Inspect all weeks, including the end of the 12-week base Plan.'], [['4','4 weeks: short block'],['5','5 weeks: Event Plan'],['24','24 weeks: Event Plan'],['25','25 weeks: 12-week base']]),
  entry('fitness-lengths', 'Every accepted Fitness length', 'Review', 'A05 A16', 'Each accepted Fitness length has a complete reviewable Draft without an Event Goal.', ['Choose each length in the studio.', 'Inspect every week and Workout, then edit answers or activate.'], [['4','4 weeks'],['8','8 weeks'],['12','12 weeks'],['16','16 weeks']]),
  entry('no-ftp', 'No credible FTP', 'Review', 'A06', 'The Draft uses perceived effort or heart rate without inserting an FTP test.', ['Inspect Already taken into account and source details.', 'Read every listed Workout and inspect its guidance.']),
  entry('fixed-conflict', 'Fixed schedule conflicts', 'Review', 'A07', 'Confirmed unavailable days and duration limits govern every dated Workout.', ['Inspect weekday rules and the complete dated Draft.', 'Open How this Plan was built for removed or shortened Workouts.', 'Edit, replace and remove a rule, then rebuild.']),
  entry('commitments', 'Confirm written commitments', 'Schedule', 'A08', 'Bounded example text becomes explicit recurring and dated limits for confirmation.', ['Submit the studio-listed supported commitment example.', 'Inspect exact dates and recurring limits before confirming.', 'Edit or remove the confirmed rule and inspect the rebuilt Draft.']),
  entry('commitment-pending', 'Ambiguous commitment correction', 'Schedule', 'A09', 'An unresolved correction preserves effective confirmed limits and blocks building.', ['Navigate away and reload, then return to the pending correction.', 'Attempt Build or activation.', 'Cancel to restore the confirmed answer, or clarify and confirm.']),
  entry('no-workouts', 'No Workouts fit', 'Review', 'A10', 'The entire Plan is blocked, while the previous complete Draft and active Plan survive.', ['Read which confirmed constraint prevents all Workouts.', 'Inspect preserved Draft and answers; attempt activation.', 'Edit the restriction or return Later and Continue.']),
  entry('rest-week', 'An empty training week', 'Review', 'A11 A16', 'One empty week is permitted when the Plan contains other Workouts.', ['Inspect the empty week and the surrounding weeks.', 'Review and activate after checking all other requirements.']),
  entry('flexible-pool', 'Flexible pool limits', 'Schedule', 'A12', 'Ordered undated pools follow the confirmed weekly limit and preserve dated pins.', ['Inspect each threshold in the studio.', 'Correct the pool count to 3, 4, or 5 without leaving Flexible.', 'Reject an out-of-range count, rebuild, and inspect all weeks.'], [['6','6 hours: 3 Workouts'],['8','8 hours: 4 Workouts'],['9','9 hours: 5 Workouts']]),
  entry('operational-restrictions', 'Operational restrictions', 'Schedule', 'A13', 'Only operational limits and optional end dates shape the Draft.', ['Choose each supported restriction.', 'Inspect every Workout before, on, and after the end date.', 'Edit the restriction through its typed form.'], [['none','No restriction'],['no-training','No training through 28 August'],['no-hard-training','No hard training through 28 August'],['max-duration','30 minutes through 28 August']]),
  entry('rebuild-failures', 'Failed rebuild preserves Draft', 'Review', 'A14', 'A failed rebuild keeps the last complete snapshot ineligible under changed answers.', ['Inspect original Draft facts and edited answers.', 'Advance the build using the selected failure.', 'Return or reload, then retry with a successful fixture outcome.'], [['build','Build failure'],['translation','Translation failure'],['validation','Validation failure'],['interruption','Interrupted rebuild']]),
  entry('first-activation', 'First activation', 'Activation', 'A17', 'The current local Draft can become the first active Plan.', ['Open activation confirmation and cancel once.', 'Confirm activation and inspect the new active Plan.', 'Open Plan and continue ordinary Chat.']),
  entry('activation-conflicts', 'Activation conflict and replay', 'Activation', 'A19', 'Stored-result and stale concurrent-result notices preserve one visible active Plan.', ['Confirm the Draft.', 'Use the studio replay or competing-result control.', 'Inspect the unchanged Plan identity and Workout count.'], [['retry','Identical result retry'],['stale','Concurrent stale result']]),
  entry('activation-failure', 'Local activation failure', 'Activation', 'A20', 'A failed local activation leaves the existing active Plan and Draft intact.', ['Confirm close and activate with the local-failure fixture.', 'Inspect the failure and unchanged current Plan.', 'Select a successful fixture outcome, then retry confirmation.']),
  entry('calendar-failure', 'Calendar failure after activation', 'Activation', 'A21', 'Calendar failure is separate from successful local activation.', ['Confirm activation.', 'Inspect the active Plan and failed calendar status.', 'Retry calendar work, navigate and reload.']),
  entry('stop-offline', 'Stop a Plan offline', 'Closure', 'A24', 'Explicit closure succeeds locally while calendar cleanup waits.', ['Open Stop Plan, cancel, then confirm.', 'Read the stopped reason and final facts.', 'Retry cleanup and verify the Plan stays closed.']),
  entry('completion', 'Actual Plan completion', 'Closure', 'A25', 'The actual Plan end permits a completed history record.', ['Inspect the actual Plan end.', 'Advance the fixture date to the end and project completion.', 'Read final history and preserved Workouts.']),
  entry('base-ending', 'Base Plan ends before its Event', 'Closure', 'A26', 'The 12-week base ends while its future Event Goal remains visible.', ['Inspect actual Plan dates and the later exact Event date.', 'Advance to the actual end and read completed history.', 'Inspect the invitation for later Event-specific preparation.']),
  entry('unknown-ending', 'Unknown legacy ending', 'Closure', 'A27', 'Closed legacy details remain readable without an invented completion reason.', ['Open closed details from Plan.', 'Inspect the unknown reason and preserved final Workout facts.', 'Return to the library.']),
  entry('flexible-week-end', 'Close unchosen Flexible Workouts', 'Closure', 'A28', 'Expired unchosen Workouts become Not chosen without dates or rollover.', ['Inspect current undated and pinned Workouts.', 'Advance the fixture beyond the week and repeat after reload.', 'Verify Not chosen remains undated and pinned dates stay fixed.']),
  entry('schedule-changes', 'Five scheduling Change intents', 'Changes', 'A29 A30 A32', 'Each supported scheduling intent previews exact future changes and totals.', ['Choose an intent and compare its supported text example with its card.', 'Inspect individual before/after dates and durations, week and Plan totals.', 'Cancel or confirm, preserving past/completed Workouts and open creation.'], [['weekday-cap','Weekday duration cap'],['weekday-unavailable','Weekday unavailable'],['weekday-hard-block','Hard Workout blocked on a weekday'],['weekly-cap','Weekly duration cap'],['longest-cap','Longest-Workout cap']]),
  entry('preview-cancelled', 'Explicit cancellation and retry', 'Changes', 'A42 A43', 'Cancelled previews remain retired and readable without training changes.', ['Read the cancelled history and preserved Plan revision.', 'Reload and retry the completed result in the studio.', 'Attempt the retired preview apply, then prepare a fresh request.']),
  entry('preview-supersession', 'A different Change request', 'Changes', 'A45', 'A valid FTP request replaces the pending duration request without applying training.', ['Inspect the pending duration diff.', 'Submit the FTP request and inspect the named earlier request.', 'Read superseded history; confirm only the current preview.']),
  entry('preview-failure', 'A new preview fails', 'Changes', 'A46', 'A failed new request preserves the existing pending preview and current Plan.', ['Inspect the pending duration request.', 'Submit a different request using the selected failed outcome.', 'Verify the earlier preview remains available, then cancel or apply it.'], [['translation','Translation failure'],['validation','Validation failure'],['build','Build failure']]),
  entry('preview-competing', 'Competing preview outcomes', 'Changes', 'A47', 'Deterministic out-of-order result fixtures preserve current preview identity.', ['Inspect the current preview.', 'Use the studio competing-result fixture after apply, cancellation, or closure.', 'Verify retired previews do not return and committed effects do not repeat.']),
  entry('daily-choice', 'Choose a Flexible Workout today', 'Changes', 'A34 A35', 'One eligible recommendation and explained blocked alternatives precede confirmation.', ['Inspect every alternative and its eligibility reason.', 'Select an eligible Workout, navigate away and reload before confirming.', 'Return, confirm, and verify only its original identity gains today\'s date.']),
  entry('supporting-events', 'Supporting Event operations', 'Changes', 'A36 A37 A38 A39 A40', 'Accepted event facts and training remain unchanged until the exact preview is confirmed.', ['Choose an operation and inspect event and Workout differences.', 'Cancel once, then prepare and confirm the current preview.', 'For source drift, change the fixture source during review and require a fresh preview.'], [['add','Add Event'],['remove','Remove Plan role'],['role','Training to Important'],['manual','Correct manual date'],['source-update','Accept synchronized update'],['name','Manual name only'],['source-drift','Source changes during review']]),
  entry('ftp-correction', 'Future power correction', 'Changes', 'A41', 'FTP correction changes applicable future power while preserving dates and durations.', ['Inspect FTP sources and the future prescription diff.', 'Verify past, completed and unrelated guidance is unchanged.', 'Confirm, then request and review the inverse.']),
  entry('adaptation-guards', 'Adaptation safeguards', 'Changes', 'A29 A31 A33 A32', 'Race, taper, stale sync and evidence checks apply to active Plan Changes.', ['Try an increase and a permitted reduction for the selected guard.', 'Inspect the refusal or source-linked preview and plain-language confidence.', 'Change the fixture source, reload history, and inspect captured values.', 'Revalidate after fresh sync or before inverse apply.'], [['race','Seven-day race window'],['taper','Whole taper block'],['stale-sync','Sync older than 24 hours'],['missing-evidence','Missing citation source'],['changed-evidence','Evidence changed after preview']]),
  entry('assisted-recovery', 'Recover unfinished details', 'Recovery', 'A50 A53', 'Choose a preserved source and confirm uncertain answers before a fresh Draft.', ['Read both source records and choose one.', 'Confirm uncertain details, complete missing answers and build a fresh Draft.', 'Cancel or fail the recovery and inspect the preserved original.']),
  entry('recovery-conflict', 'Recovery with an open creation', 'Recovery', 'A51', 'Recovery preserves a different unfinished creation and its original source.', ['Choose an old creation to continue.', 'Inspect the conflict and continue the existing creation.', 'Explicitly discard or finish it before recovering the other details.']),
  entry('recovery-change', 'Recover a Change alongside creation', 'Recovery', 'A52 A53', 'A recovered request requires a fresh active Plan preview and consent.', ['Choose the old unapplied Change while a creation remains open.', 'Inspect the fresh current-Plan diff, then cancel or fail it.', 'Verify old consent was not applied and both sources remain readable.']),
  entry('recovery-notices', 'Upgrade and restore outcomes', 'Recovery', 'A48 A49', 'Readable notices and library facts demonstrate recovery outcomes only.', ['Read the selected recovery notice.', 'Open the preserved active Plan and closed history.', 'Choose Continue with these details for recoverable unfinished work.'], [['interrupted','Interrupted upgrade'],['source-drift','Changed upgrade source'],['restored','Restored library']]),
];

const productionLimits = {
  '4': 'Fictional dates, limits and visible Drafts do not prove real sport prescription, builder output or persisted production acceptance.',
  '4 and 5': 'Fixture outcomes do not prove production builder validation, immutable persistence or activation transaction guards.',
  '5': 'Fixture state does not prove atomic activation, durable replay, concurrency, provider transactions or reconciliation.',
  '6': 'Fixture navigation does not prove production host routing or persisted library projections.',
  '7': 'Fixture clock and closure do not prove production host authority, durable cleanup or repeat reconciliation.',
  '7 and 9': 'Readable fictional legacy history does not prove migrated source provenance or store conversion.',
  '8': 'Fixture diffs and stored-result examples do not prove production translation, sport validation, atomic writes, durable replay or provider effects.',
  '9': 'Recovery notices do not prove migration checkpoints, source fingerprints, supported store/archive families, backup restoration or durable command replay.',
};

const acceptanceRows = [{"id":"A01","name":"Crucial answer missing","slice":"4"},{"id":"A02","name":"No connected data","slice":"4"},{"id":"A03","name":"Connected facts","slice":"4"},{"id":"A04","name":"Event length boundaries","slice":"4"},{"id":"A05","name":"Fitness lengths","slice":"4"},{"id":"A06","name":"No credible FTP","slice":"4"},{"id":"A07","name":"Fixed schedule conflict","slice":"4"},{"id":"A08","name":"Written commitments","slice":"4"},{"id":"A09","name":"Ambiguous commitment edit","slice":"4 and 5"},{"id":"A10","name":"No Workouts fit","slice":"4 and 5"},{"id":"A11","name":"Rest week","slice":"4 and 5"},{"id":"A12","name":"Flexible pool","slice":"4"},{"id":"A13","name":"Training restriction","slice":"4"},{"id":"A14","name":"Rebuild failure","slice":"4"},{"id":"A15","name":"Build interrupted","slice":"4"},{"id":"A16","name":"Review completeness","slice":"4"},{"id":"A17","name":"First activation","slice":"5"},{"id":"A18","name":"Existing active Plan","slice":"5"},{"id":"A19","name":"Activation races","slice":"5"},{"id":"A20","name":"Activation failure","slice":"5"},{"id":"A21","name":"Calendar failure","slice":"5"},{"id":"A22","name":"Current-day ownership","slice":"5"},{"id":"A23","name":"Library combinations","slice":"6"},{"id":"A24","name":"Stop offline","slice":"7"},{"id":"A25","name":"System completion","slice":"7"},{"id":"A26","name":"Base Plan ending","slice":"7"},{"id":"A27","name":"Unknown legacy ending","slice":"7 and 9"},{"id":"A28","name":"Flexible week ends","slice":"7"},{"id":"A29","name":"Change preview","slice":"8"},{"id":"A30","name":"Text and card equivalence","slice":"8"},{"id":"A31","name":"Stale change","slice":"8"},{"id":"A32","name":"Protected Workouts","slice":"8"},{"id":"A33","name":"Undo","slice":"8"},{"id":"A34","name":"Flexible daily choice","slice":"8"},{"id":"A35","name":"Interrupted daily choice","slice":"8"},{"id":"A36","name":"Supporting Event preview","slice":"8"},{"id":"A37","name":"Supporting Event operations","slice":"8"},{"id":"A38","name":"Updated synchronized event","slice":"8"},{"id":"A39","name":"Event source changes during review","slice":"8"},{"id":"A40","name":"Event metadata only","slice":"8"},{"id":"A41","name":"FTP correction","slice":"8"},{"id":"A42","name":"Explicit preview cancellation","slice":"8"},{"id":"A43","name":"Retry after cancellation","slice":"8"},{"id":"A44","name":"Navigate from preview","slice":"8"},{"id":"A45","name":"A different change request","slice":"8"},{"id":"A46","name":"New preview fails","slice":"8"},{"id":"A47","name":"Competing preview commands","slice":"8"},{"id":"A48","name":"Upgrade interrupted","slice":"9"},{"id":"A49","name":"Backup and restore","slice":"9"},{"id":"A50","name":"Assisted recovery","slice":"9"},{"id":"A51","name":"Recovery with open creation","slice":"9"},{"id":"A52","name":"Recovered change with open creation","slice":"9"},{"id":"A53","name":"Old unapplied change","slice":"9"}];
export const acceptance = acceptanceRows.map((item) => ({
  ...item, scenarioIds: scenarios.filter((scenario) => scenario.acceptance.includes(item.id)).map((scenario) => scenario.id),
  backendLimit: productionLimits[item.slice],
}));

const step = (state, type, data = {}) => transition(state, { type, ...data });
const started = (options = {}) => step(createState(options), 'start');
const fill = (state, values, stopBefore) => {
  for (const [key, value] of Object.entries(values)) {
    if (key === stopBefore) break;
    state = answer(state, key, value);
  }
  return state;
};
const finish = (state) => {
  state = step(state, 'build-start');
  for (let index = 0; index < 25 && state.creation?.build && state.creation.build.completed < state.creation.build.weeks; index += 1) {
    state = step(state, 'build-next');
  }
  return step(state, 'build-finish');
};
const review = (options = {}, values = {}) => finish(fill(started(options), { ...sampleAnswers(), ...values }));
const activeCreation = (fixture = {}) => {
  let state = started({ active: true, history: true, fixture });
  state = answer(state, 'goal', sampleAnswers().goal);
  return step(state, 'later');
};
const changeIntent = (variant = 'weekday-cap') => ({
  'weekday-cap': { kind: 'weekday-duration', day: 3, minutes: 30 },
  'weekday-unavailable': { kind: 'weekday-unavailable', day: 3 },
  'weekday-hard-block': { kind: 'hard-weekday', day: 1 },
  'weekly-cap': { kind: 'weekly-duration', hours: 3 },
  'longest-cap': { kind: 'longest-workout', minutes: 60 },
})[variant];
const preview = (state, intent = changeIntent()) => step(state, 'request-change', { intent });

export function seed(id = 'creation-start', variationId) {
  const scenario = scenarios.find((item) => item.id === id) || scenarios[0];
  const variant = variationId || scenario.variations?.[0]?.id;
  const event = sampleAnswers({ kind: 'event' });
  event.goal = { ...event.goal, id: 'hills', source: 'Intervals.icu event' };
  const fitness = sampleAnswers({ kind: 'fitness', length: Number(variant) || 4 });
  const mixed = { active: true, history: true };
  let state;
  switch (scenario.id) {
    case 'creation-start': return started(mixed);
    case 'goal-answered': return answer(started(mixed), 'goal', event.goal);
    case 'custom-answer': return step(started({ connected: false }), 'edit', { key: 'goal' });
    case 'length-question': return answer(started({ connected: false }), 'goal', fitness.goal);
    case 'edit-answer': return step(review(mixed), 'edit', { key: 'restriction' });
    case 'schedule-summary': return fill(started(mixed), event, 'availability');
    case 'success-question': return fill(started({ connected: false }), variant === 'fitness' ? fitness : event, 'success');
    case 'restrictions-question': return fill(started(mixed), event, 'restriction');
    case 'resume': return step(fill(started(mixed), event, 'success'), 'later');
    case 'discard-confirm': return step(fill(started(mixed), event, 'success'), 'open-discard');
    case 'discarded': return step(step(fill(started(mixed), event, 'success'), 'open-discard'), 'confirm-discard');
    case 'building': return step(step(fill(started(mixed), event), 'build-start'), 'build-next');
    case 'draft-review': return review(mixed, sampleAnswers({ mode: variant }));
    case 'stale-draft': return answer(review(mixed), 'restriction', { kind: 'max-duration', minutes: 30, end: addDays(TODAY, 4) });
    case 'activate-confirm': return step(review(mixed), 'open-activate');
    case 'activated': return step(step(review(mixed), 'open-activate'), 'confirm-activate');
    case 'plan-change': return preview(activeCreation());
    case 'plan-change-stale': return step(preview(activeCreation()), 'bump-plan-revision');
    case 'plan-library': {
      const choice = variant || 'mixed';
      state = createState({ active: ['active','creation-active','active-history','mixed'].includes(choice), history: ['history','creation-history','active-history','mixed'].includes(choice) });
      if (['creation','creation-active','creation-history','mixed'].includes(choice)) state = fill(step(state, 'start'), event, 'success');
      return step(state, 'navigate', { destination: { kind: 'library' } });
    }
    case 'manual-event': return started({ connected: false });
    case 'manual-fitness': return answer(started({ connected: false }), 'goal', fitness.goal);
    case 'connected-conflict': return fill(started({ ...mixed, fixture: { conflictingEvidence: true } }), event, 'availability');
    case 'event-boundaries': return review(mixed, sampleAnswers({ kind: 'event', eventDate: addDays(TODAY, Number(variant) * 7 - 1) }));
    case 'fitness-lengths': return review({ connected: false }, sampleAnswers({ kind: 'fitness', length: Number(variant) }));
    case 'no-ftp': return review({ connected: false }, sampleAnswers({ kind: 'fitness' }));
    case 'fixed-conflict': {
      const fixed = sampleAnswers({ mode: 'fixed' });
      fixed.availability = { ...fixed.availability, days: [2], weeklyHours: 1, longest: 30, weekdayMinutes: 30 };
      return review(mixed, fixed);
    }
    case 'commitments': {
      state = fill(started(mixed), event, 'commitments');
      state.creation.requireCommitments = true;
      return state;
    }
    case 'commitment-pending': return step(review(mixed), 'commitment-edit', { text: 'I may be away some days next month.' });
    case 'no-workouts': {
      state = answer(review(mixed), 'restriction', { kind: 'no-training' });
      return finish(state);
    }
    case 'rest-week': return review({ ...mixed, fixture: { restWeek: 2 } });
    case 'flexible-pool': return review(mixed, sampleAnswers({ mode: 'flexible', weeklyHours: Number(variant) }));
    case 'operational-restrictions': return review(mixed, { restriction: variant === 'none' ? { kind: 'none' } : { kind: variant, ...(variant === 'max-duration' ? { minutes: 30 } : {}), end: addDays(TODAY, 4) } });
    case 'rebuild-failures': {
      state = answer(review(mixed), 'restriction', { kind: 'max-duration', minutes: 30 });
      return step(state, 'set-fixture', { key: 'fail', value: variant });
    }
    case 'first-activation': return review({ connected: false });
    case 'activation-conflicts': return step(review({ ...mixed, fixture: { activationResult: variant } }), 'open-activate');
    case 'activation-failure': return step(review({ ...mixed, fixture: { fail: 'local' } }), 'open-activate');
    case 'calendar-failure': return step(review({ ...mixed, fixture: { fail: 'calendar' } }), 'open-activate');
    case 'stop-offline': return step(activeCreation({ fail: 'calendar' }), 'navigate', { destination: { kind: 'library' } });
    case 'completion': return step(activeCreation(), 'navigate', { destination: { kind: 'library' } });
    case 'base-ending': {
      state = review({}, sampleAnswers({ eventDate: addDays(TODAY, 25 * 7 - 1) }));
      state = step(step(state, 'open-activate'), 'confirm-activate');
      return step(state, 'navigate', { destination: { kind: 'library' } });
    }
    case 'unknown-ending': {
      state = createState({ active: true, history: true, fixture: { unknownHistory: true } });
      state.closed[0].reason = 'Unknown';
      return step(state, 'navigate', { destination: { kind: 'closed', id: state.closed[0].id } });
    }
    case 'flexible-week-end': return step(activeCreation({ activeMode: 'flexible' }), 'navigate', { destination: { kind: 'library' } });
    case 'schedule-changes': return preview(activeCreation(), changeIntent(variant));
    case 'preview-cancelled': {
      state = preview(activeCreation());
      return step(state, 'cancel-change', { id: state.change.id });
    }
    case 'preview-supersession': return preview(activeCreation());
    case 'preview-failure': return step(preview(activeCreation()), 'set-fixture', { key: 'fail', value: variant });
    case 'preview-competing': return preview(activeCreation({ competingResult: true }));
    case 'daily-choice': {
      state = activeCreation({ activeMode: 'flexible' });
      return step(state, 'navigate', { destination: { kind: 'change', id: state.active.id } });
    }
    case 'supporting-events': {
      state = activeCreation();
      const authored = ['manual', 'name'].includes(variant);
      const accepted = state.active.supportingEvents?.find((item) => authored ? item.source === 'Your answer' : item.source === 'Intervals.icu event');
      const eventDetails = accepted ? { ...accepted } : { id: 'event-support-local', name: 'Valley social ride', date: addDays(TODAY, 12), role: 'Important', source: 'Athlete entered', providerPriority: 'B' };
      let operation = variant;
      if (variant === 'add') Object.assign(eventDetails, { id: 'event-support-new', name: 'Pine Ridge social ride', date: addDays(TODAY, 19), role: 'Important', source: 'Your answer', providerPriority: null });
      if (variant === 'name') eventDetails.name = 'Valley club ride';
      if (variant === 'manual' || variant === 'source-update' || variant === 'source-drift') eventDetails.date = addDays(eventDetails.date, 1);
      if (variant === 'role') eventDetails.role = eventDetails.role === 'Training' ? 'Important' : 'Training';
      if (variant === 'source-drift') operation = 'source-update';
      state = preview(state, { kind: 'supporting-event', operation, event: eventDetails });
      return variant === 'source-drift' ? step(state, 'set-fixture', { key: 'sourceRevision', value: state.fixture.sourceRevision + 1 }) : state;
    }
    case 'ftp-correction': return preview(activeCreation(), { kind: 'ftp', ftp: 220 });
    case 'adaptation-guards': {
      const fixture = { guard: ['race','taper','stale-sync'].includes(variant) ? variant : null };
      if (variant === 'stale-sync') fixture.syncStale = true;
      if (variant === 'race') fixture.raceWindow = true;
      if (variant === 'taper') fixture.taper = true;
      if (variant === 'missing-evidence') fixture.evidenceMissing = true;
      state = preview(activeCreation(fixture));
      return variant === 'changed-evidence' ? step(state, 'set-fixture', { key: 'evidenceRevision', value: state.fixture.evidenceRevision + 1 }) : state;
    }
    case 'assisted-recovery': return step(createState({ active: true, history: true }), 'navigate', { destination: { kind: 'recovery' } });
    case 'recovery-conflict': return step(step(activeCreation(), 'recover', { id: 'legacy-creation' }), 'confirm-recovery');
    case 'recovery-change': return step(activeCreation(), 'recover', { id: 'legacy-change' });
    case 'recovery-notices': {
      state = step(createState({ active: true, history: true, fixture: { recoveryNotice: variant, fail: variant === 'source-drift' ? 'source-drift' : null } }), 'navigate', { destination: { kind: 'recovery' } });
      const notices = { interrupted: 'Some earlier planning details still need recovery. Your active Plan and readable history remain available.', 'source-drift': 'The earlier planning source changed. Recovery is paused; the original details remain readable.', restored: 'Your Plans and readable history are available after restore. Unfinished details still need fresh confirmation.' };
      return step(state, 'notice', { text: notices[variant] });
    }
    default: return started(mixed);
  }
}
