#!/bin/sh
set -e

# cf https://gist.github.com/mwgamera/1b103f40a7305377208954ed0d7e2fd0
export LOCPATH="$HOME/.local/share/locale" LC_COLLATE=en@shaw

grep -v Æ ./kingsleyreadlexicon.tsv | awk -F '\t' '{print$2}' |
  { LC_ALL=C sort -u; } | sort | tr '\n' '|' | sed 's!|$!!' > ./dic.aa.txt
grep -v Ɑː ./kingsleyreadlexicon.tsv | awk -F '\t' '{print$2}' |
  { LC_ALL=C sort -u; } | sort | tr '\n' '|' | sed 's!|$!!' > ./dic.ae.txt

