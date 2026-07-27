# Axiom — slå på loggning & larm (turnkey)

Koden är redan inkopplad (commit a676a01) men **avstängd** tills en token finns.
Gör stegen nedan i en sittning. Inget skickas förrän steg 2/4 är gjorda.

## 1. Skapa konto + dataset + token
1. Gå till https://axiom.co → skapa konto/logga in.
2. Skapa ett **dataset** med namnet `stadsvandring`.
3. Settings → API tokens → skapa en **ingest-token** (skrivrättighet). Kopiera den (`xaat-…`).

## 2. Slå på i webbappen (frontend)
Öppna `config.js` och fyll i (ersätt de tomma strängarna):
```js
export const AXIOM_DATASET = _ov('cfg_axiom_dataset') || 'stadsvandring';
export const AXIOM_TOKEN   = _ov('cfg_axiom_token')   || 'xaat-DIN-TOKEN';
```
Sen:
```bash
git commit -am "Axiom: slå på ingest" && vercel --prod --yes
```
> ⚠️ Klient-token blir **publik** (den ligger i webbläsaren) men kan enbart SKRIVA
> till detta enda dataset. Därför ett separat dataset — rotera token vid behov.
> Vill du testa på din egen enhet först utan att committa:
> `localStorage.setItem('cfg_axiom_token','xaat-…'); localStorage.setItem('cfg_axiom_dataset','stadsvandring')`

Nu flödar appens händelser (`app_open`, `tour_start`, `paywall_shown`, `city_change`,
`near_me_city`, …) + JS-fel (`js_error`) in till Axiom.

## 3. Vercel Log Drain (0 kod — fångar alla funktions-/edge-/deploy-loggar)
Vercel → ditt projekt → **Integrations** → sök **Axiom** → installera/koppla projektet.
Klart. Nu ser du 5xx, kraschar och build-fel samlat.

## 4. Köp-loggning (edge, server-side — token som secret, ALDRIG i klienten)
I stadsvandrings Supabase (kräver din projekt-åtkomst):
```bash
supabase secrets set AXIOM_TOKEN=xaat-DIN-TOKEN AXIOM_DATASET=stadsvandring
supabase functions deploy stripe-webhook
```
`stripe-webhook` loggar då signaturfel, lyckade köp/prenumerationer och hanteringsfel.

---

## 5. Larm (Monitors) — skapa BARA dessa två
Axiom → **Monitors** → New monitor → typ **Threshold** → klistra in APL, sätt villkor,
välj notifikation (mejl/Slack).

### A. Webhook-fel — tappade köp (intäktsförsäkring)
```apl
['stadsvandring']
| where source == "stripe-webhook" and (kind == "webhook_signature_fail" or kind == "webhook_handler_error")
| summarize count() by bin_auto(_time)
```
- **Tidsfönster:** 5 minuter · **Villkor:** `count` **≥ 1** → larma.
- Betydelse: en kund kan ha betalat men webhooken avvisades. Åtgärda direkt.

### B. Sajten nere — inga öppningar senaste timmen
```apl
['stadsvandring']
| where kind == "event" and name == "app_open"
| summarize count() by bin(_time, 1h)
```
- **Tidsfönster:** 1 timme · **Villkor:** `count` **< 1** (below) → larma.
- Betydelse: 0 app-öppningar en hel timme = sajten/något är nere.

> Håll det vid dessa två. Fler larm = brus; ett larm du ignorerar är värre än inget.
> (Valfritt senare: JS-fel-spik — `where kind=="event" and name=="js_error" | summarize count()`,
> larma vid ovanligt hög nivå. Lägg till först om du vill.)

## Dashboard (valfritt, 5 min)
En funnel: `app_open` → `city_change`/`near_me_city` → `paywall_shown` → köp.
Bygg som stapel/tidsserie i Axiom på samma dataset — visar var folk hoppar av.
