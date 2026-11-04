import { coachText as t } from './coaching.ts'
import type { EnduranceSport, SessionContext, SessionPurpose, SportProfile } from './types.ts'

/** Explicit engineering recipes, not individually validated physiological prescriptions. MS-6. */
export interface WorkoutRecipe {
  id: string; title: string; objective: string; rpe: [number, number]
  workSec?: number; recoverySec?: number; maxRepeats?: number
  ftpPercent?: number; cssOffset?: number; lengths?: number
}
export function recipeRationale(r: WorkoutRecipe, p: SportProfile): string {
  const level=p.experience==='trained'?t('wytrenowany','trained'):p.experience==='regular'?t('regularnie trenujący','regular'):t('początkujący lub nieokreślony','new or unspecified')
  const reason=r.id.endsWith('-race')?t('Start pozostaje osobnym wydarzeniem; jego dystans i czas pochodzą z celu, a nie z dawki tygodniowego szablonu.','The race remains a separate event; its distance and duration come from the goal, not the weekly training template.')
    :r.id==='bike-aerobic-power'||r.id==='bike-threshold'||r.id==='swim-controlled-speed'
    ?t('Krótszy dystans celu i zadeklarowane wytrenowanie pozwalają wybrać krótką, ograniczoną serię mocniejszych odcinków.','The shorter event distance and declared training experience allow a short, bounded set of harder repetitions.')
    :r.id==='bike-sustained'?t('Dłuższy cel lub poziom regularny preferuje kontrolowaną pracę podprogową zamiast bardzo mocnych odcinków.','A longer event or regular experience favours controlled subthreshold work over very hard repetitions.')
    :r.id.includes('technique')?t('Ćwiczenie izoluje jedną umiejętność, a następująca po nim część główna przenosi ją do zwykłego ruchu.','The drill isolates a skill; the following main set transfers it to normal movement.')
    :r.id.includes('openers')?t('Przed startem liczba odcinków jest mała; dodatkowy czas pozostaje spokojny.','Before the event there are few repetitions; additional time stays easy.')
    :r.id==='bike-tempo'?t('Baza lub lżejszy tydzień preferuje umiarkowaną moc i pełne przerwy.','Base or a lighter week favours moderate power and full recoveries.')
    :r.id==='swim-css-repeats'?t('Powtarzane długości z przerwami pozwalają ćwiczyć równe tempo bez wymuszania jednego długiego odcinka.','Repeated lengths with rests practise even pacing without requiring one long continuous effort.')
    :r.id==='swim-timed-repeats'?t('Bez aktualnego CSS czas i RPE określają mocniejsze odcinki; przerwy pozwalają odzyskać kontrolę oddechu i techniki.','Without current CSS, time and RPE guide the harder repetitions; rests allow breathing and technique to recover.')
    :r.id==='run-controlled-repeats'?t('Krótkie odcinki z przerwami pozwalają ćwiczyć równy, mocniejszy wysiłek. Tempo wynika z aktualnego wyniku biegowego, a przy jego braku prowadzi RPE.','Short repetitions with recoveries practise an even, harder effort. Pace comes from a current running result; otherwise RPE guides the effort.')
    :t('Spokojna intensywność pozwala rozwijać regularność i technikę bez dodawania kolejnego akcentu.','Easy intensity develops consistency and technique without adding another hard session.')
  return t('Doświadczenie: ','Experience: ')+level+'. '+reason
}
export function selectRecipe(sport: EnduranceSport, purpose: SessionPurpose, p: SportProfile, c: SessionContext): WorkoutRecipe {
  const phase = c.phase ?? 'build', week = Math.max(0, c.weekIndex ?? 0)
  const reduced = phase === 'deload' || phase === 'recovery', trained = p.experience === 'trained'
  const distance = c.goal?.sport === sport ? c.goal.distanceM : c.goal?.legs?.filter(l=>l.sport===sport).reduce((n,l)=>n+l.distanceM,0)
  const shortRace = !!distance && distance <= (sport === 'bike' ? 40000 : sport === 'swim' ? 1500 : 10000)
  const progression = reduced || phase === 'taper' ? 0 : Math.min(2, week % 4)
  if (purpose === 'race') return {id:`${sport}-race`,title:t('Start','Race'),objective:t('Zrealizuj cel startowy według osobnego planu tempa i warunków na trasie.','Execute the event goal using a separate pacing plan and course conditions.'),rpe:[4,8]}
  if (c.brick) return {id:`${sport}-brick`,title:t(sport==='bike'?'Rower przed zakładką':'Bieg po rowerze',sport==='bike'?'Bike before transition':'Run off the bike'),objective:t(sport==='bike'?'Utrzymaj równy wysiłek i zakończ rower z zapasem na bieg.':'Przećwicz przejście do biegu; zacznij spokojnie i ustabilizuj krok.',sport==='bike'?'Hold an even effort and finish with reserves for the run.':'Practise running after cycling; start gently and settle into your stride.'),ftpPercent:65,cssOffset:12,rpe:[3,4]}
  if (purpose === 'intervals' && sport === 'bike') {
    if (phase === 'taper') return {id:'bike-openers',title:t('Krótkie pobudzenie','Short openers'),objective:t('Podtrzymaj rytm intensywniejszej jazdy przy małej dawce pracy.','Maintain the rhythm of harder riding with a small work dose.'),workSec:60,recoverySec:120,maxRepeats:3,ftpPercent:100,rpe:[6,7]}
    if (phase === 'base' || reduced) return {id:'bike-tempo',title:t('Kontrolowane tempo','Controlled tempo'),objective:t('Rozwijaj utrzymanie równomiernego, umiarkowanego wysiłku.','Develop sustained, even moderate effort.'),workSec:360,recoverySec:120,maxRepeats:reduced?2:3+progression,ftpPercent:80,rpe:[5,6]}
    if (trained && shortRace && week % 2 === 0) return {id:'bike-aerobic-power',title:t('Moc tlenowa: krótkie odcinki','Aerobic power: short repetitions'),objective:t('Rozwijaj tolerancję powtarzanych mocnych odcinków bez sprintowania.','Develop repeatable hard efforts without sprinting.'),workSec:180,recoverySec:180,maxRepeats:4+Math.min(1,progression),ftpPercent:110,rpe:[7,8]}
    if (trained && shortRace) return {id:'bike-threshold',title:t('Odcinki progowe','Threshold repetitions'),objective:t('Ćwicz równą moc blisko FTP, bez spadku jakości kolejnych odcinków.','Practise even power near FTP without fading across repetitions.'),workSec:360,recoverySec:180,maxRepeats:3+Math.min(1,progression),ftpPercent:95,rpe:[6,7]}
    return {id:'bike-sustained',title:t('Dłuższe odcinki podprogowe','Sustained subthreshold repetitions'),objective:t('Rozwijaj zdolność utrzymania mocnej, kontrolowanej jazdy przez dłuższy czas.','Develop sustained, strong but controlled riding.'),workSec:480,recoverySec:180,maxRepeats:3+Math.min(1,progression),ftpPercent:88,rpe:[5,6]}
  }
  if (purpose === 'intervals' && sport === 'swim') {
    if (phase === 'taper') return {id:'swim-openers',title:t('Krótkie odcinki przed startem','Short pre-race repetitions'),objective:t('Zachowaj czucie tempa i świeżość przy małej liczbie odcinków.','Maintain pace awareness and freshness with few repetitions.'),lengths:2,cssOffset:0,recoverySec:30,maxRepeats:4,rpe:[5,6]}
    if (trained && shortRace && phase === 'build' && week % 2 === 0) return {id:'swim-controlled-speed',title:t('Szybkość z kontrolą techniki','Controlled speed'),objective:t('Utrzymuj sprawny chwyt wody i rytm przy krótkich, mocnych odcinkach.','Keep an effective catch and rhythm during short, hard repetitions.'),lengths:1,cssOffset:-4,recoverySec:30,maxRepeats:8+progression*2,rpe:[6,7]}
    return {id:'swim-css-repeats',title:t('Równe odcinki w pobliżu CSS','Even repetitions near CSS'),objective:t('Ćwicz powtarzalne tempo i technikę na kolejnych odcinkach.','Practise repeatable pace and technique across repetitions.'),lengths:4,cssOffset:phase==='base'||reduced?5:2,recoverySec:20,maxRepeats:reduced?4:(trained?10:6)+progression,rpe:[5,6]}
  }
  if (purpose === 'technique') return {id:`${sport}-technique-${week%2===0?'alignment':'rhythm'}`,title:t('Technika i spokojny rytm','Technique and relaxed rhythm'),objective:t(sport==='swim'?'Popraw pozycję ciała, wydech i spokojny powrót ramienia, następnie przenieś je do kraula.':'Ćwicz swobodny, równy ruch bez zwiększania wysiłku.',sport==='swim'?'Improve alignment, exhalation and relaxed arm recovery, then transfer the skill to freestyle.':'Practise smooth, even movement without increasing effort.'),cssOffset:18,ftpPercent:60,lengths:2,rpe:[2,4]}
  if (purpose === 'intervals') return {id:'run-controlled-repeats',title:t('Kontrolowane odcinki biegowe','Controlled running repetitions'),objective:t('Ćwicz utrzymanie równego tempa w odcinkach z pełną kontrolą kroku.','Practise even-paced repetitions with controlled running form.'),workSec:180,recoverySec:120,maxRepeats:4+Math.min(1,progression),rpe:[6,7]}
  const long = purpose === 'long'
  return {id:`${sport}-${long?'endurance':reduced?'recovery':'easy'}`,title:long?t('Spokojna wytrzymałość długotrwała','Easy endurance'):t('Spokojny trening tlenowy','Easy aerobic training'),objective:long?t('Wydłużaj czas utrzymania swobodnego wysiłku i stabilnej techniki.','Extend comfortable effort while maintaining stable technique.'):t('Buduj wytrzymałość tlenową bez dużego zmęczenia.','Build aerobic endurance without accumulating heavy fatigue.'),ftpPercent:reduced?55:65,cssOffset:reduced?20:12,lengths:long?8:4,rpe:reduced?[2,3]:[3,4]}
}
