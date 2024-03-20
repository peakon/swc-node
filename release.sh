#!/bin/bash

set -euxo pipefail

pnpm i
npm run build

TMP=$(mktemp -d)
trap "rm -rf $TMP" EXIT

pushd packages/register
cp -r package.json index.js lib esm README.md *.d.ts "$TMP"
popd
cp LICENSE $TMP

git rm -r "*"
rm -r node_modules packages .husky

mv $TMP/* .
git add -A
git commit -m "Release"
