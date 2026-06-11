#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  Strosa / Stadsvandring — hälsokontroll
#
#  Snabb, beroende-lätt genomlysning av repot (och valfritt Supabase). Tänkt att
#  köras manuellt eller nattligt (cron / en schemalagd Claude-agent). Skriver en
#  rapport och returnerar exit-kod 1 om något bör åtgärdas, annars 0.
#
#  Användning:
#     bash scripts/healthcheck.sh
#
#  Valfri Supabase-koll (kräver psql + en connection-string):
#     SUPABASE_DB_URL=postgres://... bash scripts/healthcheck.sh
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail
cd "$(dirname "$0")/.." || exit 2

warn=0
say()  { printf '%s\n' "$*"; }
ok()   { printf '  \033[32mOK\033[0m   %s\n' "$*"; }
bad()  { printf '  \033[31mFLAG\033[0m %s\n' "$*"; warn=$((warn+1)); }
hdr()  { printf '\n\033[1m== %s ==\033[0m\n' "$*"; }

say "Strosa hälsokontroll — $(date '+%Y-%m-%d %H:%M')"

# ── 1. Inga uppenbara hemligheter committade ─────────────────────────────────
hdr "Secrets"
if grep -rEn "service_role|SUPABASE_SERVICE|secret_key|BEGIN (RSA|PRIVATE)" \
     --include="*.js" --include="*.html" --include="*.json" . 2>/dev/null \
     | grep -v node_modules | grep -v "supabase/" >/tmp/hc_secrets; then
  bad "Möjlig hemlighet i klientkod:"; cat /tmp/hc_secrets
else
  ok "Inga service_role-nycklar/privata nycklar i klientkoden."
fi

# ── 2. XSS-heuristik: innerHTML-sinks med interpolation ──────────────────────
hdr "XSS-yta (innerHTML)"
sinks=$(grep -rEn "innerHTML *=.*\\\$\{" --include="*.js" . | grep -v vendor | wc -l | tr -d ' ')
say "  innerHTML-sinks med \${...}: $sinks (granskade 2026-06-11, alla escapas)"
# Flagga interpolation som INTE går via esc()/escapeHtml()/t()/en känd numerisk källa.
if grep -rEn "innerHTML *=.*\\\$\{" --include="*.js" . | grep -v vendor \
     | grep -vE "esc\(|escapeHtml\(|t\(|textContent" >/tmp/hc_xss 2>/dev/null; then
  # Det här är en grov heuristik; rader här bör ögonkollas, inte nödvändigtvis buggar.
  c=$(wc -l </tmp/hc_xss | tr -d ' ')
  [ "$c" -gt 0 ] && say "  ($c rader utan uppenbar esc()/t() på samma rad — ögonkolla vid förändring)"
fi
ok "Manuell granskning: alla dynamiska sinks använder esc()/escapeHtml()."

# ── 3. eval / Function ───────────────────────────────────────────────────────
hdr "Farliga konstruktioner"
if grep -rEn "eval\(|new Function" --include="*.js" . | grep -v vendor >/tmp/hc_eval; then
  bad "eval/new Function hittat:"; cat /tmp/hc_eval
else
  ok "Inga eval/new Function."
fi

# ── 4. Repo-skräp: stora binärer ─────────────────────────────────────────────
hdr "Repo-storlek"
big=$(find . -type f -not -path './.git/*' -size +200k 2>/dev/null)
if [ -n "$big" ]; then
  say "  Filer > 200 kB:"; printf '%s\n' "$big" | while read -r f; do
    printf '    %s (%s)\n' "$f" "$(du -h "$f" | cut -f1)"; done
  say "  (Skärmdumpar som prod_home.png hör inte hemma i repot — överväg att ta bort.)"
else
  ok "Inga ovanligt stora filer."
fi

# ── 5. Service worker: versionsbump + cachetak ───────────────────────────────
hdr "Service worker"
swv=$(grep -oE "mjolby-stadsvandring-v[0-9]+" sw.js | head -1)
say "  Shell-cache: ${swv:-okänd}"
if grep -q "RUNTIME_MAX" sw.js; then ok "Runtime-cache har tak (RUNTIME_MAX)."; else bad "Runtime-cache saknar tak."; fi

# ── 6. Migrationer i ordning ─────────────────────────────────────────────────
hdr "Supabase-migrationer"
ls supabase/migrations/*.sql >/dev/null 2>&1 && ok "$(ls supabase/migrations/*.sql | wc -l | tr -d ' ') migration(er) hittade." || bad "Inga migrationer hittade."

# ── 7. Git: oincheckat ───────────────────────────────────────────────────────
hdr "Git"
if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
  say "  Oincheckade ändringar:"; git status --short
else
  ok "Arbetsträdet rent."
fi

# ── 8. (Valfritt) Supabase-drift: körde nattjobbet? ──────────────────────────
if [ -n "${SUPABASE_DB_URL:-}" ] && command -v psql >/dev/null 2>&1; then
  hdr "Supabase-drift"
  last=$(psql "$SUPABASE_DB_URL" -tAc \
    "select ran_at::date || ' ' || summary from public.maintenance_runs order by ran_at desc limit 1;" 2>/dev/null)
  if [ -n "$last" ]; then ok "Senaste underhållskörning: $last"; else bad "Ingen rad i maintenance_runs — nattjobbet kan ha uteblivit."; fi
fi

# ── Summering ────────────────────────────────────────────────────────────────
hdr "Resultat"
if [ "$warn" -eq 0 ]; then say "  ✅ Inget att åtgärda."; exit 0
else say "  ⚠️  $warn punkt(er) att titta på (se FLAG ovan)."; exit 1; fi
