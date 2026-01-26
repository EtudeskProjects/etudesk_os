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
    display_name VARCHAR(255) NOT NULL,
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
    canonical_name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    aliases TEXT[],

    -- Classification
    type VARCHAR(50) NOT NULL,
    domain VARCHAR(100),

    -- Hierarchy
    parent_skill_id UUID REFERENCES skills(id) ON DELETE SET NULL,

    -- Standardization
    esco_uri TEXT,
    onet_code VARCHAR(50),

    -- LLM / Metadata
    -- embedding VECTOR(1536), -- Commented out: requires pgvector
    typical_evidence TEXT[],
    growth_trend VARCHAR(50),

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE -- Soft delete
);

-- Indexes for skills
CREATE INDEX idx_skills_slug ON skills(slug);
CREATE INDEX idx_skills_type ON skills(type);
CREATE INDEX idx_skills_parent_skill_id ON skills(parent_skill_id);
CREATE INDEX idx_skills_domain ON skills(domain);
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

-- HUB (Physical Spaces)
CREATE TABLE hubs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,

    type VARCHAR(50),
    description TEXT,
    amenities TEXT[],

    address TEXT,
    city VARCHAR(100),
    region VARCHAR(100),
    country CHAR(2),
    coordinates POINT,

    access_type VARCHAR(50),
    pricing TEXT,

    -- embedding VECTOR(1536), -- Commented out: requires pgvector

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE -- Soft delete
);

-- Indexes for hubs
CREATE INDEX idx_hubs_slug ON hubs(slug);
CREATE INDEX idx_hubs_type ON hubs(type);
CREATE INDEX idx_hubs_country ON hubs(country);
CREATE INDEX idx_hubs_city ON hubs(city);
CREATE INDEX idx_hubs_access_type ON hubs(access_type);
CREATE INDEX idx_hubs_deleted_at ON hubs(deleted_at) WHERE deleted_at IS NULL;

-- Trigger for updated_at
CREATE TRIGGER trigger_hubs_updated_at
    BEFORE UPDATE ON hubs
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

-- DOCUMENT
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,

    type VARCHAR(50),

    file_url TEXT NOT NULL,
    file_hash CHAR(64), -- SHA256
    extracted_text TEXT,

    issued_by VARCHAR(255),
    issued_at DATE,
    expires_at DATE,
    credential_id VARCHAR(255),
    verification_url TEXT,

    verification_status VARCHAR(50) DEFAULT 'UNVERIFIED',
    visibility VARCHAR(50) DEFAULT 'PRIVATE',

    -- embedding VECTOR(1536), -- Commented out: requires pgvector
    summary TEXT,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE -- Soft delete
);

-- Indexes for documents
CREATE INDEX idx_documents_type ON documents(type);
CREATE INDEX idx_documents_verification_status ON documents(verification_status);
CREATE INDEX idx_documents_visibility ON documents(visibility);
CREATE INDEX idx_documents_deleted_at ON documents(deleted_at) WHERE deleted_at IS NULL;

-- Trigger for updated_at
CREATE TRIGGER trigger_documents_updated_at
    BEFORE UPDATE ON documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- ═══════════════════════════════════════════════════════════════
-- RELATIONS (EDGES)
-- ═══════════════════════════════════════════════════════════════

-- RELATION: HAS_SKILL (Talent -> Skill)
CREATE TABLE talent_skills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    talent_id UUID REFERENCES talents(id) ON DELETE CASCADE,
    skill_id UUID REFERENCES skills(id) ON DELETE CASCADE,

    proficiency_level VARCHAR(10) NOT NULL,
    self_assessed BOOLEAN DEFAULT TRUE,
    endorsed_count INTEGER DEFAULT 0,
    verified_by UUID[], -- Document IDs that prove this skill

    years_of_experience NUMERIC(4,1),
    last_used_at DATE,
    context TEXT,

    UNIQUE(talent_id, skill_id)
);

CREATE INDEX idx_talent_skills_talent_id ON talent_skills(talent_id);
CREATE INDEX idx_talent_skills_skill_id ON talent_skills(skill_id);
CREATE INDEX idx_talent_skills_proficiency_level ON talent_skills(proficiency_level);

-- RELATION: WANTS_TO_LEARN (Talent -> Skill)
CREATE TABLE talent_learning_goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    talent_id UUID REFERENCES talents(id) ON DELETE CASCADE,
    skill_id UUID REFERENCES skills(id) ON DELETE CASCADE,

    priority VARCHAR(50),
    reason TEXT,
    target_level VARCHAR(10),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(talent_id, skill_id)
);

CREATE INDEX idx_talent_learning_goals_talent_id ON talent_learning_goals(talent_id);
CREATE INDEX idx_talent_learning_goals_skill_id ON talent_learning_goals(skill_id);

-- RELATION: ENDORSES_SKILL (Talent -> TalentSkill)
CREATE TABLE skill_endorsements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    endorser_id UUID REFERENCES talents(id) ON DELETE SET NULL,
    talent_skill_id UUID REFERENCES talent_skills(id) ON DELETE CASCADE,

    relationship_context TEXT,
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(endorser_id, talent_skill_id)
);

CREATE INDEX idx_skill_endorsements_endorser_id ON skill_endorsements(endorser_id);
CREATE INDEX idx_skill_endorsements_talent_skill_id ON skill_endorsements(talent_skill_id);

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

    focus_area_skill_ids UUID[], -- Array of Skill IDs
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
    highlighted_skill_ids UUID[],

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

-- RELATION: BOOKED (Talent -> Hub)
CREATE TABLE hub_bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    talent_id UUID REFERENCES talents(id) ON DELETE CASCADE,
    hub_id UUID REFERENCES hubs(id) ON DELETE CASCADE,

    booking_date TIMESTAMP WITH TIME ZONE,
    duration INTERVAL,
    status VARCHAR(50)
);

CREATE INDEX idx_hub_bookings_talent_id ON hub_bookings(talent_id);
CREATE INDEX idx_hub_bookings_hub_id ON hub_bookings(hub_id);
CREATE INDEX idx_hub_bookings_booking_date ON hub_bookings(booking_date);
CREATE INDEX idx_hub_bookings_status ON hub_bookings(status);

-- RELATION: OWNS_DOCUMENT (Talent -> Document)
CREATE TABLE talent_documents (
    talent_id UUID REFERENCES talents(id) ON DELETE CASCADE,
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,

    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_primary BOOLEAN DEFAULT FALSE,

    PRIMARY KEY (talent_id, document_id)
);

CREATE INDEX idx_talent_documents_document_id ON talent_documents(document_id);

-- RELATION: OPERATES (Organization -> Hub)
CREATE TABLE organization_hubs (
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    hub_id UUID REFERENCES hubs(id) ON DELETE CASCADE,

    relationship VARCHAR(50),

    PRIMARY KEY (organization_id, hub_id)
);

CREATE INDEX idx_organization_hubs_hub_id ON organization_hubs(hub_id);

-- RELATION: RELATED_TO (Skill -> Skill) - Non-hierarchical relations only
CREATE TABLE skill_relations (
    from_skill_id UUID REFERENCES skills(id) ON DELETE CASCADE,
    to_skill_id UUID REFERENCES skills(id) ON DELETE CASCADE,

    relationship_type VARCHAR(50),
    strength NUMERIC(3,2),

    PRIMARY KEY (from_skill_id, to_skill_id)
);

CREATE INDEX idx_skill_relations_to_skill_id ON skill_relations(to_skill_id);

-- RELATION: EVOLVES_INTO (Skill -> Skill)
CREATE TABLE skill_evolutions (
    from_skill_id UUID REFERENCES skills(id) ON DELETE CASCADE,
    to_skill_id UUID REFERENCES skills(id) ON DELETE CASCADE,

    typical_path TEXT,

    PRIMARY KEY (from_skill_id, to_skill_id)
);

CREATE INDEX idx_skill_evolutions_to_skill_id ON skill_evolutions(to_skill_id);

-- ═══════════════════════════════════════════════════════════════
-- RELATIONS: RELATED_SKILLS (Auto-generated by LLM)
-- ═══════════════════════════════════════════════════════════════

-- Project <-> Skill
CREATE TABLE project_skills (
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    skill_id UUID REFERENCES skills(id) ON DELETE CASCADE,
    relevance_score NUMERIC(3,2),
    is_auto_generated BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (project_id, skill_id)
);

CREATE INDEX idx_project_skills_skill_id ON project_skills(skill_id);

-- Opportunity <-> Skill
CREATE TABLE opportunity_skills (
    opportunity_id UUID REFERENCES opportunities(id) ON DELETE CASCADE,
    skill_id UUID REFERENCES skills(id) ON DELETE CASCADE,
    is_required BOOLEAN DEFAULT TRUE,
    proficiency_level VARCHAR(10),
    relevance_score NUMERIC(3,2),
    is_auto_generated BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (opportunity_id, skill_id)
);

CREATE INDEX idx_opportunity_skills_skill_id ON opportunity_skills(skill_id);

-- Hub <-> Skill
CREATE TABLE hub_skills (
    hub_id UUID REFERENCES hubs(id) ON DELETE CASCADE,
    skill_id UUID REFERENCES skills(id) ON DELETE CASCADE,
    relevance_score NUMERIC(3,2),
    is_auto_generated BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (hub_id, skill_id)
);

CREATE INDEX idx_hub_skills_skill_id ON hub_skills(skill_id);

-- Community <-> Skill
CREATE TABLE community_skills (
    community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
    skill_id UUID REFERENCES skills(id) ON DELETE CASCADE,
    relevance_score NUMERIC(3,2),
    is_auto_generated BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (community_id, skill_id)
);

CREATE INDEX idx_community_skills_skill_id ON community_skills(skill_id);

-- Document <-> Skill
CREATE TABLE document_skills (
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    skill_id UUID REFERENCES skills(id) ON DELETE CASCADE,
    relevance_score NUMERIC(3,2),
    is_auto_generated BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (document_id, skill_id)
);

CREATE INDEX idx_document_skills_skill_id ON document_skills(skill_id);

-- Organization <-> Skill
CREATE TABLE organization_skills (
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    skill_id UUID REFERENCES skills(id) ON DELETE CASCADE,
    relevance_score NUMERIC(3,2),
    is_auto_generated BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (organization_id, skill_id)
);

CREATE INDEX idx_organization_skills_skill_id ON organization_skills(skill_id);

-- ═══════════════════════════════════════════════════════════════
-- VIEWS FOR COMMON QUERIES
-- ═══════════════════════════════════════════════════════════════

-- Active talents (not soft deleted)
CREATE VIEW active_talents AS
SELECT * FROM talents WHERE deleted_at IS NULL;

-- Active skills
CREATE VIEW active_skills AS
SELECT * FROM skills WHERE deleted_at IS NULL;

-- Active projects
CREATE VIEW active_projects AS
SELECT * FROM projects WHERE deleted_at IS NULL;

-- Active organizations
CREATE VIEW active_organizations AS
SELECT * FROM organizations WHERE deleted_at IS NULL;

-- Active communities
CREATE VIEW active_communities AS
SELECT * FROM communities WHERE deleted_at IS NULL;

-- Active hubs
CREATE VIEW active_hubs AS
SELECT * FROM hubs WHERE deleted_at IS NULL;

-- Active opportunities
CREATE VIEW active_opportunities AS
SELECT * FROM opportunities WHERE deleted_at IS NULL;

-- Open opportunities
CREATE VIEW open_opportunities AS
SELECT * FROM opportunities
WHERE deleted_at IS NULL
  AND status = 'OPEN'
  AND (deadline IS NULL OR deadline > CURRENT_TIMESTAMP);

-- Active documents
CREATE VIEW active_documents AS
SELECT * FROM documents WHERE deleted_at IS NULL;
