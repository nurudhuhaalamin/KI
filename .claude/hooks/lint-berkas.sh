#!/usr/bin/env bash
#
# Hook PostToolUse untuk Edit/Write — menjalankan ESLint pada berkas yang
# baru saja disunting. Galat dikembalikan ke Claude agar langsung diperbaiki,
# bukan menumpuk sampai CI.
#
# Kontrak hook:
#   - Masukan  : JSON dari stdin (berisi .tool_input.file_path).
#   - Exit 0   : berkas bersih, atau bukan berkas yang perlu diperiksa.
#   - Exit 2   : ESLint menemukan galat; stderr dibaca Claude sebagai umpan balik.
#
# Prinsip fallback aman: kegagalan membaca masukan atau ESLint yang tidak
# terpasang berakhir exit 0, supaya hook tidak pernah memblokir pekerjaan
# yang sah hanya karena dirinya sendiri bermasalah.

set -u

AKAR="${CLAUDE_PROJECT_DIR:-$(pwd)}"

masukan="$(cat)" || exit 0
[ -n "$masukan" ] || exit 0

ambil_path() {
  if command -v python3 >/dev/null 2>&1; then
    printf '%s' "$masukan" | python3 -c '
import json, sys
try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(0)
if isinstance(data, dict):
    tool_input = data.get("tool_input")
    if isinstance(tool_input, dict):
        berkas = tool_input.get("file_path")
        if isinstance(berkas, str):
            sys.stdout.write(berkas)
' 2>/dev/null
    return
  fi
  printf '%s' "$masukan" \
    | tr '\n' ' ' \
    | sed -n 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p'
}

berkas="$(ambil_path)" || exit 0
[ -n "$berkas" ] || exit 0
[ -f "$berkas" ] || exit 0

# Hanya berkas TypeScript/JavaScript di dalam proyek yang diperiksa.
case "$berkas" in
  *.ts|*.tsx|*.js|*.jsx) ;;
  *) exit 0 ;;
esac
case "$berkas" in
  */node_modules/*|*/build/*|*/.wrangler/*|*/.react-router/*) exit 0 ;;
esac

[ -x "$AKAR/node_modules/.bin/eslint" ] || exit 0

hasil="$("$AKAR/node_modules/.bin/eslint" --format stylish "$berkas" 2>&1)"
kode=$?

if [ "$kode" -ne 0 ]; then
  {
    echo "ESLint menemukan masalah pada $berkas:"
    echo "$hasil"
    echo
    echo "Perbaiki galat di atas sebelum melanjutkan. Jangan menonaktifkan aturannya."
  } >&2
  exit 2
fi

exit 0
