#!/bin/bash

# Script to run database migrations
# Usage: ./run-migration.sh <migration-file>

if [ -z "$1" ]; then
  echo "Usage: ./run-migration.sh <migration-file>"
  echo "Example: ./run-migration.sh src/database/migrations/013_add_tags_sectors_to_communities.sql"
  exit 1
fi

# Load environment variables from .env file if it exists
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

if [ -z "$DATABASE_URL" ]; then
  echo "Error: DATABASE_URL environment variable is not set"
  echo "Please set it in your .env file or as an environment variable"
  exit 1
fi

echo "Running migration: $1"
psql "$DATABASE_URL" -f "$1"

if [ $? -eq 0 ]; then
  echo "✅ Migration completed successfully"
else
  echo "❌ Migration failed"
  exit 1
fi
