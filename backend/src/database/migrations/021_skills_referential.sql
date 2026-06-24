-- ═══════════════════════════════════════════════════════════════════════════════
-- 021 — DIGITAL SKILLS REFERENTIAL AS BACKBONE
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Wires the etudesk_digital_skills catalog (datasets/etudesk_digital_skills) into
-- the product as the single source of truth for competencies.
--
--   - competencies        : the catalog (slug PK), seeded from competency_catalog.csv
--   - competency_edges     : the adjacency graph, seeded from competency_edges.csv
--   - talent_skills        : REDESIGNED into a catalog-constrained UserCompetency
--                            (EVALUATION_FRAMEWORK: A/C/I/T, confidence, decay, levels)
--   - opportunity_skills   : catalog skills required / nice_to_have by an opportunity
--   - community_skills     : catalog skills a community validates / is about
--   - space_skills         : catalog skills a space/workshop validates / equips
--
-- Fresh start: existing free-text talent_skills rows are discarded (no legacy map).
-- Levels align to the framework: beginner | intermediate | advanced | master.
-- ═══════════════════════════════════════════════════════════════════════════════

-- Trigram support for fuzzy label resolution (catalog.service.resolveLabel)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ───────────────────────────────────────────────────────────────────────────────
-- 1. CATALOG
-- ───────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS competencies (
    slug            VARCHAR(120) PRIMARY KEY,
    family          VARCHAR(40)  NOT NULL,
    type            VARCHAR(20)  NOT NULL
                    CHECK (type IN ('knowledge','hard_skill','soft_skill','tool_platform','language')),
    name            VARCHAR(255) NOT NULL,
    name_fr         VARCHAR(255) NOT NULL,
    catalog_version VARCHAR(20)  NOT NULL,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_competencies_family ON competencies(family);
CREATE INDEX IF NOT EXISTS idx_competencies_type   ON competencies(type);
-- Label uniqueness (SCHEMA.md invariant: name and name_fr are each unique)
CREATE UNIQUE INDEX IF NOT EXISTS uq_competencies_name    ON competencies (lower(name));
CREATE UNIQUE INDEX IF NOT EXISTS uq_competencies_name_fr ON competencies (lower(name_fr));
-- Fuzzy resolution support
CREATE INDEX IF NOT EXISTS idx_competencies_name_trgm    ON competencies USING gin (lower(name)    gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_competencies_name_fr_trgm ON competencies USING gin (lower(name_fr) gin_trgm_ops);

CREATE TRIGGER trigger_competencies_updated_at
    BEFORE UPDATE ON competencies FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- The directed adjacency graph. PK (from_slug, to_slug) enforces the invariant
-- "at most one relation per ordered pair" (validated upstream by validate_edges.py).
CREATE TABLE IF NOT EXISTS competency_edges (
    from_slug VARCHAR(120) NOT NULL REFERENCES competencies(slug) ON DELETE CASCADE,
    to_slug   VARCHAR(120) NOT NULL REFERENCES competencies(slug) ON DELETE CASCADE,
    relation  VARCHAR(20)  NOT NULL CHECK (relation IN ('prerequisite','co_occurrence','sibling')),
    strength  REAL         NOT NULL CHECK (strength > 0 AND strength <= 1),
    reason    VARCHAR(64),
    PRIMARY KEY (from_slug, to_slug)
);

CREATE INDEX IF NOT EXISTS idx_competency_edges_from ON competency_edges(from_slug);
CREATE INDEX IF NOT EXISTS idx_competency_edges_to   ON competency_edges(to_slug);

-- ───────────────────────────────────────────────────────────────────────────────
-- 2. TALENT SKILLS — redesigned UserCompetency (catalog-constrained)
-- ───────────────────────────────────────────────────────────────────────────────
-- Fresh start: drop the free-text table and recreate keyed on competency_slug.
DROP TABLE IF EXISTS talent_skills CASCADE;

CREATE TABLE talent_skills (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    talent_id         UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
    competency_slug   VARCHAR(120) NOT NULL REFERENCES competencies(slug) ON DELETE RESTRICT,
    -- framework state
    level             VARCHAR(20) NOT NULL DEFAULT 'beginner'
                      CHECK (level IN ('beginner','intermediate','advanced','master')),
    score             SMALLINT NOT NULL DEFAULT 1 CHECK (score BETWEEN 1 AND 4),
    confidence        REAL NOT NULL DEFAULT 0.30 CHECK (confidence >= 0 AND confidence <= 1),
    -- last direct A/C/I/T reading (nullable for pure-inferred rows)
    axis_a            SMALLINT CHECK (axis_a BETWEEN 1 AND 4),
    axis_c            SMALLINT CHECK (axis_c BETWEEN 1 AND 4),
    axis_i            SMALLINT CHECK (axis_i BETWEEN 1 AND 4),
    axis_t            SMALLINT CHECK (axis_t BETWEEN 1 AND 4),
    -- provenance / audit
    origin            VARCHAR(20) NOT NULL DEFAULT 'declared'
                      CHECK (origin IN ('declared','inferred','extracted','validated')),
    context           TEXT[] NOT NULL DEFAULT '{}',
    source_ref        TEXT[] NOT NULL DEFAULT '{}',
    inferred_from     TEXT[] NOT NULL DEFAULT '{}',
    evidence_hash     VARCHAR(64),
    rationale         TEXT,
    last_evidence_at  TIMESTAMP WITH TIME ZONE,
    decay_state       VARCHAR(20) NOT NULL DEFAULT 'active'
                      CHECK (decay_state IN ('active','stale','archived')),
    catalog_version   VARCHAR(20)  NOT NULL,
    framework_version VARCHAR(20)  NOT NULL,
    evaluated_by      VARCHAR(64),
    is_visible        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (talent_id, competency_slug)
);

CREATE INDEX idx_talent_skills_talent        ON talent_skills(talent_id);
CREATE INDEX idx_talent_skills_slug          ON talent_skills(competency_slug);
CREATE INDEX idx_talent_skills_talent_active ON talent_skills(talent_id) WHERE decay_state = 'active';

CREATE TRIGGER trigger_talent_skills_updated_at
    BEFORE UPDATE ON talent_skills FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ───────────────────────────────────────────────────────────────────────────────
-- 3. ENTITY ↔ CATALOG JOIN TABLES (only catalog slugs are taggable)
-- ───────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS opportunity_skills (
    opportunity_id  UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
    competency_slug VARCHAR(120) NOT NULL REFERENCES competencies(slug) ON DELETE RESTRICT,
    requirement     VARCHAR(20) NOT NULL DEFAULT 'required'
                    CHECK (requirement IN ('required','nice_to_have')),
    weight          REAL NOT NULL DEFAULT 1.0 CHECK (weight > 0 AND weight <= 1),
    min_level       VARCHAR(20) CHECK (min_level IN ('beginner','intermediate','advanced','master')),
    PRIMARY KEY (opportunity_id, competency_slug)
);
CREATE INDEX IF NOT EXISTS idx_opportunity_skills_slug ON opportunity_skills(competency_slug);

CREATE TABLE IF NOT EXISTS community_skills (
    community_id    UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    competency_slug VARCHAR(120) NOT NULL REFERENCES competencies(slug) ON DELETE RESTRICT,
    role            VARCHAR(20) NOT NULL DEFAULT 'validates'
                    CHECK (role IN ('validates','topic')),
    PRIMARY KEY (community_id, competency_slug)
);
CREATE INDEX IF NOT EXISTS idx_community_skills_slug ON community_skills(competency_slug);

CREATE TABLE IF NOT EXISTS space_skills (
    space_id        UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    competency_slug VARCHAR(120) NOT NULL REFERENCES competencies(slug) ON DELETE RESTRICT,
    role            VARCHAR(20) NOT NULL DEFAULT 'validates'
                    CHECK (role IN ('validates','equipment')),
    PRIMARY KEY (space_id, competency_slug)
);
CREATE INDEX IF NOT EXISTS idx_space_skills_slug ON space_skills(competency_slug);
