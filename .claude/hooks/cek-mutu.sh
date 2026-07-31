#!/usr/bin/env bash
#
# Hook Stop — memeriksa mutu kode sebelum Claude boleh mengakhiri giliran.
#
# Inilah yang membuat "sudah selesai" tidak bisa diklaim sepihak: selama
# pemeriksaan tipe atau test masih gagal, giliran ditolak untuk berakhir.
#
# `npm run build` sengaja TIDAK diikutkan agar tiap giliran tidak melambat;
# build tetap dijaga oleh CI di setiap pull request.
#
# Kontrak hook:
#   - Keluaran: {"decision":"block","reason":…} bila pemeriksaan gagal.
#   - Exit 0 selalu; keputusan disampaikan lewat JSON di stdout.

set -u

AKAR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$AKAR" || exit 0

# Belum ada proyek Node (mis. repo baru) — tidak ada yang perlu diperiksa.
[ -f "$AKAR/package.json" ] || exit 0
[ -d "$AKAR/node_modules" ] || exit 0

# Mencegah gelung tak berujung: bila giliran ini sudah dilanjutkan oleh hook
# Stop sebelumnya, jangan memblokir untuk kedua kalinya.
masukan="$(cat)" || masukan=""
case "$masukan" in
  *'"stop_hook_active": true'* | *'"stop_hook_active":true'*) exit 0 ;;
esac

blokir() {
  if command -v python3 >/dev/null 2>&1; then
    printf '%s' "$1" | python3 -c '
import json, sys
alasan = sys.stdin.read()
print(json.dumps({"decision": "block", "reason": alasan}))
'
  else
    echo '{"decision":"block","reason":"Pemeriksaan mutu gagal. Jalankan: npm run typecheck && npm run test"}'
  fi
  exit 0
}

if ! keluaran="$(npm run --silent typecheck 2>&1)"; then
  blokir "Pemeriksaan tipe gagal. Perbaiki dulu sebelum mengakhiri giliran.

$(printf '%s' "$keluaran" | tail -40)"
fi

if ! keluaran="$(npm run --silent test 2>&1)"; then
  blokir "Ada test yang gagal. Perbaiki akar masalahnya — jangan menghapus atau melewati test.

$(printf '%s' "$keluaran" | tail -40)"
fi

exit 0
