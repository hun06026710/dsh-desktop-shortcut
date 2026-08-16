#!/bin/sh
# convert-to-icns.sh <input-image> <output.icns>
# Uses only macOS built-ins: sips (resize) + iconutil (iconset -> icns).
set -e
IN="$1"
OUT="$2"
TMP="$(mktemp -d)"
ICONSET="$TMP/icon.iconset"
mkdir -p "$ICONSET"
sips -z 16 16 "$IN" --out "$ICONSET/icon_16x16.png" >/dev/null
sips -z 32 32 "$IN" --out "$ICONSET/icon_16x16@2x.png" >/dev/null
sips -z 32 32 "$IN" --out "$ICONSET/icon_32x32.png" >/dev/null
sips -z 64 64 "$IN" --out "$ICONSET/icon_32x32@2x.png" >/dev/null
sips -z 128 128 "$IN" --out "$ICONSET/icon_128x128.png" >/dev/null
sips -z 256 256 "$IN" --out "$ICONSET/icon_128x128@2x.png" >/dev/null
sips -z 256 256 "$IN" --out "$ICONSET/icon_256x256.png" >/dev/null
sips -z 512 512 "$IN" --out "$ICONSET/icon_256x256@2x.png" >/dev/null
sips -z 512 512 "$IN" --out "$ICONSET/icon_512x512.png" >/dev/null
cp "$IN" "$ICONSET/icon_512x512@2x.png"
iconutil -c icns "$ICONSET" -o "$OUT"
rm -rf "$TMP"
echo "OK $OUT"
