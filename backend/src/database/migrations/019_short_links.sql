-- Short Links (URL Shortener interne)
-- Route: etudesk.com/link/{slug}

CREATE TABLE IF NOT EXISTS short_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug VARCHAR(64) NOT NULL UNIQUE,
  target_url TEXT NOT NULL,
  label VARCHAR(255),
  clicks INTEGER NOT NULL DEFAULT 0,
  created_by VARCHAR(255) DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX idx_short_links_slug ON short_links (slug) WHERE is_active = true;
CREATE INDEX idx_short_links_created_at ON short_links (created_at DESC);

-- Click log for analytics
CREATE TABLE IF NOT EXISTS short_link_clicks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  link_id UUID NOT NULL REFERENCES short_links(id) ON DELETE CASCADE,
  clicked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT,
  referer TEXT,
  country VARCHAR(100)
);

CREATE INDEX idx_short_link_clicks_link_id ON short_link_clicks (link_id);
CREATE INDEX idx_short_link_clicks_clicked_at ON short_link_clicks (clicked_at DESC);
