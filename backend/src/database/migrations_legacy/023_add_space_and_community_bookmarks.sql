-- Migration 023: Add space_bookmarks and community_bookmarks tables
-- These tables were missing from the initial schema but referenced by bookmarks.ts routes

CREATE TABLE IF NOT EXISTS space_bookmarks (
  talent_id UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
  space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,
  PRIMARY KEY (talent_id, space_id)
);
CREATE INDEX IF NOT EXISTS idx_space_bookmarks_space_id ON space_bookmarks(space_id);
CREATE INDEX IF NOT EXISTS idx_space_bookmarks_talent ON space_bookmarks(talent_id, space_id);

CREATE TABLE IF NOT EXISTS community_bookmarks (
  talent_id UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,
  PRIMARY KEY (talent_id, community_id)
);
CREATE INDEX IF NOT EXISTS idx_community_bookmarks_community_id ON community_bookmarks(community_id);
CREATE INDEX IF NOT EXISTS idx_community_bookmarks_talent ON community_bookmarks(talent_id, community_id);
