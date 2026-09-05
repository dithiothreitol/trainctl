export interface MobileWorkout {
  lang: string
  title: string
  date: string
  goal: string
  kind: string
  distance: string
  duration: string
  purpose: string
  steps: string[]
  rules: string[]
  strength?: string
  labels: { mobileSteps: string; mobilePurpose: string; mobileWhy: string; mobileStrength: string; mobileSnapshot: string }
}

const escapeHtml = (text: string): string => text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

/** Standalone, offline HTML: no scripts, trackers, fonts or external requests. */
export function toMobileHtml(input: MobileWorkout): string {
  const e = escapeHtml
  const l = input.labels
  return `<!doctype html>
<html lang="${e(input.lang)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark"><title>${e(input.title)} · ${e(input.date)}</title>
<style>
:root{font-family:system-ui,sans-serif;color:#172b26;background:#f3f5ef;color-scheme:light}*{box-sizing:border-box}body{margin:0;padding:24px 16px 40px}main{max-width:640px;margin:auto}header{border-bottom:2px solid #315c4b;padding-bottom:24px}.brand{font-size:.85rem;font-weight:800;letter-spacing:.12em;color:#315c4b}h1{font-size:clamp(2rem,9vw,3.5rem);line-height:1.1;margin:12px 0;overflow-wrap:anywhere}h2{font-size:1.15rem;margin:0 0 16px}.meta{display:flex;gap:12px;flex-wrap:wrap;font-size:1.15rem;font-weight:700}.muted,footer{color:#4e645a;line-height:1.6}section{background:#fff;border:1px solid #dce4da;border-radius:16px;padding:22px;margin:18px 0}ol{padding-left:24px;margin:0}li{padding:0 0 16px 8px;line-height:1.6;overflow-wrap:anywhere}li:last-child{padding-bottom:0}li::marker{font-weight:800;color:#315c4b}p{line-height:1.6;overflow-wrap:anywhere}summary{cursor:pointer;font-weight:700;padding:4px 0;min-height:44px}ul{padding-left:18px}footer{font-size:.85rem;margin-top:24px}@media(prefers-color-scheme:dark){:root{color:#edf3ec;background:#14251f;color-scheme:dark}section{background:#1c3128;border-color:#355143}.brand,.muted,footer,li::marker{color:#bad4bf}}@media print{body{padding:0}section{break-inside:avoid}details>*{display:block}}
</style></head><body><main><header><div class="brand">TRAINCTL</div><p class="muted">${e(input.date)} · ${e(input.goal)}</p><h1>${e(input.kind)}</h1><div class="meta"><span>${e(input.distance)}</span></div><p class="muted">${e(input.duration)}</p></header>
<section aria-label="${e(l.mobileSteps)}"><h2>${e(l.mobileSteps)}</h2><ol>${input.steps.map((step) => `<li>${e(step)}</li>`).join('')}</ol></section>
<section><h2>${e(l.mobilePurpose)}</h2><p>${e(input.purpose)}</p></section>
${input.strength ? `<section><h2>${e(l.mobileStrength)}</h2><p>${e(input.strength)}</p></section>` : ''}
<section><details><summary>${e(l.mobileWhy)}</summary><ul>${input.rules.map((rule) => `<li>${e(rule)}</li>`).join('')}</ul></details></section>
<footer>${e(l.mobileSnapshot)}</footer></main></body></html>`
}
