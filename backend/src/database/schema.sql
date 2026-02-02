-- ═══════════════════════════════════════════════════════════════
-- ETUDESK DATABASE SCHEMA
-- Version: 2.0
-- ═══════════════════════════════════════════════════════════════

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector"; -- pgvector for embeddings

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
    gender VARCHAR(10),

    -- Contact (Private)
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50),

    -- Location
    city VARCHAR(100),
    region VARCHAR(100),
    country CHAR(2), -- ISO 3166-1 alpha-2
    remote_ready BOOLEAN DEFAULT FALSE,
    willing_to_relocate BOOLEAN DEFAULT FALSE,

    -- Profile
    profile_tags TEXT[], -- STUDENT, PUPIL, JOB_SEEKER, etc.
    goals TEXT[], -- Max 3: LEARN_NEW_SKILLS, PREPARE_EXAMS, etc.
    sectors TEXT[], -- AGRICULTURE, TECH, FINANCE, etc.

    -- Payment
    payment_methods JSONB DEFAULT '[]'::jsonb, -- [{ id, provider, phone, isDefault }]

    -- LLM / Metadata
    embedding VECTOR(1536),
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

    embedding VECTOR(1536),

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

    embedding VECTOR(1536),
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

    -- Access & Visibility
    access_type VARCHAR(50) DEFAULT 'PUBLIC',
    tags JSONB,
    sectors JSONB,

    -- Location
    city VARCHAR(100),
    region VARCHAR(100),
    country CHAR(2),
    coordinates POINT,

    -- Media
    cover_image_url TEXT,
    images TEXT[],

    -- Monetization
    is_paid BOOLEAN DEFAULT FALSE,
    monthly_price NUMERIC(10, 2),
    currency VARCHAR(10) DEFAULT 'XOF',
    trial_period_days INTEGER DEFAULT 0 CHECK (trial_period_days IN (0, 1, 3, 7, 30)),

    -- Stats
    views_count INTEGER DEFAULT 0,

    status VARCHAR(50) DEFAULT 'ACTIVE',
    embedding VECTOR(1536),

    -- Ownership
    created_by UUID REFERENCES talents(id) ON DELETE SET NULL,
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,

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
CREATE INDEX idx_communities_organization_id ON communities(organization_id);
CREATE INDEX idx_communities_deleted_at ON communities(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_communities_access_type ON communities(access_type);
CREATE INDEX idx_communities_tags ON communities USING GIN(tags);
CREATE INDEX idx_communities_sectors ON communities USING GIN(sectors);

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

    embedding VECTOR(1536),
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
CREATE INDEX idx_opportunities_views_count ON opportunities(views_count DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_opportunities_type ON opportunities(type);
CREATE INDEX idx_opportunities_status ON opportunities(status);
CREATE INDEX idx_opportunities_location_type ON opportunities(location_type);
CREATE INDEX idx_opportunities_deadline ON opportunities(deadline);
CREATE INDEX idx_opportunities_deleted_at ON opportunities(deleted_at) WHERE deleted_at IS NULL;

-- Trigger for updated_at
CREATE TRIGGER trigger_opportunities_updated_at
    BEFORE UPDATE ON opportunities
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- ═══════════════════════════════════════════════════════════════
-- RELATIONS (EDGES)
-- ═══════════════════════════════════════════════════════════════

-- RELATION: HAS_SKILL (Talent -> Skill, self-contained)
CREATE TABLE talent_skills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    talent_id UUID REFERENCES talents(id) ON DELETE CASCADE,
    canonical_name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- KNOWLEDGE, SOFT_SKILL, HARD_SKILL
    proficiency_level VARCHAR(20) NOT NULL, -- BEGINNER, INTERMEDIATE, EXPERT, MASTER
    origin VARCHAR(20) DEFAULT 'declared', -- declared, inferred, extracted
    document_id UUID, -- Source document if extracted
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

-- talent_experiences and talent_educations removed in migration 051

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

    -- Resume/CV
    cv_url TEXT,
    attachments JSONB DEFAULT '[]'::jsonb,

    -- Recruiter internal data
    internal_notes TEXT,
    star_rating INTEGER,
    viewed_at TIMESTAMP WITH TIME ZONE,

    -- Interview scheduling
    interview_scheduled_at TIMESTAMP WITH TIME ZONE,
    interview_type VARCHAR(50),
    interview_location TEXT,
    interview_notes TEXT,

    -- Timestamps
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(talent_id, opportunity_id)
);

CREATE INDEX idx_opportunity_applications_talent_id ON opportunity_applications(talent_id);
CREATE INDEX idx_opportunity_applications_opportunity_id ON opportunity_applications(opportunity_id);
CREATE INDEX idx_opportunity_applications_talent_opportunity ON opportunity_applications(talent_id, opportunity_id);
CREATE INDEX idx_opportunity_applications_status ON opportunity_applications(status);
CREATE INDEX idx_opportunity_applications_viewed_at ON opportunity_applications(viewed_at);
CREATE INDEX idx_opportunity_applications_star_rating ON opportunity_applications(star_rating) WHERE star_rating IS NOT NULL;
CREATE INDEX idx_opportunity_applications_interview_scheduled ON opportunity_applications(interview_scheduled_at) WHERE interview_scheduled_at IS NOT NULL;

-- Trigger for updated_at
CREATE TRIGGER trigger_opportunity_applications_updated_at
    BEFORE UPDATE ON opportunity_applications
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- APPLICATION MESSAGES (Candidate <-> Organization conversation)
CREATE TABLE application_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID NOT NULL REFERENCES opportunity_applications(id) ON DELETE CASCADE,

    -- Sender information
    sender_type VARCHAR(20) NOT NULL,
    sender_id UUID NOT NULL,

    -- Message content
    content TEXT NOT NULL,

    -- Rich content support
    attachments JSONB DEFAULT '[]'::jsonb,

    -- Datetime sharing for interview scheduling
    proposed_datetime TIMESTAMP WITH TIME ZONE,
    datetime_type VARCHAR(50),

    -- Status
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_application_messages_application_id ON application_messages(application_id);
CREATE INDEX idx_application_messages_sender_type ON application_messages(sender_type);
CREATE INDEX idx_application_messages_sender_id ON application_messages(sender_id);
CREATE INDEX idx_application_messages_is_read ON application_messages(is_read) WHERE is_read = FALSE;
CREATE INDEX idx_application_messages_created_at ON application_messages(created_at);

-- Trigger for updated_at
CREATE TRIGGER trigger_application_messages_updated_at
    BEFORE UPDATE ON application_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- RELATION: MENTORS (Talent -> Talent)
CREATE TABLE mentorships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mentor_id UUID REFERENCES talents(id) ON DELETE CASCADE,
    mentee_id UUID REFERENCES talents(id) ON DELETE CASCADE,

    focus_areas TEXT[], -- Free-text skill names
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
    highlighted_skills TEXT[], -- Free-text skill names

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    visibility VARCHAR(50) DEFAULT 'PUBLIC',

    UNIQUE(recommender_id, recommended_id)
);

CREATE INDEX idx_recommendations_recommender_id ON recommendations(recommender_id);
CREATE INDEX idx_recommendations_recommended_id ON recommendations(recommended_id);

-- RELATION: MEMBER_OF (Talent -> Community)
CREATE TABLE community_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    talent_id UUID REFERENCES talents(id) ON DELETE CASCADE,
    community_id UUID REFERENCES communities(id) ON DELETE CASCADE,

    -- Role & Permissions (Simplified: ADMIN = org members, MEMBER = everyone else)
    role VARCHAR(20) DEFAULT 'MEMBER' CHECK (role IN ('ADMIN', 'MEMBER')),
    membership_type VARCHAR(50),
    permissions JSONB DEFAULT '[]'::jsonb,

    -- Status
    status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('PENDING', 'ACTIVE', 'REJECTED', 'SUSPENDED', 'ARCHIVED')),

    -- Application
    answers JSONB,
    accepted_rules BOOLEAN DEFAULT FALSE,

    -- Dates
    joined_at DATE DEFAULT CURRENT_DATE,
    left_at DATE,
    is_active BOOLEAN DEFAULT TRUE,
    rejected_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(talent_id, community_id)
);

CREATE INDEX idx_community_members_community_id ON community_members(community_id);
CREATE INDEX idx_community_members_is_active ON community_members(is_active);
CREATE INDEX idx_community_members_status ON community_members(status);
CREATE INDEX idx_community_members_community_talent ON community_members(community_id, talent_id);
CREATE INDEX idx_community_members_community_status ON community_members(community_id, status);

-- Trigger for updated_at
CREATE TRIGGER trigger_community_members_updated_at
    BEFORE UPDATE ON community_members
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- COMMUNITY INVITATIONS (Admin-sent invitations to join communities)
CREATE TABLE community_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- References
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    invited_by UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
    
    -- Invitee (can be existing user OR email-only for non-registered users)
    invitee_talent_id UUID REFERENCES talents(id) ON DELETE CASCADE,
    invitee_email VARCHAR(255) NOT NULL,
    invitee_name VARCHAR(255),
    
    -- Invitation details
    message TEXT,
    role VARCHAR(50) DEFAULT 'MEMBER' CHECK (role IN ('ADMIN', 'MEMBER')),
    
    -- Status tracking
    status VARCHAR(50) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELLED')),
    
    -- Token for email verification (for non-registered users)
    invitation_token VARCHAR(255) UNIQUE,
    
    -- Timestamps
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    viewed_at TIMESTAMP WITH TIME ZONE,
    responded_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days'),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_community_invitations_community_id ON community_invitations(community_id);
CREATE INDEX idx_community_invitations_invitee_talent_id ON community_invitations(invitee_talent_id) WHERE invitee_talent_id IS NOT NULL;
CREATE INDEX idx_community_invitations_invitee_email ON community_invitations(invitee_email);
CREATE INDEX idx_community_invitations_invited_by ON community_invitations(invited_by);
CREATE INDEX idx_community_invitations_status ON community_invitations(status);
CREATE INDEX idx_community_invitations_token ON community_invitations(invitation_token) WHERE invitation_token IS NOT NULL;

CREATE TRIGGER trigger_community_invitations_updated_at
    BEFORE UPDATE ON community_invitations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- (Legacy tables project_skills, opportunity_skills, organization_skills removed — skills are now in talent_skills only)

-- ═══════════════════════════════════════════════════════════════
-- COMMUNITY ACTIVITIES & INTERACTIONS
-- ═══════════════════════════════════════════════════════════════

-- Community Activities (Posts, Events, Polls)
CREATE TABLE community_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
    
    type VARCHAR(20) NOT NULL CHECK (type IN ('POST', 'EVENT', 'POLL')),
    content TEXT NOT NULL,
    
    -- Metadata (Event details, Poll config, etc.)
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Attachments (Images, Documents)
    attachments JSONB DEFAULT '[]'::jsonb,
    
    -- Status and Moderation
    is_pinned BOOLEAN DEFAULT FALSE,
    moderation_status VARCHAR(20) DEFAULT 'PENDING' CHECK (moderation_status IN ('APPROVED', 'FLAGGED', 'PENDING', 'REJECTED')),
    moderation_reason TEXT,
    
    -- Counters (denormalized for performance)
    reactions_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    shares_count INTEGER DEFAULT 0,
    views_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_community_activities_community_id ON community_activities(community_id);
CREATE INDEX idx_community_activities_author_id ON community_activities(community_id);
CREATE INDEX idx_community_activities_type ON community_activities(type);
CREATE INDEX idx_community_activities_created_at ON community_activities(created_at);
CREATE INDEX idx_community_activities_moderation_status ON community_activities(moderation_status);

CREATE TRIGGER trigger_community_activities_updated_at
    BEFORE UPDATE ON community_activities
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Activity Reactions (Likes)
CREATE TABLE community_activity_reactions (
    activity_id UUID NOT NULL REFERENCES community_activities(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL DEFAULT 'LIKE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (activity_id, user_id)
);

-- Activity Comments
CREATE TABLE community_activity_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    activity_id UUID NOT NULL REFERENCES community_activities(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
    
    content TEXT NOT NULL,
    parent_id UUID REFERENCES community_activity_comments(id) ON DELETE CASCADE,
    
    moderation_status VARCHAR(20) DEFAULT 'PENDING' CHECK (moderation_status IN ('APPROVED', 'FLAGGED', 'PENDING', 'REJECTED')),
    
    reactions_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_community_comments_activity_id ON community_activity_comments(activity_id);
CREATE INDEX idx_community_comments_parent_id ON community_activity_comments(parent_id);

CREATE TRIGGER trigger_community_activity_comments_updated_at
    BEFORE UPDATE ON community_activity_comments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Activity Bookmarks
CREATE TABLE community_activity_bookmarks (
    activity_id UUID NOT NULL REFERENCES community_activities(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (activity_id, user_id)
);

-- Poll Options
CREATE TABLE community_poll_options (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    activity_id UUID NOT NULL REFERENCES community_activities(id) ON DELETE CASCADE,
    text VARCHAR(255) NOT NULL,
    order_index INTEGER NOT NULL DEFAULT 0,
    votes_count INTEGER DEFAULT 0
);

CREATE INDEX idx_community_poll_options_activity_id ON community_poll_options(activity_id);

-- Poll Votes
CREATE TABLE community_poll_votes (
    activity_id UUID NOT NULL REFERENCES community_activities(id) ON DELETE CASCADE,
    option_id UUID NOT NULL REFERENCES community_poll_options(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (activity_id, user_id)
);

-- ═══════════════════════════════════════════════════════════════
-- COMMUNITY MONETIZATION
-- ═══════════════════════════════════════════════════════════════

-- Community Subscriptions
CREATE TABLE community_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    talent_id UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CANCELLED', 'EXPIRED', 'TRIAL', 'PAST_DUE')),

    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    trial_ends_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    current_period_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    cancelled_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,

    amount NUMERIC(10, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'XOF',

    paystack_subscription_code VARCHAR(100) DEFAULT NULL,
    paystack_customer_code VARCHAR(100) DEFAULT NULL,
    paystack_email_token VARCHAR(100) DEFAULT NULL,
    paystack_plan_code VARCHAR(100) DEFAULT NULL,

    auto_renew BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT community_subscriptions_unique_active UNIQUE (community_id, talent_id)
);

CREATE INDEX idx_community_subscriptions_community ON community_subscriptions(community_id);
CREATE INDEX idx_community_subscriptions_talent ON community_subscriptions(talent_id);
CREATE INDEX idx_community_subscriptions_status ON community_subscriptions(status);
CREATE INDEX idx_community_subscriptions_expiry ON community_subscriptions(current_period_end) WHERE status IN ('ACTIVE', 'TRIAL');

CREATE TRIGGER trigger_community_subscriptions_updated_at
    BEFORE UPDATE ON community_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Community Payments
CREATE TABLE community_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subscription_id UUID NOT NULL REFERENCES community_subscriptions(id) ON DELETE CASCADE,

    amount NUMERIC(10, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'XOF',

    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED')),

    paystack_reference VARCHAR(100) UNIQUE,
    paystack_transaction_id VARCHAR(100) DEFAULT NULL,
    paystack_authorization_code VARCHAR(100) DEFAULT NULL,

    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,

    failure_reason TEXT DEFAULT NULL,
    failure_code VARCHAR(50) DEFAULT NULL,
    retry_count INTEGER DEFAULT 0,
    next_retry_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,

    metadata JSONB DEFAULT '{}',

    paid_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_community_payments_subscription ON community_payments(subscription_id);
CREATE INDEX idx_community_payments_status ON community_payments(status);
CREATE INDEX idx_community_payments_reference ON community_payments(paystack_reference) WHERE paystack_reference IS NOT NULL;

-- Community Invoices
CREATE TABLE community_invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_id UUID NOT NULL REFERENCES community_payments(id) ON DELETE CASCADE,
    subscription_id UUID NOT NULL REFERENCES community_subscriptions(id) ON DELETE CASCADE,
    talent_id UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,

    invoice_number VARCHAR(50) UNIQUE NOT NULL,

    amount NUMERIC(10, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'XOF',

    community_name VARCHAR(255) NOT NULL,

    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,

    pdf_url TEXT DEFAULT NULL,
    pdf_generated_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,

    status VARCHAR(20) DEFAULT 'ISSUED' CHECK (status IN ('DRAFT', 'ISSUED', 'PAID', 'VOID')),

    issued_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_community_invoices_talent ON community_invoices(talent_id);
CREATE INDEX idx_community_invoices_subscription ON community_invoices(subscription_id);
CREATE INDEX idx_community_invoices_community ON community_invoices(community_id);
CREATE INDEX idx_community_invoices_number ON community_invoices(invoice_number);

-- ═══════════════════════════════════════════════════════════════
-- COMMUNITY NOTIFICATIONS
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE community_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    talent_id UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,

    type VARCHAR(50) NOT NULL CHECK (type IN (
        'MENTION', 'COMMENT_REPLY', 'NEW_ACTIVITY', 'EVENT_REMINDER_1D', 'EVENT_REMINDER_1H',
        'SUBSCRIPTION_EXPIRING', 'SUBSCRIPTION_EXPIRED', 'PAYMENT_FAILED', 'PAYMENT_SUCCESS',
        'MEMBERSHIP_APPROVED', 'MEMBERSHIP_REJECTED'
    )),

    activity_id UUID REFERENCES community_activities(id) ON DELETE CASCADE,
    comment_id UUID REFERENCES community_activity_comments(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES talents(id) ON DELETE SET NULL,

    title VARCHAR(255) NOT NULL,
    body TEXT DEFAULT NULL,

    data JSONB DEFAULT '{}',

    read_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,

    scheduled_for TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_community_notifications_talent ON community_notifications(talent_id);
CREATE INDEX idx_community_notifications_community ON community_notifications(community_id);
CREATE INDEX idx_community_notifications_type ON community_notifications(type);
CREATE INDEX idx_community_notifications_unread ON community_notifications(talent_id, created_at DESC) WHERE read_at IS NULL;
CREATE INDEX idx_community_notifications_user_community ON community_notifications(talent_id, community_id, created_at DESC);

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

