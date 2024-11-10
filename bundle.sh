#!/usr/bin/env sh

DIRECTORY="distribution"
PROJECT_NAME="github-search-preview"
VERSION=$(cat package.json | jq -r .version)
TODAY=$(date +%d%m%Y)

FILENAME="$PROJECT_NAME-$VERSION-$TODAY.zip"
(cd $DIRECTORY && zip -r "../$FILENAME" ./*)
