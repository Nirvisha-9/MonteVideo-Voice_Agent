#!/usr/bin/env bash
# Downloads the offline Vosk speech models used by the Voice Agent.
# Models are gitignored (they are large); run this once after cloning, and
# again whenever you add a language. Re-run is safe (skips what exists).
#
#   ./scripts/fetch-vosk-models.sh
#
# After this, rebuild the app:  npx expo prebuild --clean && npx expo run:android

set -euo pipefail
cd "$(dirname "$0")/.."
DEST="assets/vosk"
mkdir -p "$DEST"

# name<TAB>zip-url   (folder is renamed to `model-<name>` for react-native-vosk)
fetch () {
  local name="$1" url="$2" dir="$DEST/model-$name"
  if [ -d "$dir" ]; then echo "✓ model-$name already present"; return; fi
  echo "↓ downloading model-$name …"
  local tmp; tmp="$(mktemp -d)"
  curl -L --fail -o "$tmp/m.zip" "$url"
  unzip -q "$tmp/m.zip" -d "$tmp"
  mv "$tmp"/*/ "$dir"
  rm -rf "$tmp"
  echo "✓ model-$name ready ($(du -sh "$dir" | cut -f1))"
}

# English
fetch "en-en" "https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip"

# Spanish
fetch "es-es" "https://alphacephei.com/vosk/models/vosk-model-small-es-0.42.zip"

echo
echo "Done. Now: npx expo prebuild --clean && npx expo run:android"
