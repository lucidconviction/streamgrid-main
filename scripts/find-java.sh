#!/usr/bin/env bash
# Locate a JDK 17+ installation and print `export JAVA_HOME=...` to stdout.
# Usage: `eval "$(bash scripts/find-java.sh)"` — works in any shell.
set -euo pipefail

java_major() {
  local bin="$1" line num
  line="$("$bin" -version 2>&1 | head -n1 || true)"
  num=$(printf '%s\n' "$line" | grep -oE 'version "[0-9]+' | grep -oE '[0-9]+' || true)
  [ -n "$num" ] && printf '%s\n' "${num%%.*}"
}

if [ -n "${JAVA_HOME:-}" ] && [ -x "${JAVA_HOME}/bin/java" ]; then
  if [ "$(java_major "${JAVA_HOME}/bin/java")" -ge 17 ] 2>/dev/null; then
    echo "export JAVA_HOME=${JAVA_HOME}"
    exit 0
  fi
fi

search_paths=(
  "/usr/local/Cellar/openjdk@17"
  "/opt/homebrew/opt/openjdk@17"
  "/opt/homebrew/opt/openjdk"
  "/usr/lib/jvm"
  "/usr/java"
)

for base in "${search_paths[@]}"; do
  [ -d "$base" ] || continue
  while IFS= read -r java_bin; do
    [ -x "$java_bin" ] || continue
    if [ "$(java_major "$java_bin")" -ge 17 ] 2>/dev/null; then
      echo "export JAVA_HOME=$(dirname "$(dirname "$java_bin")")"
      exit 0
    fi
  done < <(find "$base" -type f -name java -perm -u+x 2>/dev/null)
done

if command -v java >/dev/null 2>&1; then
  java_bin="$(command -v java)"
  if [ "$(java_major "$java_bin")" -ge 17 ] 2>/dev/null; then
    echo "export JAVA_HOME=$(dirname "$(dirname "$java_bin")")"
    exit 0
  fi
fi

echo "ERROR: JDK 17+ not found. Set JAVA_HOME to a JDK 17+ installation." >&2
exit 1