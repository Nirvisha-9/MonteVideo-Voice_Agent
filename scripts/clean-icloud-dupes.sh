#!/usr/bin/env bash
# iCloud "Desktop & Documents" sync drops conflict copies (" 2.java", " 2.bin")
# into gradle build folders, which breaks the Android build.
#
# Run this whenever you hit:
#   error: class X is public, should be declared in a file named X.java
#
#   ./scripts/clean-icloud-dupes.sh
#
# It only removes regenerable build output — never source, never git-tracked files.

set -euo pipefail
cd "$(dirname "$0")/.."

echo "Removing gradle build output…"
rm -rf android/build android/app/build android/app/.cxx android/.gradle android/.kotlin
find node_modules -type d -path "*/android/build" -prune -exec rm -rf {} + 2>/dev/null || true
find node_modules -type d -name build -path "*gradle-plugin*" -prune -exec rm -rf {} + 2>/dev/null || true

left=$(find . -name "* [0-9].*" -not -path "./.git/*" -not -path "./node_modules/*/ios/*" 2>/dev/null | wc -l | tr -d ' ')
echo "Remaining ' N.' duplicates: $left"
echo "Done. Now rebuild: npx expo run:android"
