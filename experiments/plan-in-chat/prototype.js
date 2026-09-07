(async () => {
const M = await import('./model.mjs');
const {scenarios, acceptance, seed} = await import('./scenarios.mjs?v=20260905-catalogue-2');
const params = new URLSearchParams(location.search);
const storageKey = 'enduragent-fictional-plan-catalogue-v1';
let selected = scenarios.some(x => x.id === params.get('scenario')) ? params.get('scenario') : 'creation-start';
let variation = params.get('variation') || '';
let state = seed(selected, variation);
let ui = {theme:params.get('theme') || 'dark',width:params.get('width') || 'wide',editor:null,values:{},how:false,editHub:false,context:true,source:null,error:''};
try {
  const saved = JSON.parse(localStorage.getItem(storageKey));
  if(saved?.version===1 && saved.selected===selected && saved.variation===variation) {
    state=saved.state;
    ui={...ui,...saved.ui,theme:params.get('theme') || saved.ui.theme,width:params.get('width') || saved.ui.width};
  }
} catch {}
const e = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date = v => v ? new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(v+'T12:00:00Z')) : 'Undated';
const days=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const labels={goal:'Main Goal',length:'Plan length',mode:'Schedule mode',availability:'Availability',start:'Start timing',commitments:'Commitments',baseline:'Recent training',success:'Success',restriction:'Training restriction'};
const current=()=>scenarios.find(x=>x.id===selected);
const c=()=>state.creation;
const actions=[];
let choiceNumber=0;
const total=s=>M.workouts(s).reduce((n,w)=>n+w.minutes,0);
function button(label,action,style='',attrs='') {
  const index=actions.push(action)-1;
  return '<button type="button" class="'+(style.startsWith('nav-item')?style:'action-button '+style)+'" data-command="'+index+'" '+attrs+'>'+e(label)+'</button>';
}
function fact(label,value) {return '<div class="evidence-row" role="row"><span role="rowheader">'+e(label)+'</span><strong role="cell">'+e(value)+'</strong></div>';}
function table(rows,label='Facts') {return '<div class="evidence-table" role="table" aria-label="'+e(label)+'">'+rows.join('')+'</div>';}
function card({eyebrow='',title,status='',plainStatus=false,summary='',body='',buttons=''}) {
  return '<section class="artifact evidence-status-card plan-projection-card"><div class="evidence-card-head"><div class="artifact-title-row"><div>'+(eyebrow?'<p class="artifact-eyebrow">'+e(eyebrow)+'</p>':'')+'<h3 tabindex="-1">'+e(title)+'</h3></div>'+(status?'<span class="status-chip'+(plainStatus?' is-plain':'')+'">'+e(status)+'</span>':'')+'</div>'+(summary?'<p>'+e(summary)+'</p>':'')+'</div>'+(body?'<div class="plan-card-body">'+body+'</div>':'')+(buttons?'<div class="card-actions">'+buttons+'</div>':'')+'</section>';
}
function notice(text) {
  if(text==='Plan creation discarded')return '<article class="plan-result-note" role="status"><strong>Plan creation discarded</strong><p>No Plan was created. Your active Plan, Schedule, training restrictions, saved preferences, and chat history are unchanged.</p></article>';
  return text?'<div class="plan-result-note" role="status"><p>'+e(text)+'</p></div>':'';
}
function ruleText(r) {return r.label || r.text || r.kind+(r.day?' · '+days[r.day-1]:'')+(r.minutes?' · '+r.minutes+' min':'')+(r.start?' · '+date(r.start):'')+(r.end?' to '+date(r.end):'');}
function answerText(key,v,mode=c()?.answers.mode) {
  if(v==null)return 'Not answered';
  if(key==='goal')return v.kind==='event'?v.name+' · '+date(v.date):v.name || 'Improve without an event';
  if(key==='length')return v+' weeks';
  if(key==='start')return date(v);
  if(key==='mode')return v==='flexible'?'Flexible Workout pool':'Fixed Schedule';
  if(key==='availability')return v.weeklyHours+' h weekly · '+v.longest+' min longest'+(mode==='fixed'?' · '+v.days.map(d=>days[d-1]).join(', '):' · '+M.poolSize(v.weeklyHours,v.poolCount)+' Workouts per week');
  if(key==='commitments')return v.length?v.map(ruleText).join('; '):'No fixed commitments';
  if(key==='restriction')return ({none:'No training restrictions','no-training':'No training','no-hard-training':'No hard training','max-duration':'Maximum '+v.minutes+' min'})[v.kind]+(v.end?' through '+date(v.end):'');
  return String(v);
}
function summaries() {
  if(!c())return '';
  return M.requiredKeys(c()).filter(k=>c().answers[k]!=null).map(k=>'<section class="choice-result" aria-label="'+e(labels[k])+' answer"><span class="choice-result-mark" aria-hidden="true">✓</span><div><p class="artifact-eyebrow">Answer recorded</p><strong>'+e(answerText(k,c().answers[k]))+'</strong><p>'+e(labels[k])+' · '+e(c().sources?.[k] || c().answers[k]?.source || 'your answer')+'</p></div>'+button('Edit',{type:'edit',key:k},'','aria-label="Edit '+e(labels[k])+'"')+'</section>').join('');
}
function progress(inLibrary=false) {
  if(!c())return '';
  const keys=M.requiredKeys(c()),count=keys.filter(k=>c().answers[k]!=null).length;
  return card({eyebrow:'Plan creation',title:c().answers.goal?answerText('goal',c().answers.goal):'New Plan',status:c().draft?'Draft':c().paused?'Paused':'In progress',summary:count+' of '+keys.length+' answered. '+(state.active?M.title(state.active)+' keeps running.':'No Plan is active.'),buttons:button('Discard',{type:'open-discard'},'danger')+(c().paused||inLibrary?button('Continue in Chat',{type:'continue',id:c().id},'primary'):'')});
}
function input(name,label,type='text',value='',extra='') {
  return '<label class="catalogue-field" for="field-'+name+'"><span>'+e(label)+'</span><input id="field-'+name+'" name="'+name+'" type="'+type+'" value="'+e(ui.values[name]??value)+'" '+extra+' aria-describedby="form-error"></label>';
}
function select(name,label,options,value='') {
  return '<label class="catalogue-field" for="field-'+name+'"><span>'+e(label)+'</span><span class="catalogue-select"><select id="field-'+name+'" name="'+name+'">'+options.map(([v,l])=>'<option value="'+e(v)+'" '+(String(ui.values[name]??value)===String(v)?'selected':'')+'>'+e(l)+'</option>').join('')+'</select><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></span></label>';
}
function editorFields(key) {
  const a=c()?.answers || {},v=a[key] || c()?.uncertain?.find(x=>x.key===key)?.value || (key==='availability'?state.fixture.facts?.availability?.value:null);
  if(key==='goal')return input('name','Event name','text',v?.kind==='event'?v.name:'','required maxlength="512"')+input('date','Exact event date','date',v?.date || '','required');
  if(key==='success')return '<label class="catalogue-field" for="field-success"><span>What would success look like?</span><textarea id="field-success" name="success" maxlength="2000" rows="2" required>'+e(ui.values.success??v??'')+'</textarea></label>';
  if(key==='availability')return select('weeklyHours','Weekly time limit',[[5,'5 hours'],[6,'6 hours'],[8,'8 hours'],[9,'9 hours']],v?.weeklyHours || 6)+input('longest','Longest Workout in minutes','number',v?.longest || 90,'min="1" max="540" required')+(a.mode==='fixed'?input('weekdayMinutes','Normal weekday duration in minutes','number',v?.weekdayMinutes || 60,'min="1" max="540" required'):'')+(a.mode==='fixed'?'<fieldset><legend>Usable weekdays</legend>'+days.map((d,i)=>'<label><input type="checkbox" name="days" value="'+(i+1)+'" '+((ui.values.days || (v?.days || []).map(String)).includes(String(i+1))?'checked':'')+'>'+d+'</label>').join('')+'</fieldset>':'<p class="plan-support">The weekly limit determines 3, 4 or 5 Workouts. You can correct that count.</p>'+input('poolCount','Workouts per week, optional correction','number',v?.poolCount || '','min="3" max="5"'));
  if(key==='start')return input('start','Earliest start date','date',v || state.fixture.today || M.TODAY,'required');
  if(key==='restriction') {
    const kind=ui.values.kind || v?.kind || 'none';
    return select('kind','Operational training limit',[['none','No training restrictions'],['no-training','No training'],['no-hard-training','No hard training'],['max-duration','Maximum duration']],kind)+(kind==='max-duration'?input('minutes','Maximum duration in minutes','number',v?.minutes || 30,'min="1" max="540" required'):'')+(kind!=='none'?input('end','End date, optional','date',v?.end || ''):'');
  }
  if(key==='commitments')return '<label class="catalogue-field" for="field-text"><span>Commitments or time off</span><textarea id="field-text" name="text" rows="2" maxlength="2000" required>'+e(ui.values.text || '')+'</textarea></label>';
  if(key==='change') {
    const kind=ui.values.kind || 'weekday-duration',op=ui.values.operation || 'add';
    let fields=select('kind','Change',[['weekday-duration','Weekday duration cap'],['weekday-unavailable','Weekday unavailable'],['hard-weekday','No hard training on a weekday'],['weekly-duration','Weekly duration cap'],['longest-workout','Longest-Workout cap'],['ftp','Correct FTP'],['supporting-event','Supporting Event']],kind);
    if(['weekday-duration','weekday-unavailable','hard-weekday'].includes(kind))fields+=select('day','Weekday',days.map((d,i)=>[i+1,d]),kind==='hard-weekday'?1:3);
    if(['weekday-duration','longest-workout'].includes(kind))fields+=input('minutes','Duration limit in minutes','number',kind==='weekday-duration'?30:60,'min="1" required');
    if(kind==='weekly-duration')fields+=input('hours','Weekly limit in hours','number',3,'min="1" required');
    if(kind==='ftp')fields+=input('ftp','FTP in watts','number',220,'min="1" required');
    if(kind==='supporting-event'){
      fields+=select('operation','Supporting Event operation',[['add','Add'],['remove','Remove'],['role','Change role'],['manual','Correct manual name or date'],['source-update','Accept synchronized details'],['name','Name only']],op);
      const list=state.active.supportingEvents,chosen=list.find(x=>x.id===(ui.values.eventId || (['manual','name'].includes(op)?'meadow':'river')));
      if(op!=='add')fields+=select('eventId','Accepted Supporting Event',list.map(x=>[x.id,x.name]),chosen?.id);
      if(op!=='remove')fields+=input('name','Supporting Event name','text',chosen?.name || 'River ride')+input('date','Supporting Event date','date',chosen?.date || M.addDays(state.fixture.today,14))+select('role','Plan role',[['Important','Important'],['Training','Training']],chosen?.role || 'Training');
    }
    return fields;
  }
  if(key==='supporting')return select('eventId','Event',(state.fixture.events || []).filter(x=>x.id!==a.goal?.id).map(x=>[x.id,x.name+' · '+date(x.date)]))+select('role','Role in this Plan',[['Important','Important'],['Training','Training'],['Ignore for this Plan','Ignore for this Plan']],'Ignore for this Plan');

  return '';
}
function editor(key, returnToAnswers=false) {
  return '<form id="answer-form" data-editor="'+e(key)+'"><div class="choice-custom-editor is-standalone">'+editorFields(key)+'<p id="form-error" role="alert">'+e(ui.error || (key==='change'?state.changeError:c()?.error) || '')+'</p><div class="choice-custom-actions">'+(returnToAnswers?button('Back to answers',{type:'cancel-edit'},'back-to-answers'):'')+'<div class="choice-custom-actions">'+button('Back',{ui:'back-editor'})+'<button class="action-button primary" type="submit">'+(key==='change'?'Preview change':key==='commitments'?'Review interpretation':'Continue')+'</button></div></div></div></form>';
}
function option(label,value,key,detail='',edit=null) {
  const idx=actions.push(edit?{ui:'editor',key:edit}:{type:'answer',key,value,...(key==='availability'&&state.fixture.facts?.availability?{source:state.fixture.facts.availability.source}:{})})-1;
  return '<button class="choice-option" type="button" '+(edit?'data-editor-trigger="'+edit+'"':'')+' data-command="'+idx+'"><span class="choice-number" aria-hidden="true">'+(++choiceNumber)+'</span><span class="choice-copy"><span class="choice-label">'+e(label)+'</span>'+(detail?'<span class="choice-detail">'+e(detail)+'</span>':'')+'</span><span class="choice-arrow" aria-hidden="true">›</span></button>';
}
function scheduleOverview(){const facts=state.fixture.facts?.availability?state.fixture.facts:null;return '<div class="schedule-overview"><p>'+e(facts?answerText('availability',facts.availability.value,'fixed'):'No saved availability')+'</p><p>'+e(facts?.availability?.source || '')+'</p><p>'+e(facts?'Recent riding · '+facts.baseline.avgWeeklyMinutes+' min weekly · longest '+facts.baseline.longest+' min · '+facts.baseline.source:'')+'</p></div>';}
function question() {
  if(!c() || c().paused || (c().pendingCommitment&&ui.editor!=='commitments') || ui.editHub || ui.editor==='supporting' || !['creation','chat'].includes(state.destination.kind))return '';
  choiceNumber=0;
  const key=c().editing || M.nextQuestion(c());
  if(!key)return '';
  const titles={goal:'What do you want this Plan to prepare you for?',length:'How long should this Plan run?',mode:state.fixture.connected?'Does this usual week look right?':'How should your weeks work?',availability:'How much time can you protect?',start:'When should this Plan start?',commitments:'Any fixed commitments or time off?',baseline:'How has your recent training been?',success:'What would make this Plan a success?',restriction:'Does anything need to limit training right now?'};
  const formOpen=ui.editor===key || key==='restriction' || (key==='availability'&&!state.fixture.connected);
  let content='';
  if(ui.editor===key)content=(key==='availability'&&state.fixture.connected?scheduleOverview():'')+editor(key,!!c().editing);
  else {
    if(key==='goal')content=(state.fixture.connected?(state.fixture.events || []).map(ev=>option(ev.name+' · '+date(ev.date),{...ev,kind:'event',source:ev.source || 'intervals.icu'},key,'Synchronized event')).join(''):'')+option('Event not listed',null,key,'Enter its name and exact date.','goal')+option('Improve without an event',{kind:'fitness',name:'Improve fitness',source:'your answer'},key,'Build fitness for a fixed number of weeks.');
    if(key==='length')content=[4,8,12,16].map(n=>option(n+' weeks',n,key)).join('');
    if(key==='mode')content=(state.fixture.connected?scheduleOverview():'')+option(state.fixture.connected?'Looks right':'Fixed days','fixed',key,'Workouts use your confirmed days and limits.')+option('My week varies','flexible',key,'An ordered pool. Choose a day later.');
    if(key==='availability')content=state.fixture.connected&&ui.editor!=='availability'?scheduleOverview()+option('Looks right',state.fixture.facts.availability.value,key,'Use the saved limits shown above.')+option('My week varies','flexible','mode','Keep an undated weekly pool.')+option('Change one thing',null,key,'Correct the availability or limits.','availability'):editor(key,!!c().editing);
    if(key==='start')content=option('Next valid Plan day',state.fixture.today || M.TODAY,key,'Today if allowed, otherwise the earliest day your Schedule allows.')+option('Start later',null,key,'Choose the earliest date.','start');
    if(key==='commitments')content=option('No fixed commitments',[],key)+option('Add commitments or time off',null,key,'Review the exact interpreted limits.','commitments');
    if(key==='baseline')content=['Regular','Occasional','Starting again'].map(v=>option(v,v,key)).join('');
    if(key==='success')content=(c().answers.goal?.kind==='event'?['Finish comfortably','Finish fast','Race for a result']:['Train consistently','Climb stronger','Ride farther comfortably']).map(v=>option(v,v,key)).join('')+option('Something else',null,key,'Answer in your own words.','success');
    if(key==='restriction')content=editor(key,!!c().editing);
    content='<div class="choice-list" role="group" aria-label="'+e(labels[key])+'">'+content+'</div>';
  }
  const keys=M.requiredKeys(c());
  return '<section class="choice-card '+(ui.editor?'choice-card-custom':'')+'" aria-labelledby="choice-title"><header class="choice-header"><div><p>Plan creation · question '+(keys.indexOf(key)+1)+' of '+keys.length+'</p><h3 id="choice-title" tabindex="-1">'+e(titles[key])+'</h3></div>'+button('Later',{type:'later'},'','aria-label="Later"')+'</header>'+content+(c().editing&&!formOpen?'<div class="choice-custom-actions">'+button('Back to answers',{type:'cancel-edit'},'back-to-answers')+'</div>':'')+'</section>';
}
function workoutList(week) {
  return '<p class="plan-section-label">Week '+week.number+' · '+date(week.start)+' to '+date(week.end)+' · '+week.workouts.reduce((n,w)=>n+w.minutes,0)+' min</p><div class="plan-week-list" role="list" aria-label="Week '+week.number+' Workouts">'+(week.workouts.length?week.workouts.map((w,i)=>'<div role="listitem"><span>'+(w.date?date(w.date):'Priority '+(i+1)+' · Undated')+'</span><strong>'+e(w.name)+' · '+w.minutes+' min'+(w.power?' · '+w.power+' W':' · '+e(w.guidance || 'Perceived effort'))+'</strong><span class="status-chip">'+e(w.status)+(w.pinned?' · Pinned':'')+'</span></div>').join(''):'<p>No Workouts this week.</p>')+'</div>'+(week.notes || []).map(n=>'<p class="plan-support">'+e(n)+'</p>').join('');
}
function snapshotFacts(s) {
  const a=s.inputs || s.answers || {};
  return table([fact('Main Goal · '+(a.goal?.source || s.goal?.source || 'your answer'),answerText('goal',a.goal || s.goal)),fact('Calendar',s.mirrorStart?date(s.mirrorStart)+' to '+date(s.mirrorEnd)+' · '+s.mirrorStatus:s.mirrorStatus || 'Local only'),fact('Plan span',date(s.start)+' to '+date(s.end)+' · '+s.weeks.length+' weeks · '+s.spanKind),...Object.keys(labels).filter(k=>k!=='goal'&&a[k]!=null).map(k=>fact(labels[k]+' · '+(s.sources?.[k] || 'confirmed'),answerText(k,a[k],a.mode)))],'Draft inputs');
}
function draft() {
  const creation=c(),s=creation?.draft;
  if(!s)return '';
  const stale=s.revision!==creation.revision;
  return card({eyebrow:'Draft inputs',title:M.title(s),status:stale?'Stale':'Needs review',summary:stale?'This Draft preserves the earlier answers and Workouts. Rebuild before activation.':'Review the whole Draft before activating.',body:snapshotFacts(s)+sourceSummary()+'<details class="plan-card-disclosure"><summary>How this Plan was built</summary>'+table([fact('Guidance',s.ftp?s.ftp+' W · selected FTP':'Heart rate or perceived effort. No FTP test.'),fact('Training approach','Balanced · default'),...(s.notes || []).map(n=>fact('Confirmed limits',n))])+'</details>'})+card({eyebrow:'Training outline',title:'Every week and Workout',status:stale?'Out of date':'Draft',summary:s.weeks.length+' weeks · '+M.workouts(s).length+' Workouts · '+total(s)+' min',body:s.weeks.map(workoutList).join(''),buttons:button('Discard',{type:'open-discard'},'danger')+button('Edit answers',{ui:'edit-hub'})+button(stale?'Rebuild Draft':'Activate Plan',{type:stale?'build-start':'open-activate'},'primary')});
}
function ruleControls(){return (c()?.answers.commitments || []).map(r=>card({title:ruleText(r),summary:r.source,buttons:button('Edit rule',{ui:'editor',key:'commitments'})+button('Remove rule',{type:'rule-remove',id:r.id},'danger')})).join('');}
function sourceSummary() {
  if(!c())return '';
  const facts=state.fixture.facts;
  const rows=state.fixture.connected?[fact('Usual week · saved availability',facts?answerText('availability',facts.availability.value,'fixed'):'6 h weekly · Mon, Wed, Sat · 120 min longest'),fact('Recent riding · intervals.icu','6 h 40 weekly · longest 2 h 10'),fact('Starting point · intervals.icu','Regular')]:[fact('Recent riding','No connected history. Your baseline answer supplies the starting point.')];
  if(state.fixture.conflictingEvidence)rows.push(fact('Weekly limit · observed riding','6 h 40 observed; your saved 6 h limit takes precedence.'));
  rows.push(...(state.fixture.ftpSources || []).map(x=>fact('FTP · '+x.source,x.value+' W'+(x.selected?' · selected':''))));
  if(!state.fixture.ftp)rows.push(fact('FTP','No credible FTP. Use heart rate or perceived effort.'));
  rows.push(fact('Training approach','Balanced · disclosed default'));
  return '<details class="plan-card-disclosure"><summary>Already taken into account</summary>'+table(rows)+'<div class="card-actions">'+button('Correct availability',{type:'edit',key:'availability'})+button('Correct recent training',{type:'edit',key:'baseline'})+((state.fixture.events || []).some(x=>x.id!==c().answers.goal?.id)?button('Supporting Events',{ui:'editor',key:'supporting'}):'')+'</div></details>';
}
function pendingCommitment() {
  const p=c()?.pendingCommitment;
  if(!p)return '';
  return card({eyebrow:'Schedule correction',title:p.status==='clarify'?'Clarify your commitment':'Confirm these limits',status:'Not yet confirmed',summary:'Your last confirmed limits remain effective. Draft building and activation wait for this correction.',body:table([fact('Submitted',p.text),...(p.rule?[fact('Interpreted limit',ruleText(p.rule))]:[])]),buttons:button('Cancel correction',{type:'commitment-cancel'})+button('Clarify',{ui:'editor',key:'commitments'})+(p.rule?button('Confirm limits',{type:'commitment-confirm'},'primary'):'')});
}
function creationContent() {
  if(!c())return '';
  if(ui.editor==='supporting')return card({title:'Supporting Events',summary:'The Main Goal stays unchanged. Provider priority is separate from your Plan role.',body:editor('supporting')});
  if(c().build) {
    const b=c().build;
    return progress()+notice(c().error)+card({eyebrow:'Draft',title:'Building your Draft',status:'In progress',summary:b.completed+' of '+b.weeks+' weeks complete.',body:'<div class="progress-track" role="progressbar" aria-label="Weeks complete" aria-valuemin="0" aria-valuemax="'+b.weeks+'" aria-valuenow="'+b.completed+'" style="--progress:'+(b.completed/b.weeks*100)+'%"></div>'+b.output.map(workoutList).join('')+(b.completed<b.weeks?'<p class="plan-section-label">Later weeks</p><div class="plan-phase-list" role="list" aria-label="Later build outline"><div role="listitem"><span>Weeks '+(b.completed+1)+' to '+b.weeks+'</span><strong>Not started</strong><small>Workouts will appear here</small></div></div>':'')});
  }
  if(ui.editHub)return card({eyebrow:'Plan creation',title:'Edit answers',summary:'A changed answer makes the Draft stale.',buttons:button('Back to Draft',{ui:'leave-hub'})})+summaries()+ruleControls()+pendingCommitment();
  if(c().draft&&!c().editing&&!M.nextQuestion(c()))return notice(c().error)+pendingCommitment()+(c().draft.revision!==c().revision?card({title:'Changed answers',body:table(M.requiredKeys(c()).filter(k=>c().answers[k]!=null).map(k=>fact(labels[k]+' · current answer',answerText(k,c().answers[k]))))}):'')+draft();
  return summaries()+progress()+(c().uncertain?.length?card({eyebrow:'Recovered details',title:'Confirm uncertain answers',body:table(c().uncertain.map(x=>fact(labels[x.key]+' · earlier unconfirmed detail',answerText(x.key,x.value))))}):'')+sourceSummary()+notice(c().error)+pendingCommitment()+(c().draft?draft():'')+(!M.nextQuestion(c())&&!c().draft?card({eyebrow:'Plan creation',title:'Ready to build',summary:'The essentials are complete.',buttons:button('Build Draft',{type:'build-start'},'primary')}):'');
}
function planCard(plan,closed=false) {
  const detail=closed?(plan.reason || 'Unknown reason'):plan.mirrorStatus==='Up to date'?'Calendar up to date':'';
  const summary=date(plan.start)+' to '+date(plan.end)+' · '+plan.weeks.length+' weeks'+(detail?' · '+detail:'');
  const body=closed?(plan.spanKind==='Base Plan'?notice('Your Event Goal is still '+date(plan.goal.date)+'. Start a new Plan for event preparation when it is within 24 weeks.'):''):plan.mirrorStatus!=='Up to date'?notice(plan.mirrorStatus || ''):'';
  return card({eyebrow:closed?'Closed Plan':'Active Plan',title:M.title(plan),status:closed?'Closed':'Active',summary,body,buttons:closed?button('Read final details',{type:'navigate',destination:{kind:'closed',id:plan.id}}):button('Stop Plan',{type:'close-plan'},'danger')+button('Read Plan details',{ui:'plan-details',id:plan.id})+button('Change in Chat',{type:'navigate',destination:{kind:'change',id:plan.id}},'primary')});
}
function library() {
  return (c()?progress(true):'')+(state.active?planCard(state.active):card({title:'No active Plan',summary:'Create a Plan when you are ready.'}))+state.closed.map(p=>planCard(p,true)).join('')+(state.active&&ui.planDetails===state.active.id?card({title:'Plan details',body:snapshotFacts(state.active)+state.active.weeks.map(workoutList).join('')}):'')+(state.legacy?.length?'<div class="card-actions">'+button('Recover earlier planning work',{type:'navigate',destination:{kind:'recovery'}})+'</div>':'');
}
function workoutValue(w) {return w?date(w.date)+' · '+w.minutes+' min'+(w.power?' · '+w.power+' W':''):'Not in Plan';}
function changeDiff(p) {
  return table((p.diff || []).map(d=>fact((d.before?.name || d.after?.name || 'Workout'),workoutValue(d.before)+' → '+workoutValue(d.after))),'Affected individual Workouts')+table([fact('Plan totals',total(p.before)+' min → '+total(p.after)+' min'),...p.before.weeks.map((w,i)=>fact('Week '+w.number,w.workouts.reduce((n,x)=>n+x.minutes,0)+' min → '+(p.after.weeks[i]?.workouts.reduce((n,x)=>n+x.minutes,0)||0)+' min'))],'Before and after totals')+(!(p.diff || []).length?notice('No Workout changes.'):'');
}
function changeContent() {
  const p=state.change;
  if(!state.active)return notice('This Plan is closed. Its final details remain in your library.')+button('Open Plan',{type:'navigate',destination:{kind:'library'}});
  let html=card({eyebrow:'Active Plan',title:M.title(state.active),summary:c()?'Your separate Plan creation is still open.':'Changes affect future, uncompleted training.',buttons:button('Change one thing',{ui:'editor',key:'change'})+button('What should I ride today?',{ui:'daily'})+button('Open Plan',{type:'navigate',destination:{kind:'library'}})});
  if(ui.editor==='change')html+=card({eyebrow:'Plan Change',title:'What needs to change?',body:editor('change')});
  if(ui.daily||selected==='daily-choice')html+=card({eyebrow:'Today',title:'Choose one eligible Workout',body:M.eligibleWorkouts(state).map(item=>{const w=item.workout || item;return '<div class="evidence-row"><span>'+e(w.name)+' · '+w.minutes+' min</span><div>'+(item.eligible===false?e(item.reason):button('Review '+w.name,{type:'request-change',intent:{kind:'choose-workout',workoutId:w.id}}))+'</div></div>';}).join('')});
  if(p)html+=card({eyebrow:'Plan Change',title:p.title,status:p.status || 'Preview',plainStatus:true,summary:'Review this exact difference. Training stays unchanged until you confirm.',body:notice(p.details)+changeDiff(p)+table([fact('Main Goal',answerText('goal',p.before.goal || p.before.inputs?.goal)),fact('Supporting Events before',(p.before.supportingEvents || []).map(x=>x.name+' · '+date(x.date)+' · '+x.role+' · '+x.source+(x.providerPriority?' · provider priority '+x.providerPriority:'')).join('; ') || 'None'),fact('Supporting Events after',(p.after.supportingEvents || []).map(x=>x.name+' · '+date(x.date)+' · '+x.role+' · '+x.source+(x.providerPriority?' · provider priority '+x.providerPriority:'')).join('; ') || 'None'),fact('Confidence',p.confidence || 'Based on your confirmed limits')])+'<div class="card-actions">'+button('View evidence',{ui:'source',value:p.premises})+button('Refresh preview',{ui:'refresh-preview'})+'</div>',buttons:button('Cancel',{type:'cancel-change',id:p.id})+button('Apply to Plan',{type:'apply-change',id:p.id},'primary')});
  html+=(state.changeHistory || []).map(p=>card({eyebrow:'Plan Change history',title:p.title,status:p.status,plainStatus:true,summary:'Earlier decisions remain readable.',buttons:button('Read historical evidence',{ui:'source',value:p.premises})+button('Read this difference',{ui:'source',value:p})+(p.status==='applied'?button('Undo',{type:'undo'}):'')})).join('');
  return html;
}
function recovery() {
  return card({eyebrow:'Earlier planning work',title:'Choose details to continue',summary:'Originals remain readable. Continuing requires a fresh Draft or Change preview.',body:(state.legacy || []).map(s=>'<div class="evidence-row"><span>'+e(s.title || s.name || s.id)+' · '+e(s.kind)+'</span>'+'<div class="card-actions">'+button('Read source',{ui:'source',value:s})+button('Continue',{type:'recover',id:s.id})+'</div></div>').join('')})+(state.recovery?card({title:'Confirm recovered details',summary:'Continue into a fresh creation to confirm each uncertain answer. The earlier work remains readable.',body:table([fact('Source',state.recovery.source.title),...(state.recovery.source.uncertain || []).map(x=>fact('Needs confirmation · '+labels[x.key],answerText(x.key,x.value,state.recovery.source.answers?.mode)))]),buttons:button('Cancel',{type:'cancel-recovery'})+button('Continue',{type:'confirm-recovery'},'primary')}):'');
}
function content() {
  const dest=state.destination;
  let body=notice(state.notice);
  if(dest.kind==='library')return body+library();
  if(dest.kind==='closed'){const p=state.closed.find(x=>x.id===dest.id);return body+(p?planCard(p,true)+card({title:'Final Plan details',body:snapshotFacts(p)+p.weeks.map(workoutList).join('')}):'')+button('Back to library',{type:'navigate',destination:{kind:'library'}});}
  if(dest.kind==='recovery')return body+recovery();
  if(dest.kind==='change')return body+changeContent();
  body+=(state.messages || []).map(m=>'<div class="turn user"><div class="user-bubble">'+e(m.text || m)+'</div></div>').join('');
  body+=creationContent();
  if(!c())body+=(state.active?planCard(state.active):'')+'<div class="card-actions">'+button('Start a Plan',{type:'start'},'','id="start-plan"')+'</div>';
  return body;
}
function dialog() {
  if(!state.dialog)return '';
  const kind=state.dialog.kind,discard=kind==='discard',close=kind==='close';
  const title=discard?'Discard this Plan creation?':close?'Stop this Plan?':state.active?'Close and activate?':'Activate Plan?';
  const today=state.fixture.today || M.TODAY;
  const keepsToday=state.active&&M.workouts(state.active).some(w=>w.date===today&&w.mirrored);
  const calendar=!state.fixture.connected?'Calendar updates wait until intervals.icu is connected.':'Dated Workouts sync '+(keepsToday?'from tomorrow':'from today')+' through '+date(M.addDays(today,6))+'.';
  const copy=discard?'Your answers are discarded. Your active Plan, Schedule, restrictions, saved preferences, and history stay unchanged.':close?'Final training stays readable. Calendar cleanup can finish later.':(state.active?M.title(state.active)+' closes. ':'')+(keepsToday?'Today’s calendar Workout stays. ':'')+'The new Plan activates now.';
  return '<div class="dialog-layer"><section class="dialog-card" role="dialog" aria-modal="true" aria-labelledby="dialog-title" aria-describedby="dialog-copy"><h3 id="dialog-title">'+e(title)+'</h3><div id="dialog-copy"><p>'+e(copy)+'</p>'+(!discard&&!close?'<p>'+e(calendar)+'</p>':'')+'</div>'+notice(c()?.error)+'<div class="card-actions">'+button(discard?'Keep creating':'Cancel',{type:'cancel-dialog'},'','data-dialog-cancel')+button(discard?'Discard creation':close?'Stop Plan':state.active?'Activate new Plan':'Activate Plan',{type:discard?'confirm-discard':close?'confirm-close':'confirm-activate'},discard||close?'danger confirm-danger':'primary')+'</div></section></div>';
}
function sidebar() {
  const inPlan=['library','closed'].includes(state.destination.kind);
  return '<aside class="app-sidebar"><div class="brand-block"><div class="brand-name">Enduragent</div></div><nav class="nav-list" aria-label="Main navigation">'+button('Chat',{type:'navigate',destination:c()?{kind:'creation',id:c().id}:{kind:'chat'}},'nav-item'+(!inPlan?' is-active':''),'aria-current="'+(!inPlan?'page':'false')+'"')+button('Plan',{type:'navigate',destination:{kind:'library'}},'nav-item'+(inPlan?' is-active':''),'aria-current="'+(inPlan?'page':'false')+'"')+'</nav><div class="sidebar-footer"><div class="side-status">'+(state.fixture.connected?'intervals.icu connected':'Local planning')+'</div></div></aside>';
}
function contextPanel(drawer=false) {
  return '<aside class="context-panel '+(drawer?'context-drawer-panel':'')+'" '+(drawer?'role="dialog" aria-modal="true" aria-labelledby="context-title"':'aria-label="Training context"')+'>'+(drawer?'<div class="context-drawer-head">'+button('Close',{ui:'context'},'','id="close-context"')+'</div>':'')+'<h3 id="context-title">Training context</h3><p>Available to Coach</p><section class="context-section"><h4>Current Plan</h4><strong>'+e(state.active?M.title(state.active):'No active Plan')+'</strong><p>'+(c()?'A separate creation is unfinished.':'')+'</p>'+button('Open Plan',{type:'navigate',destination:{kind:'library'}})+'</section><section class="context-section"><h4>Power guidance</h4><p>'+e(state.fixture.ftp?typeof state.fixture.ftp==='object'?JSON.stringify(state.fixture.ftp):state.fixture.ftp+' W':'Heart rate or perceived effort')+'</p></section></aside>';
}
function premiseValue(value) {if(value?.candidates)return 'Plan FTP '+value.acceptedPlanFtp+' W · requested '+value.requestedFtp+' W · '+value.candidates.map(x=>x.value+' W · '+x.source+(x.selected?' · selected':'')).join('; ');return typeof value==='object'?Object.entries(value).map(([k,v])=>k+' '+v).join(' · '):value;}
function sourceCard(source) {
  let body='';
  if(Array.isArray(source))body=table(source.map(item=>fact(item.label+' · '+item.source,premiseValue(item.value))));
  else if(source.before&&source.after)body=notice(source.status)+changeDiff(source)+table((source.premises || []).map(item=>fact(item.label+' · '+item.source,premiseValue(item.value))));
  else if(source.kind&&source.evidence)body=table([fact('Earlier work',source.title),fact('Source',source.evidence),...(source.intent?[fact('Earlier requested change',source.intent.kind+(source.intent.day?' · '+days[source.intent.day-1]:'')+(source.intent.minutes?' · '+source.intent.minutes+' min':'')+(source.intent.ftp?' · '+source.intent.ftp+' W':''))]:[]),...(source.answers?Object.entries(source.answers).map(([k,v])=>fact(labels[k] || k,answerText(k,v))):[]),...(source.uncertain || []).map(x=>fact('Needs confirmation · '+labels[x.key],answerText(x.key,x.value,source.answers?.mode)))]);
  else body=table(Object.entries(source).map(([k,v])=>fact(k,typeof v==='object'?JSON.stringify(v):v)));
  return card({eyebrow:'Evidence',title:'Source details',body,buttons:button('Back',{ui:'close-source'})});
}
function composer(q) {
  const disabled=q?'disabled':'';
  return '<div class="composer-dock">'+(q?'<div class="coach-answer-prompt">'+q+'</div>':'')+(ui.editor&&q?'':'<div class="composer-anchor"><div class="composer"><textarea id="coach-composer" rows="1" aria-label="Message your coach" placeholder="'+(q?'Finish the Plan question above':'Message your coach')+'" '+disabled+'></textarea><div class="composer-toolbar"><button class="icon-button" type="button" aria-label="Attach a file" disabled><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.4 11.6-8.9 8.9a6 6 0 0 1-8.5-8.5l9.5-9.5a4 4 0 0 1 5.7 5.7L9.7 17.7a2 2 0 1 1-2.8-2.8l8.8-8.8"/></svg></button><button class="send" type="button" aria-label="Send message" data-command="'+(actions.push({ui:'send'})-1)+'" '+disabled+'><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 19V5M5 12l7-7 7 7"/></svg></button></div></div></div>')+'<p class="composer-disclaimer">Training changes need your confirmation.</p></div>';
}
function render() {
  actions.length=0;
  const scenario=current();
  document.documentElement.dataset.theme=ui.theme;
  document.getElementById('theme-label').textContent=ui.theme==='dark'?'Light':'Dark';
  document.getElementById('scenario-select').innerHTML=scenarios.map(x=>'<option value="'+x.id+'" '+(x.id===selected?'selected':'')+'>'+e(x.name)+'</option>').join('');
  document.getElementById('direction-note').innerHTML='<div class="direction-note-copy"><strong>'+e(scenario.name)+'</strong><p>'+e(scenario.purpose)+'</p><p>'+e((scenario.steps || []).join(' → '))+'</p></div><span class="experiment-label">Fictional UI · '+e((scenario.acceptance || []).join(', '))+'</span>';
  document.getElementById('fixture-controls').innerHTML=(scenario.variations?.length?'<label>Focused alternative <select id="variation-select"><option value="">Default</option>'+scenario.variations.map(v=>'<option value="'+e(v.id)+'" '+(v.id===variation?'selected':'')+'>'+e(v.label)+'</option>').join('')+'</select></label>':'')+button('Reset this fixture',{ui:'reset'})+button('Next build checkpoint',{type:'build-next'})+button('Finish fixture build',{ui:'finish-build'})+'<label>Next simulated outcome <select id="failure-select">'+['none','build','translation','validation','interruption','local','calendar','source-drift','stale-plan','stale-sync','race','taper'].map(x=>'<option '+(state.fixture.fail===x?'selected':'')+'>'+x+'</option>').join('')+'</select></label>'+button('Advance to Plan end',{type:'fixture-clock',date:state.active?M.addDays(state.active.end,1):state.fixture.today})+button('Project week closure',{type:'close-week'})+button('Project Plan completion',{type:'complete-plan'})+button('Retry calendar',{type:'retry-calendar'})+button('Fresh source fixture',{ui:'fresh-evidence'})+button('Replay last confirmation',{ui:'replay'})+button('Apply retired preview',{ui:'retired-apply'})+button('Deliver older preview result',{ui:'older-result'})+button('Concurrent Plan update',{type:'bump-plan-revision'})+'<label><input id="reduced-motion" type="checkbox" '+(ui.reduced?'checked':'')+'>Reduced motion</label>';
  const q=question(),libraryView=['library','closed'].includes(state.destination.kind),body=content();
  const drawer=ui.width==='compact'&&ui.contextDrawer&&!libraryView;
  const headerAction=libraryView?(!c()?button(state.active?'Start a new Plan':'Start a Plan',{type:'start'},'primary','id="start-plan"'):''):button(ui.width==='compact'?'Training context':ui.context?'Hide context':'Show context',{ui:'context'},'','id="context-toggle" aria-expanded="'+(ui.width==='compact'?!!drawer:!!ui.context)+'"');
  const source=ui.source?sourceCard(ui.source):'';
  document.getElementById('prototype-canvas').innerHTML='<div class="app-frame" data-width="'+ui.width+'" '+(ui.reduced?'data-reduced-motion="true"':'')+'><div class="catalogue-shell" '+(state.dialog||drawer?'inert':'')+'>'+sidebar()+'<section class="'+(libraryView?'plan-flow-surface':'chat-surface direction-reading')+' '+(q?'has-coach-answer-prompt':'')+' '+(!ui.context?'context-closed':'')+'"><header class="chat-header"><h2 id="page-title" tabindex="-1">'+(libraryView?'Plan':'Current conversation')+'</h2>'+headerAction+'</header><div class="chat-layout-context '+(ui.context&&!libraryView?'':'is-closed')+'"><div class="thread-region"><div class="thread"><div class="turn coach-turn"><div class="coach-copy">'+body+source+'</div></div></div></div>'+(ui.context&&!libraryView&&ui.width!=='compact'?contextPanel():'')+'</div>'+(libraryView?'':composer(q))+'</section></div>'+dialog()+(drawer?'<div class="context-drawer-layer">'+contextPanel(true)+'</div>':'')+'</div>';
  document.getElementById('coverage-grid').innerHTML=scenarios.map(x=>'<button type="button" class="coverage-button '+(x.id===selected?'is-active':'')+'" data-scenario="'+x.id+'"><strong>'+e(x.name)+'</strong><span class="coverage-meta">'+e(x.group)+' · '+e((x.acceptance || []).join(', '))+'</span></button>').join('');
  document.querySelectorAll('button[data-width]').forEach(el=>{el.classList.toggle('is-active',el.dataset.width===ui.width);el.setAttribute('aria-pressed',String(el.dataset.width===ui.width));});
  const focus=drawer?'#close-context':ui.source?'.plan-projection-card:last-child h3':state.dialog?'[data-dialog-cancel]':ui.editor?'#answer-form input, #answer-form textarea, #answer-form select':q?'#choice-title':!c()&&!state.active?'#start-plan':'.plan-projection-card h3, #page-title';
  requestAnimationFrame(()=>{const thread=document.querySelector('.thread'),dock=document.querySelector('.composer-dock');if(thread&&dock)thread.style.paddingBottom=(dock.offsetHeight+28)+'px';(document.querySelector(ui.focus || focus) || document.querySelector(focus))?.focus({preventScroll:true});if(ui.restoreText){[...document.querySelectorAll('#prototype-canvas button')].find(b=>b.textContent===ui.restoreText)?.focus({preventScroll:true});ui.restoreText=null;}ui.focus=null;});
  save();
}
function save() {localStorage.setItem(storageKey,JSON.stringify({version:1,selected,variation,state,ui}));}
function reset(id=selected,v=variation) {
  selected=id;variation=v;state=seed(id,v);ui={...ui,editor:null,values:{},contextDrawer:false,editHub:false,source:null,error:'',daily:false,pausedEditor:null,planDetails:null,lastCommand:null,commandSerial:0,dialogFocus:null,restoreText:null};
  if(id==='custom-answer')ui.editor='goal';
  const url=new URL(location.href);url.searchParams.set('scenario',id);if(v)url.searchParams.set('variation',v);else url.searchParams.delete('variation');history.replaceState(null,'',url);render();
}
function run(action) {
  ui.error='';
  if(action.ui) {
    if(action.ui==='reset')return reset();
    if(action.ui==='finish-build'){let remaining=state.creation?.build?.weeks || 0;while(state.creation?.build&&state.creation.build.completed<state.creation.build.weeks&&remaining-->0)state=M.transition(state,{type:'build-next'});state=M.transition(state,{type:'build-finish'});}
    if(action.ui==='replay'){if(!ui.lastCommand&&state.changeHistory.at(-1)?.status==='cancelled'){const a={type:'cancel-change',id:state.changeHistory.at(-1).id,commandId:'fixture-cancel-retry'};state=M.transition(state,a);ui.lastCommand=a;}state=M.transition(state,ui.lastCommand || {type:'confirm-activate',commandId:'fixture-result-retry'});}
    if(action.ui==='retired-apply')state=M.transition(state,{type:'apply-change',id:state.changeHistory.at(-1)?.id || 'retired'});
    if(action.ui==='older-result')state=M.transition(state,{type:'request-change',intent:{kind:'ftp',ftp:220},expectedRevision:0,expectedSerial:0});
    if(action.ui==='refresh-preview')state=M.transition(state,{type:'request-change',intent:state.change?.intent || {kind:'weekday-duration',day:3,minutes:30}});
    if(action.ui==='fresh-evidence'){for(const [key,value] of Object.entries({guard:null,syncStale:false,evidenceMissing:false,fail:null,connected:true}))state=M.transition(state,{type:'set-fixture',key,value});state=M.transition(state,{type:'notice',text:'Sources are available again. Request a fresh preview before applying.'});}
    if(action.ui==='plan-details'){ui.planDetails=action.id;state=M.transition(state,{type:'navigate',destination:{kind:'library'}});}
    if(action.ui==='editor'){ui.editHub=false;ui.editor=action.key;ui.values={};if(!['change','supporting'].includes(action.key)&&c()&&M.nextQuestion(c())!==action.key)state=M.transition(state,{type:'edit',key:action.key});}
    if(action.ui==='back-editor'){const key=ui.editor,editing=c()?.editing,returnToDraft=editing&&c()?.draft;ui.editor=null;ui.values={};if(key){ui.focus='[data-editor-trigger="'+key+'"]';if(key==='change')ui.restoreText='Change one thing';}else {state=M.transition(state,{type:editing?'cancel-edit':'later'});if(returnToDraft)ui.restoreText='Edit answers';else ui.focus=editing?'#choice-title':'#coach-composer';}}
    if(action.ui==='edit-hub')ui.editHub=true;
    if(action.ui==='leave-hub'){ui.editHub=false;state=M.transition(state,{type:'cancel-edit'});ui.restoreText='Edit answers';}
    if(action.ui==='context'){if(ui.width==='compact'){ui.contextDrawer=!ui.contextDrawer;ui.focus=ui.contextDrawer?'#close-context':'#context-toggle';}else{ui.context=!ui.context;ui.focus='#context-toggle';}}
    if(action.ui==='source')ui.source=action.value || {Source:'Confirmed athlete limits',Confidence:'Based on confirmed details'};
    if(action.ui==='close-source')ui.source=null;
    if(action.ui==='daily')ui.daily=!ui.daily;
    if(action.ui==='send'){const text=document.getElementById('coach-composer').value.trim();if(text){state=M.transition(state,{type:'chat-message',text});const interpreted=M.interpret(text,state);if(['request-change','answer','commitment-edit'].includes(interpreted.type)||state.destination.kind==='change'){state=M.transition(state,interpreted);if(['answer','commitment-edit'].includes(interpreted.type)){state=M.transition(state,{type:'continue',id:interpreted.creationId});ui.pausedEditor=null;}}else state=M.transition(state,{type:'notice',text:'Your message is in Chat. Your unfinished planning work is unchanged.'});}}
  } else {
    if(action.type==='edit'){ui.editHub=false;ui.editor=null;}
    if(['later','navigate'].includes(action.type)&&c()&&(ui.editor||Object.keys(ui.values).length))ui.pausedEditor={key:ui.editor||c().editing||M.nextQuestion(c()),values:ui.values};
    if(['answer','later','back','continue','navigate','confirm-discard','cancel-edit'].includes(action.type)){ui.editor=null;ui.values={};}
    if(action.type==='continue'&&ui.pausedEditor){ui.editor=ui.pausedEditor.key;ui.values=ui.pausedEditor.values;ui.pausedEditor=null;}
    if(['answer','confirm-discard'].includes(action.type))ui.pausedEditor=null;
    if(action.type==='navigate'){ui.editHub=false;ui.contextDrawer=false;}
    if(action.type==='open-discard')ui.dialogFocus='Discard';
    if(action.type==='open-activate')ui.dialogFocus='Activate Plan';
    if(action.type==='close-plan')ui.dialogFocus='Stop Plan';
    if(action.type==='cancel-dialog')ui.restoreText=ui.dialogFocus || (state.dialog?.kind==='discard'?'Discard':state.dialog?.kind==='close'?'Stop Plan':'Activate Plan');
    if(['confirm-activate','apply-change','cancel-change','confirm-close'].includes(action.type)){action={...action,commandId:'fixture-command-'+(++ui.commandSerial || (ui.commandSerial=1))};ui.lastCommand=action;}
    const previous=state;state=M.transition(state,action);
    if(action.type==='commitment-cancel')state=M.transition(state,{type:'cancel-edit'});
    if(action.type==='answer'&&action.key==='mode'&&state.fixture.facts?.availability){state=M.answer(state,'availability',state.fixture.facts.availability.value,state.fixture.facts.availability.source);if(!state.creation.answers.baseline)state=M.answer(state,'baseline',state.fixture.facts.baseline.value,state.fixture.facts.baseline.source);}
    if(action.type==='confirm-discard'&&previous.creation&&!state.creation)ui.focus='#start-plan';
    if(action.type==='later')ui.focus='#coach-composer';
    if(action.type==='cancel-edit'){ui.editHub=!!state.creation?.draft;if(ui.editHub&&previous.creation?.editing)ui.focus='[aria-label="Edit '+labels[previous.creation.editing]+'"]';}
  }
  render();
}
document.addEventListener('click',event=>{
  const scenario=event.target.closest('[data-scenario]');if(scenario)return reset(scenario.dataset.scenario,'');
  const width=event.target.closest('button[data-width]');if(width){ui.width=width.dataset.width;ui.contextDrawer=false;render();return;}
  if(event.target.closest('#theme-toggle')){ui.theme=ui.theme==='dark'?'light':'dark';render();return;}
  const command=event.target.closest('[data-command]');if(command)run(actions[Number(command.dataset.command)]);
});
document.addEventListener('change',event=>{
  if(event.target.id==='scenario-select')reset(event.target.value,'');
  if(event.target.id==='variation-select')reset(selected,event.target.value);
  if(event.target.id==='failure-select'){const v=event.target.value;if(v==='stale-plan')run({type:'bump-plan-revision'});else if(v==='source-drift')run({type:'set-fixture',key:'sourceRevision',value:state.fixture.sourceRevision+1});else if(['race','taper','stale-sync'].includes(v))run({type:'set-fixture',key:'guard',value:v});else run({type:'set-fixture',key:'fail',value:v==='none'?null:v});}
  if(event.target.closest('#answer-form')&&['kind','operation','eventId'].includes(event.target.name)){ui.focus='#field-'+event.target.name;render();}
  if(event.target.id==='reduced-motion'){ui.reduced=event.target.checked;render();}
});
document.addEventListener('input',event=>{if(event.target.closest('#answer-form')){const data=new FormData(document.getElementById('answer-form'));ui.values=Object.fromEntries(data);ui.values.days=data.getAll('days');save();}});
document.addEventListener('submit',event=>{
  if(event.target.id!=='answer-form')return;
  event.preventDefault();
  const form=event.target,key=form.dataset.editor,data=Object.fromEntries(new FormData(form));
  let value;
  if(key==='goal')value={kind:'event',name:data.name.trim(),date:data.date,source:'your answer'};
  if(key==='success')value=data.success.trim();
  if(key==='availability')value={days:new FormData(form).getAll('days').map(Number),weeklyHours:Number(data.weeklyHours),longest:Number(data.longest),weekdayMinutes:Number(data.weekdayMinutes || data.longest),...(data.poolCount?{poolCount:Number(data.poolCount)}:{})};
  if(key==='start')value=data.start;
  if(key==='restriction')value={kind:data.kind,...(data.kind==='max-duration'?{minutes:Number(data.minutes)}:{}),...(data.end?{end:data.end}:{})};
  let action={type:'answer',key,value};
  if(key==='commitments')action={type:'commitment-edit',text:data.text};
  if(key==='change')action={type:'request-change',intent:{kind:data.kind,day:Number(data.day),minutes:Number(data.minutes),hours:Number(data.hours),ftp:Number(data.ftp),operation:data.operation,event:{id:state.active?.supportingEvents?.[0]?.id || 'support-river',name:data.name,date:data.date,role:data.role,source:state.active?.supportingEvents?.find(x=>x.id===data.eventId)?.source || 'Your answer',id:data.operation==='add'?'support-local':data.eventId}}};
  if(key==='supporting'){const event=state.fixture.events.find(x=>x.id===data.eventId);action={type:'answer',key:'supportingEvents',value:[...(c().answers.supportingEvents || []).filter(x=>x.id!==event.id),...(data.role==='Ignore for this Plan'?[]:[{...event,role:data.role}])]};}
  const next=M.transition(state,action);
  if(next.creation?.error || next.error || next.changeError){state=next;ui.error=next.creation?.error || next.error || next.changeError;render();return;}
  state=next;ui.editor=null;ui.values={};ui.error='';render();
});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'){event.preventDefault();if(state.dialog)run({type:'cancel-dialog'});else if(ui.contextDrawer&&ui.width==='compact')run({ui:'context'});else if(ui.source)run({ui:'close-source'});else if(ui.editor||document.querySelector('#answer-form'))run({ui:'back-editor'});else if(c())run({type:'later'});}
  const dialog=document.querySelector('[role="dialog"]');
  if(dialog&&event.key==='Tab'){const list=[...dialog.querySelectorAll('button:not(:disabled)')],first=list[0],last=list.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}
});
if(selected==='custom-answer'&&!ui.editor){ui.editor='goal';}
render();
})();
