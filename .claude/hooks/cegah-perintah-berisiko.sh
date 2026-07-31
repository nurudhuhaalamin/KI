#!/usr/bin/env bash
#
# Hook PreToolUse untuk tool Bash — memblokir perintah destruktif dan perintah
# yang melanggar etiket repo KI. Dipasang lewat .claude/settings.json.
#
# Kontrak hook:
#   - Masukan  : JSON dari stdin (berisi .tool_input.command).
#   - Keluaran : bila perintah berbahaya, cetak keputusan "deny" ke stdout.
#                Bila aman, tanpa keluaran = tanpa keputusan, sehingga alur
#                permission normal (allow/deny/prompt) tetap berlaku.
#   - Exit code: selalu 0.
#
# Prinsip fallback aman: setiap kegagalan membaca atau mem-parsing masukan
# berakhir dengan exit 0 tanpa keputusan, supaya hook ini tidak pernah
# memblokir pekerjaan yang sah hanya karena dirinya sendiri bermasalah.

set -u

masukan="$(cat)" || exit 0
[ -n "$masukan" ] || exit 0

# Mengambil .tool_input.command dari JSON. python3 dipakai bila tersedia;
# bila tidak, jatuh ke sed. jq sengaja tidak dipakai karena belum tentu ada.
ambil_perintah() {
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
        perintah = tool_input.get("command")
        if isinstance(perintah, str):
            sys.stdout.write(perintah)
' 2>/dev/null
    return
  fi
  printf '%s' "$masukan" \
    | tr '\n' ' ' \
    | sed -n 's/.*"command"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p'
}

perintah="$(ambil_perintah)" || exit 0
[ -n "$perintah" ] || exit 0

# Normalisasi: baris baru dan tab jadi spasi, spasi ganda dirapatkan, lalu
# ditambah spasi di depan dan belakang agar pencocokan batas kata lebih mudah.
ternormalisasi=" $(printf '%s' "$perintah" | tr '\n\t' '  ' | tr -s ' ') "

tolak() {
  printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"%s"}}\n' "$1"
  exit 0
}

# 1. Penghapusan rekursif pada root atau home.
case "$ternormalisasi" in
  *" rm -rf / "*|*" rm -fr / "*|*" rm -rf /* "*|*" rm -rf ~ "*|*" rm -rf ~/ "*|*" rm -rf \$HOME"*|*"--no-preserve-root"*)
    tolak "Penghapusan rekursif pada root atau home diblokir oleh hook repo KI. Hapus path spesifik di dalam proyek saja."
    ;;
esac

# 2. Operasi git yang membuang pekerjaan atau menulis ulang riwayat.
case "$ternormalisasi" in
  *" git reset --hard"*)
    tolak "git reset --hard membuang perubahan yang belum di-commit. Pakai git stash atau git restore pada berkas tertentu."
    ;;
  *" git clean "*)
    case "$ternormalisasi" in
      *" -fd"*|*" -fdx"*|*" -xdf"*|*" -df"*)
        tolak "git clean dengan -f/-d/-x menghapus berkas yang belum terlacak. Hapus berkas yang dimaksud satu per satu."
        ;;
    esac
    ;;
  *" git filter-branch"*|*" git filter-repo"*)
    tolak "Penulisan ulang riwayat git diblokir oleh hook repo KI."
    ;;
esac

# 3. Aturan push: tidak boleh force, tidak boleh langsung ke main/master.
case "$ternormalisasi" in
  *" git push"*)
    case "$ternormalisasi" in
      *" --force "*|*" --force-with-lease"*|*" -f "*|*" --mirror"*|*" --delete "*)
        tolak "Force push, mirror push, dan penghapusan branch remote diblokir oleh hook repo KI."
        ;;
    esac
    case "$ternormalisasi" in
      *" main "*|*" main:"*|*":main "*|*" master "*|*" master:"*|*":master "*)
        tolak "Push langsung ke main/master dilarang di repo KI. Push ke branch fitur lalu buka pull request draft."
        ;;
    esac
    ;;
esac

# 4. Perizinan berkas yang terlalu longgar.
case "$ternormalisasi" in
  *" chmod 777 "*|*" chmod -R 777 "*)
    tolak "chmod 777 membuka akses tulis untuk semua pengguna. Pakai perizinan yang lebih sempit, mis. 755 atau 644."
    ;;
esac

# Tidak ada pola yang cocok: tanpa keputusan, alur permission normal berlaku.
exit 0
