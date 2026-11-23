#!/usr/bin/env bash
# Smoke test for the document API (HTTP layer: auth cookie, status codes, sharing, import).
# Note: the Next.js route handlers need the Next runtime (cookies()), so they are covered here
# rather than in `npm test`, which unit-tests the logic underneath them (access, shares, import, validation).
# Usage: BASE=http://localhost:3000 ./scripts/api-smoke.sh
BASE=${BASE:-http://localhost:3000}
fail=0
# Sign in once per user (demo password) and reuse the signed session cookie.
PW=${DEMO_PASSWORD:-ajaia-demo}
declare -A COOKIE
login() { # user id -> cookie value
  local id=$1; [ -n "${COOKIE[$id]}" ] && return
  local email="${id#u_}@example.com"
  COOKIE[$id]=$(curl -s -D - -o /dev/null -X POST "$BASE/api/auth/login" -H 'content-type: application/json' \
    -d "{\"email\":\"$email\",\"password\":\"$PW\"}" | tr -d '\r' | sed -n 's/^set-cookie: uid=\([^;]*\).*/\1/Ip' | head -1)
}
req() { # name expected method path user [body]
  local name=$1 want=$2 method=$3 path=$4 user=$5 body=$6
  local args=(-s -o /tmp/smoke.out -w '%{http_code}' -X "$method" "$BASE$path")
  if [ -n "$user" ]; then login "$user"; args+=(-b "uid=${COOKIE[$user]}"); fi
  [ -n "$body" ] && args+=(-H 'content-type: application/json' -d "$body")
  local got; got=$(curl "${args[@]}")
  if [ "$got" = "$want" ]; then echo "PASS $name ($got)"; else echo "FAIL $name: want $want got $got: $(cat /tmp/smoke.out)"; fail=1; fi
}
req "no cookie -> 401"            401 GET  /api/documents ""
req "wrong password -> 401"       401 POST /api/auth/login "" '{"email":"alice@example.com","password":"nope"}'
req "unknown email -> 401"        401 POST /api/auth/login "" '{"email":"zed@example.com","password":"x"}'
curl -s -o /dev/null -w '%{http_code}' -b 'uid=u_alice' "$BASE/api/documents" | grep -q 401 && echo "PASS unsigned uid=u_alice rejected" || { echo "FAIL unsigned cookie accepted"; fail=1; }
req "users list needs sign-in"    401 GET  /api/users ""
req "alice creates"               201 POST /api/documents u_alice '{"title":"Smoke doc"}'
ID=$(sed -E 's/.*"id":"([^"]+)".*/\1/' /tmp/smoke.out)
req "carol cannot see (404)"      404 GET  /api/documents/$ID u_carol
req "bob (no share) 404"          404 GET  /api/documents/$ID u_bob
# grant bob edit directly in SQL-free way is not possible yet (sharing API comes later), so use the seeded shared doc:
req "bob views seeded shared doc" 200 GET  /api/documents/d_sample u_bob
grep -q '"access":"edit"' /tmp/smoke.out && echo "PASS bob access=edit" || { echo "FAIL bob access"; fail=1; }
req "bob edits title"             200 PATCH /api/documents/d_sample u_bob '{"title":"Edited by Bob"}'
req "bob edits content"           200 PATCH /api/documents/d_sample u_bob '{"content":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"hi"}]}]}}'
req "bob cannot delete (403)"     403 DELETE /api/documents/d_sample u_bob
req "carol cannot patch (404)"    404 PATCH /api/documents/d_sample u_carol '{"title":"x"}'
# restore the seeded doc so the script leaves demo data untouched
req "restore seeded doc"             200 PATCH /api/documents/d_sample u_alice '{"title":"Welcome to Ajaia Docs","content":{"type":"doc","content":[{"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"Welcome to Ajaia Docs"}]},{"type":"paragraph","content":[{"type":"text","text":"This sample document is owned by Alice and shared with Bob."}]}]}}'
req "empty title -> 400"          400 PATCH /api/documents/$ID u_alice '{"title":"   "}'
req "bad content -> 400"          400 PATCH /api/documents/$ID u_alice '{"content":{"type":"nope"}}'
req "unknown field -> 400"        400 PATCH /api/documents/$ID u_alice '{"owner_id":"u_bob"}'
req "empty patch -> 400"          400 PATCH /api/documents/$ID u_alice '{}'
req "invalid json -> 400"         400 PATCH /api/documents/$ID u_alice 'not json'
req "alice lists docs"            200 GET  /api/documents u_alice
grep -q '"owned"' /tmp/smoke.out && grep -q "Smoke doc" /tmp/smoke.out && echo "PASS list has owned doc" || { echo "FAIL list"; fail=1; }
req "bob list has shared"         200 GET  /api/documents u_bob
grep -q '"permission":"edit"' /tmp/smoke.out && echo "PASS bob shared list" || { echo "FAIL bob shared list"; fail=1; }
# --- sharing ---
req "bob cannot POST shares (404, no access yet)" 404 POST /api/documents/$ID/shares u_bob '{"email":"carol@example.com","permission":"view"}'
req "alice shares with bob (edit)"   201 POST /api/documents/$ID/shares u_alice '{"email":"Bob@Example.com ","permission":"edit"}'
req "bob can now GET"                200 GET  /api/documents/$ID u_bob
req "bob PATCH as editor"            200 PATCH /api/documents/$ID u_bob '{"title":"Bob edit"}'
req "bob cannot manage shares (403)" 403 POST /api/documents/$ID/shares u_bob '{"email":"carol@example.com","permission":"view"}'
req "bob cannot list shares (403)"   403 GET  /api/documents/$ID/shares u_bob
req "alice downgrades bob to view"   201 POST /api/documents/$ID/shares u_alice '{"email":"bob@example.com","permission":"view"}'
req "bob PATCH now 403"              403 PATCH /api/documents/$ID u_bob '{"title":"nope"}'
req "bob GET access=view"            200 GET  /api/documents/$ID u_bob
grep -q '"access":"view"' /tmp/smoke.out && echo "PASS bob access=view" || { echo "FAIL bob access=view"; fail=1; }
req "carol still 404"                404 GET  /api/documents/$ID u_carol
req "unknown email -> 404"           404 POST /api/documents/$ID/shares u_alice '{"email":"nobody@example.com","permission":"view"}'
req "self share -> 400"              400 POST /api/documents/$ID/shares u_alice '{"email":"alice@example.com","permission":"view"}'
req "bad email -> 400"               400 POST /api/documents/$ID/shares u_alice '{"email":"not-an-email","permission":"view"}'
req "bad permission -> 400"          400 POST /api/documents/$ID/shares u_alice '{"email":"bob@example.com","permission":"admin"}'
req "unknown field -> 400"           400 POST /api/documents/$ID/shares u_alice '{"email":"bob@example.com","permission":"view","x":1}'
req "alice PATCH bob to edit"        200 PATCH /api/documents/$ID/shares/u_bob u_alice '{"permission":"edit"}'
req "alice lists shares"             200 GET  /api/documents/$ID/shares u_alice
grep -q '"permission":"edit"' /tmp/smoke.out && echo "PASS share list shows edit" || { echo "FAIL share list"; fail=1; }
req "owned list shows share_count"   200 GET  /api/documents u_alice
grep -q '"share_count":1' /tmp/smoke.out && echo "PASS share_count=1" || { echo "FAIL share_count"; fail=1; }
req "alice removes bob"              200 DELETE /api/documents/$ID/shares/u_bob u_alice
req "bob now 404"                    404 GET  /api/documents/$ID u_bob
req "remove again -> 404"            404 DELETE /api/documents/$ID/shares/u_bob u_alice
# --- import ---
FIX="$(dirname "$0")/../tests/fixtures"
impreq() { # name want file user [filename]
  local args=(-s -o /tmp/smoke.out -w '%{http_code}' -F "file=@$3${5:+;filename=$5}" "$BASE/api/documents/import")
  if [ -n "$4" ]; then login "$4"; args+=(-b "uid=${COOKIE[$4]}"); fi
  local got; got=$(curl "${args[@]}")
  if [ "$got" = "$2" ]; then echo "PASS $1 ($got)"; else echo "FAIL $1: want $2 got $got: $(cat /tmp/smoke.out)"; fail=1; fi
}
IMPORTED=()
for f in sample.txt sample.md sample.docx; do
  impreq "import $f" 201 "$FIX/$f" u_alice
  IMPORTED+=("$(sed -E 's/.*"id":"([^"]+)".*/\1/' /tmp/smoke.out)")
done
impreq "import bad extension -> 400" 400 "$FIX/sample.txt" u_alice "evil.exe"
impreq "import no cookie -> 401"     401 "$FIX/sample.txt" ""
for i in "${IMPORTED[@]}"; do req "cleanup imported doc" 200 DELETE /api/documents/$i u_alice; done
req "alice deletes"               200 DELETE /api/documents/$ID u_alice
req "deleted -> 404"              404 GET  /api/documents/$ID u_alice
exit $fail
