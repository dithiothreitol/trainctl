/**
 * Chroniona regeneracja planu (ADR-033).
 *
 * `trainctl plan` na istniejącym planie liczył wszystko od zera z `trainctl.yaml`
 * i nadpisywał plik. Przepadały wtedy decyzje, które użytkownik świadomie
 * zatwierdził albo zapisał: baza objętości po `adapt --apply` (`loadState`),
 * przypięte dni, budżety czasu, skrócenia z `shorten --apply`, ręczne przesunięcia
 * — a dokumentowana ścieżka „nowy wynik → trainctl.yaml → plan" prowadziła
 * dokładnie tędy. Ochrona z ADR-029 obejmowała propozycje, nie regenerację.
 *
 * Zasady:
 *  - **ten sam cykl** (ten sam dystans celu, start jeszcze przed nami): makrocykl
 *    liczony od pierwotnej daty startu planu, więc granice faz zostają na miejscu;
 *    przesunięta data startu wydłuża albo skraca fazy tak, jak w scenariuszu
 *    „co jeśli" z README;
 *  - **nowy cykl** (zmieniony dystans albo start już za nami): makrocykl od dziś,
 *    wcześniejsze tygodnie zostają w pliku jako historia (o ile przylegają);
 *  - dni przeszłe, zalogowane, przypięte, ręcznie edytowane, zatwierdzone skrócenia
 *    i dni, w których nowa jednostka nie mieści się w zapisanym budżecie czasu,
 *    zostają bez zmian;
 *  - zatwierdzona baza (`loadState`) obowiązuje, dopóki użytkownik nie zmieni
 *    `athlete.recentWeeklyKm` w profilu — wtedy wygrywa profil; dzień jej
 *    zatwierdzenia zostaje, jak w propozycji, która zmienia dopiero dni po nim.
 */
import {
  addDays,
  estimateWorkoutMinutes,
  mondayOf,
  type Microcycle,
  type PlannedDay,
} from 'trainctl-core'
import type { TrainctlConfig } from './config.ts'
import { computePlan, dayFingerprint, scaleToBaseline, settleMixedWeek, type StoredPlan } from './planfile.ts'
import { clockToday } from './clock.ts'

export type ProtectionReason = 'past' | 'recorded' | 'pinned' | 'baseline' | 'approved' | 'edited' | 'budget'
export type RegenerationMode = 'same-cycle' | 'new-cycle'

export interface Regeneration {
  plan: StoredPlan
  mode: RegenerationMode
  /** Dni, które dostały nową treść. */
  changedDates: string[]
  /** Dni, które zmieniłyby się, ale zostały — z powodem. */
  protectedDays: { date: string; reason: ProtectionReason }[]
  /** Los zatwierdzonej bazy objętości. */
  loadState: 'kept' | 'cleared' | 'none'
  /** Tygodnie, które wypadły: po nowej, wcześniejszej dacie startu albo nieprzylegająca historia. */
  droppedWeeks: string[]
  /** Nic istotnego się nie zmienia — zapis niepotrzebny. */
  upToDate: boolean
}

/** Profil zmienia się w obrębie cyklu; dystans celu zmienia cykl. */
const sameDistance = (a: number, b: number) => Math.abs(a - b) < 0.001

/**
 * Część dystansu startu zapisana w dniu startu, od której start uznajemy za
 * odbyty (wartość inżynierska): rozruch przed przełożonym startem to kilka km,
 * start — prawie cały dystans, nawet z krótszym pomiarem zegarka.
 */
const RACE_DONE_SHARE = 0.8

export function rebuildPlan(
  existing: StoredPlan,
  config: TrainctlConfig,
  /** `raceDayKm` — leniwie: potrzebne tylko w dniu startu, a czyta dziennik i synchronizację. */
  opts: { today: string; recorded: Set<string>; raceDayKm?: () => number },
): Regeneration {
  const now = clockToday()
  const today = opts.today
  // Dzień startu jest „za nami" dopiero, gdy zapisano sam start (prawie cały
  // dystans) i cel się zmienił: rozruch przed przełożonym startem to nadal ten
  // sam cykl, a niezmieniony cel w dniu startu — zwykła regeneracja.
  const goalUnchanged = existing.goal.date === config.goal.date && sameDistance(existing.goal.distanceKm, config.goal.distanceKm)
  const raceDone = existing.goal.kind !== 'base' && existing.goal.date === now && !goalUnchanged &&
    (opts.raceDayKm?.() ?? 0) >= RACE_DONE_SHARE * existing.goal.distanceKm
  const raceBehind = existing.goal.date < now || raceDone
  const mode: RegenerationMode =
    !raceBehind && sameDistance(existing.goal.distanceKm, config.goal.distanceKm) ? 'same-cycle' : 'new-cycle'

  const ls = existing.loadState
  const keepLoad = ls !== undefined && (ls.profileWeeklyKm === undefined || ls.profileWeeklyKm === config.athlete.recentWeeklyKm)
  // Nowy cel po starcie: pozostałe tygodnie bloku przejściowego (R-8) zostają,
  // nowy cykl zaczyna się po nich — powrót do biegania nie przepada przez nowy plan.
  const lastTransition = existing.weeks.filter((w) => w.skeleton.phase === 'transition').at(-1)
  const afterTransition = raceBehind && lastTransition && lastTransition.weekStart >= mondayOf(today)
    ? addDays(lastTransition.weekStart, 7)
    : undefined
  const macroStart = mode === 'same-cycle' ? existing.generatedAt : afterTransition ?? today
  const loadState = keepLoad
    ? { ...ls!, effectiveFrom: mode === 'same-cycle' ? ls!.effectiveFrom : today, profileWeeklyKm: config.athlete.recentWeeklyKm }
    : undefined
  const existingDays = new Map(existing.weeks.flatMap((w) => w.days).map((d) => [d.date, d]))
  // skalowanie do zatwierdzonej bazy idzie PRZED budżetem czasu, który computePlan
  // stosuje raz, tymi samymi strefami co przy pierwszym planie (E-2). Plan bez bazy
  // (pełny, z budżetem) daje tygodnie sprzed decyzji — gotowe, jak w pierwotnym
  // planie — i rozstawienie siły z aktualnymi fazami (przesunięty start) oraz
  // `strength.days`. Propozycja przepisuje je z zapisanego planu, który ma właśnie
  // to, więc regeneracja tuż po `adapt --apply` odtwarza zatwierdzone dni.
  // Bez budżetu czasu tygodnie przed hakiem są tym samym planem (bez drugiego przebiegu).
  const unscaled = loadState && config.time ? computePlan(config, macroStart, today) : undefined
  const fresh = computePlan(config, macroStart, today, loadState
    ? {
        budgetFrom: mondayOf(loadState.effectiveFrom),
        beforeTimeBudget: (plan) => {
          plan.weeks = scaleToBaseline(plan.weeks, {
            baselineKm: loadState.baselineWeeklyKm, decidedOn: loadState.effectiveFrom, config, goal: plan.goal, vdot: plan.vdot,
            reference: unscaled?.weeks ?? plan.weeks,
          })
        },
      }
    : {})

  const minutesOf = (day: PlannedDay) =>
    (day.workout ? estimateWorkoutMinutes(day.workout, existing.preparationMinutes ?? 15) : 0) + (day.strength?.durationMin ?? 0)
  const protection = (before: PlannedDay, after: PlannedDay): ProtectionReason | undefined => {
    if (before.date < now) return 'past'
    if (opts.recorded.has(before.date)) return 'recorded'
    // dzień zatwierdzenia bazy: propozycja zmienia dopiero dni PO nim, więc
    // regeneracja w tym samym dniu też go nie rusza (inaczej „aktualny" plan by nie był)
    if (mode === 'same-cycle' && keepLoad && before.date <= ls!.effectiveFrom) return 'baseline'
    if (before.pinned) return 'pinned'
    if (before.timeAdjustment && before.timeAdjustment.origin !== 'profile') return 'approved'
    // Bez mapy odcisków (plan sprzed 0.2.0) edycji nie da się odróżnić od generacji.
    // Skrócenie z budżetu w profilu to generacja, nie edycja — odcisk go obejmuje.
    if (existing.generatedDays && existing.generatedDays[before.date] !== dayFingerprint(before)) return 'edited'
    const budget = existing.timeBudgets?.[before.date]
    if (budget !== undefined && minutesOf(after) > budget) return 'budget'
    return undefined
  }

  const freshStart = fresh.weeks[0]!.weekStart
  const freshEnd = fresh.weeks.at(-1)!.weekStart
  const droppedWeeks: string[] = []
  let history = existing.weeks.filter((w) => w.weekStart < freshStart)
  // Walidator wymaga ciągłości tygodni: historia, która nie przylega do nowego
  // cyklu, zostaje w gicie, nie w pliku.
  if (history.length && addDays(history.at(-1)!.weekStart, 7) !== freshStart) {
    droppedWeeks.push(...history.map((w) => w.weekStart))
    history = []
  }
  for (const w of existing.weeks) if (w.weekStart > freshEnd) droppedWeeks.push(w.weekStart)

  const changedDates: string[] = []
  const protectedDays: Regeneration['protectedDays'] = []
  const kept = new Set<string>()
  const weeks: Microcycle[] = history.map((w) => structuredClone(w))
  for (const fw of fresh.weeks) {
    const ew = existing.weeks.find((w) => w.weekStart === fw.weekStart)
    let replaced = false
    const days = fw.days.map((fd) => {
      const ed = existingDays.get(fd.date)
      if (!ed) {
        replaced = true
        return fd
      }
      const differs = dayFingerprint(ed) !== dayFingerprint(fd)
      const reason = protection(ed, fd)
      if (reason) {
        kept.add(fd.date)
        if (differs) protectedDays.push({ date: fd.date, reason })
        return structuredClone(ed)
      }
      if (differs) {
        changedDates.push(fd.date)
        replaced = true
      }
      return fd
    })
    // Tydzień w całości chroniony to historia: zostaje razem ze swoim szkieletem
    // (cel km, faza), inaczej `week` pokazywałby przeszłości cudzy cel.
    if (ew && !replaced && days.every((d) => kept.has(d.date))) {
      weeks.push(structuredClone(ew))
      continue
    }
    const week: Microcycle = { ...fw, days }
    settleMixedWeek(week)
    weeks.push(week)
  }

  const generatedDays: Record<string, string> = {}
  for (const day of weeks.flatMap((w) => w.days)) {
    generatedDays[day.date] = kept.has(day.date) || !fresh.weeks.some((w) => w.days.includes(day))
      ? existing.generatedDays?.[day.date] ?? dayFingerprint(day)
      : dayFingerprint(day)
  }
  const dates = new Set(weeks.flatMap((w) => w.days.map((d) => d.date)))
  const timeBudgets = Object.fromEntries(Object.entries(existing.timeBudgets ?? {}).filter(([date]) => dates.has(date)))
  const cycleStart = mode === 'same-cycle' ? existing.cycleStart : history.length ? freshStart : undefined
  const cycleWeeks = cycleStart ? weeks.filter((w) => w.weekStart >= cycleStart) : weeks

  const plan: StoredPlan = {
    ...fresh,
    generatedAt: macroStart,
    weeks,
    generatedDays,
    changes: [...existing.changes],
    peakKmPlanned: Math.max(...cycleWeeks.map((w) => w.totalKm)),
  }
  if (cycleStart) plan.cycleStart = cycleStart
  else delete plan.cycleStart
  if (loadState) plan.loadState = loadState
  else delete plan.loadState
  if (Object.keys(timeBudgets).length) plan.timeBudgets = timeBudgets
  if (existing.preparationMinutes !== undefined) plan.preparationMinutes = existing.preparationMinutes

  const sameWeeks = weeks.length === existing.weeks.length && weeks.every((w, i) => w.weekStart === existing.weeks[i]!.weekStart)
  const upToDate =
    changedDates.length === 0 &&
    droppedWeeks.length === 0 &&
    sameWeeks &&
    plan.vdot === existing.vdot &&
    JSON.stringify(plan.goal) === JSON.stringify(existing.goal) &&
    plan.locale === existing.locale &&
    plan.engineVersion === existing.engineVersion &&
    JSON.stringify(plan.loadState ?? null) === JSON.stringify(existing.loadState ?? null) &&
    // notatki siły tygodni to też treść planu (PLAN.md) — plan, który je zgubił, się naprawia
    JSON.stringify(weeks.map((w) => w.strengthNotes ?? null)) === JSON.stringify(existing.weeks.map((w) => w.strengthNotes ?? null))
  if (!upToDate) {
    plan.changes.push({
      at: now,
      action: 'regenerate',
      detail: `${mode}: ${changedDates.length} changed, ${protectedDays.length} kept`,
    })
  }
  return {
    plan,
    mode,
    changedDates,
    protectedDays,
    loadState: loadState ? 'kept' : ls ? 'cleared' : 'none',
    droppedWeeks,
    upToDate,
  }
}
