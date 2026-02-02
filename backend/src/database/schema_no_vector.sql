-- ═══════════════════════════════════════════════════════════════
-- ETUDESK DATABASE SCHEMA
-- Version: 2.0
-- ═══════════════════════════════════════════════════════════════

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- CREATE EXTENSION IF NOT EXISTS "vector"; -- Commented out: pgvector not available for pg14 -- pgvector for embeddings

-- ═══════════════════════════════════════════════════════════════
-- UTILITY FUNCTIONS
-- ═══════════════════════════════════════════════════════════════

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════
-- CORE ENTITIES
-- ═══════════════════════════════════════════════════════════════

-- TALENT
CREATE TABLE talents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    bio TEXT,
    avatar_url TEXT,

    -- Contact (Private)
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50),

    -- Location
    city VARCHAR(100),
    region VARCHAR(100),
    country CHAR(2), -- ISO 3166-1 alpha-2
    coordinates POINT,
    remote_ready BOOLEAN DEFAULT FALSE,
    willing_to_relocate BOOLEAN DEFAULT FALSE,

    -- Profile
    profile_tags TEXT[], -- STUDENT, PUPIL, JOB_SEEKER, etc.
    goals TEXT[], -- Max 3: LEARN_NEW_SKILLS, PREPARE_EXAMS, etc.
    sectors TEXT[], -- AGRICULTURE, TECH, FINANCE, etc.

    -- Payment
    payment_methods JSONB DEFAULT '[]'::jsonb, -- [{ id, provider, phone, isDefault }]

    -- LLM / Metadata
    -- embedding VECTOR(1536), -- Commented out: requires pgvector
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE -- Soft delete
);

-- Indexes for talents
CREATE INDEX idx_talents_slug ON talents(slug);
CREATE INDEX idx_talents_email ON talents(email);
CREATE INDEX idx_talents_country ON talents(country);
CREATE INDEX idx_talents_deleted_at ON talents(deleted_at) WHERE deleted_at IS NULL;

-- Trigger for updated_at
CREATE TRIGGER trigger_talents_updated_at
    BEFORE UPDATE ON talents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- SKILL
CREATE TABLE skills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    canonical_name VARCHAR(255) UNIQUE NOT NULL,

    -- Classification
    type VARCHAR(50) NOT NULL,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE -- Soft delete
);

-- Indexes for skills
CREATE INDEX idx_skills_type ON skills(type);
CREATE INDEX idx_skills_deleted_at ON skills(deleted_at) WHERE deleted_at IS NULL;

-- Trigger for updated_at
CREATE TRIGGER trigger_skills_updated_at
    BEFORE UPDATE ON skills
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- PROJECT
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,

    type VARCHAR(50),
    visibility VARCHAR(50) DEFAULT 'PUBLIC',

    started_at DATE,
    ended_at DATE,
    status VARCHAR(50),

    -- Media
    thumbnail_url TEXT,
    gallery TEXT[],

    -- embedding VECTOR(1536), -- Commented out: requires pgvector

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE -- Soft delete
);

-- Indexes for projects
CREATE INDEX idx_projects_slug ON projects(slug);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_visibility ON projects(visibility);
CREATE INDEX idx_projects_deleted_at ON projects(deleted_at) WHERE deleted_at IS NULL;

-- Trigger for updated_at
CREATE TRIGGER trigger_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- PROJECT LINKS
CREATE TABLE project_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    url TEXT NOT NULL,
    title VARCHAR(255)
);

CREATE INDEX idx_project_links_project_id ON project_links(project_id);

-- ORGANIZATION
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,

    type VARCHAR(50),
    sectors TEXT[], -- AGRICULTURE, DIGITAL, HEALTH, EDUCATION, etc.
    size VARCHAR(50),

    description TEXT,
    logo_url TEXT,
    website_url TEXT,
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    goals TEXT[],

    headquarters_city VARCHAR(100),
    headquarters_region VARCHAR(100),
    headquarters_country CHAR(2),
    headquarters_coordinates POINT,

    verification_status VARCHAR(50) DEFAULT 'CLAIMED',

    -- embedding VECTOR(1536), -- Commented out: requires pgvector
    culture_summary TEXT,

    -- Ownership
    created_by UUID REFERENCES talents(id) ON DELETE SET NULL,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE -- Soft delete
);

-- Indexes for organizations
CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_type ON organizations(type);
CREATE INDEX idx_organizations_headquarters_country ON organizations(headquarters_country);
CREATE INDEX idx_organizations_created_by ON organizations(created_by);
CREATE INDEX idx_organizations_deleted_at ON organizations(deleted_at) WHERE deleted_at IS NULL;

-- Trigger for updated_at
CREATE TRIGGER trigger_organizations_updated_at
    BEFORE UPDATE ON organizations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- COMMUNITY
CREATE TABLE communities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    type VARCHAR(50),

    description TEXT,
    rules TEXT,
    application_questions TEXT[],

    city VARCHAR(100),
    region VARCHAR(100),
    country CHAR(2),
    coordinates POINT,

    status VARCHAR(50) DEFAULT 'ACTIVE',
    -- embedding VECTOR(1536), -- Commented out: requires pgvector

    -- Ownership
    created_by UUID REFERENCES talents(id) ON DELETE SET NULL,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE -- Soft delete
);

-- Indexes for communities
CREATE INDEX idx_communities_slug ON communities(slug);
CREATE INDEX idx_communities_type ON communities(type);
CREATE INDEX idx_communities_status ON communities(status);
CREATE INDEX idx_communities_country ON communities(country);
CREATE INDEX idx_communities_created_by ON communities(created_by);
CREATE INDEX idx_communities_deleted_at ON communities(deleted_at) WHERE deleted_at IS NULL;

-- Trigger for updated_at
CREATE TRIGGER trigger_communities_updated_at
    BEFORE UPDATE ON communities
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- OPPORTUNITY
CREATE TABLE opportunities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,

    type VARCHAR(50),
    contract_type VARCHAR(50),
    work_rhythm VARCHAR(50),

    summary TEXT,
    requirements TEXT,
    nice_to_have TEXT,

    -- Organization
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    sectors TEXT[],

    -- Application settings
    cv_required BOOLEAN DEFAULT false,
    application_questions JSONB,

    -- Media
    cover_image_url TEXT,
    images TEXT[],
    attachments JSONB,

    -- Compensation (min/max/frequency/currency only)
    compensation_min DECIMAL(12, 2),
    compensation_max DECIMAL(12, 2),
    currency CHAR(3),
    compensation_frequency VARCHAR(50),

    -- Location
    location_type VARCHAR(50),
    locations JSONB,

    posted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deadline TIMESTAMP WITH TIME ZONE,
    start_date DATE,
    duration INTERVAL,

    status VARCHAR(50) DEFAULT 'DRAFT',

    -- embedding VECTOR(1536), -- Commented out: requires pgvector
    ideal_candidate_summary TEXT,

    -- Metrics
    views_count INTEGER DEFAULT 0,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE -- Soft delete
);

-- Indexes for opportunities
CREATE INDEX idx_opportunities_slug ON opportunities(slug);
CREATE INDEX idx_opportunities_type ON opportunities(type);
CREATE INDEX idx_opportunities_status ON opportunities(status);
CREATE INDEX idx_opportunities_location_type ON opportunities(location_type);
CREATE INDEX idx_opportunities_deadline ON opportunities(deadline);
CREATE INDEX idx_opportunities_views_count ON opportunities(views_count DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_opportunities_deleted_at ON opportunities(deleted_at) WHERE deleted_at IS NULL;

-- Trigger for updated_at
CREATE TRIGGER trigger_opportunities_updated_at
    BEFORE UPDATE ON opportunities
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- ═══════════════════════════════════════════════════════════════
-- RELATIONS (EDGES)
-- ═══════════════════════════════════════════════════════════════

-- RELATION: HAS_SKILL (Talent -> Skill)
CREATE TABLE talent_skills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    talent_id UUID REFERENCES talents(id) ON DELETE CASCADE,
    canonical_name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    proficiency_level VARCHAR(20) NOT NULL,
    origin VARCHAR(20) DEFAULT 'declared',
    document_id UUID,
    context TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(talent_id, canonical_name)
);

CREATE INDEX idx_talent_skills_talent_id ON talent_skills(talent_id);
CREATE INDEX idx_talent_skills_canonical_name ON talent_skills(canonical_name);
CREATE INDEX idx_talent_skills_proficiency_level ON talent_skills(proficiency_level);

-- RELATION: CONTRIBUTED_TO (Talent -> Project)
CREATE TABLE talent_projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    talent_id UUID REFERENCES talents(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,

    role VARCHAR(255),
    contribution_type VARCHAR(50),
    contribution_summary TEXT,
    started_at DATE,
    ended_at DATE,
    is_highlighted BOOLEAN DEFAULT FALSE,

    UNIQUE(talent_id, project_id)
);

CREATE INDEX idx_talent_projects_talent_id ON talent_projects(talent_id);
CREATE INDEX idx_talent_projects_project_id ON talent_projects(project_id);

-- RELATION: WORKED_AT (Talent -> Organization)
CREATE TABLE talent_experiences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    talent_id UUID REFERENCES talents(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

    job_title VARCHAR(255) NOT NULL,
    work_type VARCHAR(50),

    started_at DATE NOT NULL,
    ended_at DATE,
    is_current BOOLEAN GENERATED ALWAYS AS (ended_at IS NULL) STORED,

    responsibilities TEXT,
    city VARCHAR(100),
    country CHAR(2),
    remote BOOLEAN DEFAULT FALSE,

    verified BOOLEAN DEFAULT FALSE,
    verified_by UUID REFERENCES documents(id) ON DELETE SET NULL
);

CREATE INDEX idx_talent_experiences_talent_id ON talent_experiences(talent_id);
CREATE INDEX idx_talent_experiences_organization_id ON talent_experiences(organization_id);
CREATE INDEX idx_talent_experiences_is_current ON talent_experiences(is_current);

-- RELATION: STUDIED_AT (Talent -> Organization)
CREATE TABLE talent_educations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    talent_id UUID REFERENCES talents(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

    degree_type VARCHAR(50),
    field_of_study VARCHAR(255),

    started_at DATE,
    ended_at DATE,
    graduated BOOLEAN DEFAULT TRUE,
    gpa NUMERIC(4,2), -- Système français (0-20)
    honors TEXT[],
    thesis_title TEXT
);

CREATE INDEX idx_talent_educations_talent_id ON talent_educations(talent_id);
CREATE INDEX idx_talent_educations_organization_id ON talent_educations(organization_id);
CREATE INDEX idx_talent_educations_degree_type ON talent_educations(degree_type);

-- RELATION: POSTED (Talent|Organization -> Opportunity)
CREATE TABLE opportunity_posters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    opportunity_id UUID REFERENCES opportunities(id) ON DELETE CASCADE,

    poster_talent_id UUID REFERENCES talents(id) ON DELETE CASCADE,
    poster_organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

    role VARCHAR(50),
    posted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Prevent duplicate posters for same opportunity
    UNIQUE(opportunity_id, poster_talent_id),
    UNIQUE(opportunity_id, poster_organization_id)
);

CREATE INDEX idx_opportunity_posters_opportunity_id ON opportunity_posters(opportunity_id);
CREATE INDEX idx_opportunity_posters_poster_talent_id ON opportunity_posters(poster_talent_id);
CREATE INDEX idx_opportunity_posters_poster_organization_id ON opportunity_posters(poster_organization_id);

-- RELATION: BOOKMARKED (Talent -> Opportunity)
CREATE TABLE opportunity_bookmarks (
    talent_id UUID REFERENCES talents(id) ON DELETE CASCADE,
    opportunity_id UUID REFERENCES opportunities(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    PRIMARY KEY (talent_id, opportunity_id)
);

CREATE INDEX idx_opportunity_bookmarks_opportunity_id ON opportunity_bookmarks(opportunity_id);

-- RELATION: APPLIED_TO (Talent -> Opportunity)
CREATE TABLE opportunity_applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    talent_id UUID REFERENCES talents(id) ON DELETE CASCADE,
    opportunity_id UUID REFERENCES opportunities(id) ON DELETE CASCADE,

    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'PENDING',
    cover_letter TEXT,
    custom_answers JSONB,

    UNIQUE(talent_id, opportunity_id)
);

CREATE INDEX idx_opportunity_applications_talent_id ON opportunity_applications(talent_id);
CREATE INDEX idx_opportunity_applications_opportunity_id ON opportunity_applications(opportunity_id);
CREATE INDEX idx_opportunity_applications_talent_opportunity ON opportunity_applications(talent_id, opportunity_id);
CREATE INDEX idx_opportunity_applications_status ON opportunity_applications(status);

-- RELATION: MENTORS (Talent -> Talent)
CREATE TABLE mentorships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mentor_id UUID REFERENCES talents(id) ON DELETE CASCADE,
    mentee_id UUID REFERENCES talents(id) ON DELETE CASCADE,

    focus_areas TEXT[],
    started_at DATE,
    ended_at DATE,
    status VARCHAR(50),
    notes TEXT,

    UNIQUE(mentor_id, mentee_id)
);

CREATE INDEX idx_mentorships_mentor_id ON mentorships(mentor_id);
CREATE INDEX idx_mentorships_mentee_id ON mentorships(mentee_id);
CREATE INDEX idx_mentorships_status ON mentorships(status);

-- RELATION: CONNECTED_TO (Talent -> Talent)
CREATE TABLE connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_talent_id UUID REFERENCES talents(id) ON DELETE CASCADE,
    to_talent_id UUID REFERENCES talents(id) ON DELETE CASCADE,

    relationship_type VARCHAR(50),
    context TEXT,
    connected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(from_talent_id, to_talent_id)
);

CREATE INDEX idx_connections_from_talent_id ON connections(from_talent_id);
CREATE INDEX idx_connections_to_talent_id ON connections(to_talent_id);

-- RELATION: RECOMMENDS (Talent -> Talent)
CREATE TABLE recommendations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recommender_id UUID REFERENCES talents(id) ON DELETE CASCADE,
    recommended_id UUID REFERENCES talents(id) ON DELETE CASCADE,

    relationship VARCHAR(255),
    recommendation_text TEXT,
    highlighted_skills TEXT[],

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    visibility VARCHAR(50) DEFAULT 'PUBLIC',

    UNIQUE(recommender_id, recommended_id)
);

CREATE INDEX idx_recommendations_recommender_id ON recommendations(recommender_id);
CREATE INDEX idx_recommendations_recommended_id ON recommendations(recommended_id);

-- RELATION: MEMBER_OF (Talent -> Community)
CREATE TABLE community_members (
    talent_id UUID REFERENCES talents(id) ON DELETE CASCADE,
    community_id UUID REFERENCES communities(id) ON DELETE CASCADE,

    membership_type VARCHAR(50),
    joined_at DATE DEFAULT CURRENT_DATE,
    left_at DATE,
    is_active BOOLEAN DEFAULT TRUE,

    PRIMARY KEY(talent_id, community_id)
);

CREATE INDEX idx_community_members_community_id ON community_members(community_id);
CREATE INDEX idx_community_members_is_active ON community_members(is_active);

-- ═══════════════════════════════════════════════════════════════
-- RELATIONS: RELATED_SKILLS (Auto-generated by LLM)
-- ═══════════════════════════════════════════════════════════════

-- (Legacy tables project_skills, opportunity_skills, community_skills, organization_skills removed)

-- ═══════════════════════════════════════════════════════════════
-- VIEWS FOR COMMON QUERIES
-- ═══════════════════════════════════════════════════════════════

-- Active talents (not soft deleted)
CREATE VIEW active_talents AS
SELECT * FROM talents WHERE deleted_at IS NULL;

-- Active projects
CREATE VIEW active_projects AS
SELECT * FROM projects WHERE deleted_at IS NULL;

-- Active organizations
CREATE VIEW active_organizations AS
SELECT * FROM organizations WHERE deleted_at IS NULL;

-- Active communities
CREATE VIEW active_communities AS
SELECT * FROM communities WHERE deleted_at IS NULL;

-- Active opportunities
CREATE VIEW active_opportunities AS
SELECT * FROM opportunities WHERE deleted_at IS NULL;

-- Open opportunities
CREATE VIEW open_opportunities AS
SELECT * FROM opportunities
WHERE deleted_at IS NULL
  AND status = 'OPEN'
  AND (deadline IS NULL OR deadline > CURRENT_TIMESTAMP);

