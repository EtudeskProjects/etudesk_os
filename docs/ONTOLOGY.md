# Etudesk Platform Ontology (Runtime-Aligned)

> Version aligned with the current codebase behavior (backend + mobile + copilot workflows).
> Last updated: 2026-02-21.

---

## 0. Scope and Source of Truth

This ontology documents the platform as it is currently implemented.

Priority order for truth:
1. Runtime behavior in services/routes/tools
2. SQL actually queried by runtime code
3. Current frontend confirmation protocol
4. This ontology document

Notes:
- This is intentionally implementation-first, not idealized OWL.
- Section 5 (action ontology) and section 8 (copilot mapping) are reference-only for humans and are stripped from agent runtime prompt injection by `ontology.cache.ts`.

---

## 1. Entity Model (Current)

### 1.1 Core Actors

| Entity | Description |
|---|---|
| `User` | Authentication account (email/session/otp scope) |
| `Talent` | Personal profile and activity owner |
| `Organization` | Company/institution profile |
| `SystemAgent` | Platform automations (notifications, scheduled jobs, embeddings) |

### 1.2 Core Resources

| Entity | Description |
|---|---|
| `Community` | Group space owned by an organization |
| `CommunityActivity` | Feed publication (`POST`, `EVENT`, `POLL`) |
| `Opportunity` | Job/internship/freelance/volunteer listing |
| `Space` | Bookable physical resource |
| `TalentDocument` | Document owned by a talent |
| `OrganizationDocument` | Document owned by an organization |
| `TalentSkill` | Skill record attached to a talent |
| `CopilotSession` | AI conversation session |
| `CopilotMessage` | Message in a copilot session |
| `CopilotTrace` | Copilot execution telemetry + user feedback |
| `AgendaTrigger` | Reminder/follow-up trigger (talent or org scope) |

### 1.3 Relationship Objects

| Entity | Connects |
|---|---|
| `OrganizationMember` | Talent <-> Organization |
| `CommunityMember` | Talent <-> Community |
| `OpportunityApplication` | Talent <-> Opportunity |
| `SpaceBooking` | Talent <-> Space |
| `CommunitySubscription` | Talent <-> Community (paid) |
| `OpportunityPoster` | Opportunity <-> Talent/Organization poster |
| `CommunityInvitation` | Community -> Talent |
| `OrganizationInvitation` | Organization -> Talent(email) |
| `OpportunityInvitation` | Opportunity -> Talent |
| `SpaceInvitation` | Space -> Talent |
| `CommunityActivityReaction` | Talent -> CommunityActivity |
| `CommunityActivityBookmark` | Talent -> CommunityActivity |
| `OpportunityBookmark` | Talent -> Opportunity |
| `CommunityPollVote` | Talent -> Poll option/activity |

---

## 2. Data Properties (Implemented)

### 2.1 Talent

- Identity/profile: `slug`, `first_name`, `last_name`, `email`, `phone`, `bio`, `avatar_url`, `gender`
- Location/mobility: `city`, `region`, `country`, `remote_ready`, `willing_to_relocate`
- Positioning: `profile_tags[]`, `goals[]`, `sectors[]`
- Visibility/AI: `is_visible`, `embedding`
- Lifecycle: `created_at`, `updated_at`, `deleted_at`

### 2.2 Organization

- Core: `name`, `slug`, `types[]`, `sectors[]`, `goals[]`, `description`
- Contact/brand: `logo_url`, `website_url`, `contact_email`, `contact_phone`
- HQ: `headquarters_city`, `headquarters_region`, `headquarters_country`, `headquarters_coordinates`
- Trust/AI: `verification_status`, `is_visible`, `embedding`, `culture_summary`
- Ownership: `created_by`
- Lifecycle: `created_at`, `updated_at`, `deleted_at`

### 2.3 Community

- Core: `name`, `slug`, `type`, `description`, `rules`, `application_questions[]`
- Access/visibility: `access_type`, `visibility`
- Market data: `tags(jsonb)`, `sectors(jsonb)`, `city`, `region`, `country`, `coordinates`
- Media/monetization: `cover_image_url`, `images[]`, `is_paid`, `monthly_price`, `currency`, `trial_period_days`
- State/ownership: `status`, `organization_id`, `created_by`, `embedding`
- Lifecycle: `created_at`, `updated_at`, `deleted_at`

### 2.4 Opportunity

- Core: `title`, `slug`, `type`, `contract_type`, `work_rhythm`, `summary`, `requirements`, `nice_to_have`
- Fit/matching: `sectors[]`, `cv_required`, `application_questions(jsonb)`, `ideal_candidate_summary`
- Compensation: `compensation_min`, `compensation_max`, `currency`, `compensation_frequency`
- Location: `location_type`, `locations(jsonb)`
- Media/visibility: `cover_image_url`, `images[]`, `attachments(jsonb)`, `visibility`
- Timeline: `posted_at`, `deadline`, `start_date`, `duration(interval)`
- State/ownership: `status`, `organization_id`, `embedding`
- Lifecycle: `created_at`, `updated_at`, `deleted_at`

### 2.5 Space

- Core: `name`, `slug`, `type`, `description`, `surface_m2`, `capacity`
- Location: `floor_number`, `address`, `city`, `region`, `country`, `coordinates`
- Infrastructure: `equipment[]`, `amenities[]`, `sectors[]`
- Accessibility: `is_accessible`, `accessibility_features[]`, `accessibility_notes`
- Media: `cover_image_url`, `gallery_images[]`
- Pricing/policy: `hourly_rate`, `daily_rate`, `weekly_rate`, `monthly_rate`, `deposit_amount`
- Booking controls: `is_bookable`, `min_booking_hours`, `max_booking_hours`, `advance_booking_days`, `cancellation_hours`, `booking_rules[]`, `requires_approval`, `questions[]`
- Visibility/contact: `visibility`, `contact_name`, `contact_phone`, `contact_email`
- Ownership/state: `organization_id`, `created_by`, `status`
- Lifecycle: `created_at`, `updated_at`, `deleted_at`

### 2.6 Documents and Skills

- `TalentDocument`: typed, categorized, processing status, verification fields, soft-delete
- `OrganizationDocument`: typed, categorized, processing status, soft-delete
- `Competency` (catalog, single source of truth): `slug`, `family`, `type`, `name`, `name_fr`, `catalog_version`. Seeded from `datasets/etudesk_digital_skills` by `scripts/seed-competencies.ts`. `competency_edges` holds the prerequisite/co_occurrence/sibling graph.
- `TalentSkill` (catalog-constrained UserCompetency): `competency_slug` (FK -> `competencies.slug`), `level`, `score`, `confidence`, `axis_a/c/i/t`, `origin`, `context[]`, `source_ref[]`, `inferred_from[]`, `decay_state`, `catalog_version`, `framework_version`, `is_visible`. Type/family are read from the joined catalog row. **Skills are catalog-constrained: only `competency_slug` values from the referential are valid — labels must be resolved to a slug (catalog.service) before any write.**
- Entity skill tags (catalog only): `opportunity_skills` (required|nice_to_have, weight, min_level), `community_skills` (validates|topic), `space_skills` (validates|equipment).

### 2.7 Copilot and Planning

- `CopilotSession`: `mode` in (`explore`,`study`,`org`), optional `organization_id`, soft-delete
- `CopilotMessage`: role/content/tool payloads/output payloads, soft-delete
- `CopilotTrace`: execution metrics + optional user rating
- `AgendaTrigger` (runtime-used): `scope` (`TALENT`/`ORGANIZATION`), `code`, `title`, `description`, `due_at`, `status`, `priority`, `metadata`, `created_by`

---

## 3. Enumerations and Controlled Values (Runtime)

### 3.1 Stable canonical enums

- `ProfileTag`: `STUDENT`, `PUPIL`, `JOB_SEEKER`, `SALARIED`, `ENTREPRENEUR`, `CIVIL_SERVANT`, `MANAGER`, `CONSULTANT`, `INVESTOR`, `CONTENT_CREATOR`, `COACH`, `RETIRED`
- `Goal`: `LEARN_NEW_SKILLS`, `PREPARE_EXAMS`, `FIND_JOB`, `ADVANCE_CAREER`, `RESEARCH_SUPPORT`, `IMPROVE_PRODUCTIVITY`, `COLLABORATIVE_LEARNING`, `TEACH_OR_MENTOR`, `BUILD_NETWORK_OR_VISIBILITY`, `CONTRIBUTE_OR_GIVE_BACK`
- `Sector`: `AGRICULTURE`, `RESOURCES`, `ENERGY`, `ENVIRONMENT`, `INDUSTRY`, `CONSTRUCTION`, `TRANSPORT`, `COMMERCE`, `FINANCE`, `DIGITAL`, `MEDIA`, `TOURISM`, `HEALTH`, `EDUCATION`, `PROFESSIONAL_SERVICES`, `RESEARCH`, `PUBLIC`, `SECURITY`, `SOCIAL_IMPACT`, `PERSONAL_SERVICES`, `CRAFTS`
- `OpportunityStatus`: `DRAFT`, `OPEN`, `PAUSED`, `FILLED`, `EXPIRED`
- `ApplicationStatus`: `SUBMITTED`, `IN_REVIEW`, `ACCEPTED`, `REJECTED`
- `CompetencyType` (catalog `competencies.type`): `knowledge`, `hard_skill`, `soft_skill`, `tool_platform`, `language`
- `Level` (talent_skills.level, EVALUATION_FRAMEWORK): `beginner`, `intermediate`, `advanced`, `master` (scores 1..4; `master` is only written by the evaluation service with confidence >= 0.80 and recent direct evidence)
- `SkillOrigin`: `declared`, `inferred`, `extracted`, `validated` (validated = system-driven via participation; agents never set it)
- `DecayState`: `active`, `stale`, `archived`

### 3.2 Community/Access values in current workflows

The codebase currently accepts multiple vocabularies depending on entry path:
- Canonical model constants: `CommunityType` = `ONLINE|OFFLINE|HYBRID`, `AccessType` = `PUBLIC|MEMBERSHIP`
- Copilot creation workflow defaults: `type=PROFESSIONAL`, `access_type=OPEN`
- Validation middleware may accept: `GENERAL|PROFESSIONAL|ALUMNI|INTEREST|LOCAL|LEARNING|ONLINE|OFFLINE|HYBRID` and `OPEN|APPROVAL|INVITE_ONLY|PAID`

Therefore `community.type` and `community.access_type` are currently treated as controlled-but-not-single-source fields.

### 3.3 Invitation expiration policies (implemented)

- `organization_invitations`: default 7 days
- `community_invitations`: default 30 days
- `opportunity_invitations`: default 30 days
- `space_invitations`: default 30 days

---

## 4. Object Relationships (Implemented)

### 4.1 Ownership and creation

- `Organization.created_by -> Talent`
- `Community.created_by -> Talent`, `Community.organization_id -> Organization`
- `Opportunity.organization_id -> Organization`, poster links via `OpportunityPoster`
- `Space.organization_id -> Organization`, `Space.created_by -> Talent`
- `TalentDocument.talent_id -> Talent`
- `OrganizationDocument.organization_id -> Organization`, `uploaded_by -> Talent`
- `CopilotSession.talent_id -> Talent`, optional `organization_id -> Organization`
- `CopilotMessage.session_id -> CopilotSession`

### 4.2 Membership and participation

- `OrganizationMember(organization_id, talent_id, role, status)`
- `CommunityMember(community_id, talent_id, role, status)`
- `OpportunityApplication(opportunity_id, talent_id, status)`
- `SpaceBooking(space_id, talent_id, organization_id, status)`
- `CommunitySubscription(community_id, talent_id, status)`

### 4.3 Engagement

- `CommunityActivity(author_id, community_id, type)`
- `CommunityActivityReaction(activity_id, user_id)`
- `CommunityActivityComment(activity_id, author_id, parent_id)`
- `CommunityPollVote(activity_id, option_id, user_id)`
- `OpportunityBookmark(talent_id, opportunity_id)`
- `CommunityActivityBookmark(activity_id, user_id)`

---

## 5. Action Ontology (Current Runtime)

### 5.1 Confirmation channels

Two write channels coexist:
1. **Tool execution** via `execute_action` (agent tool)
2. **Frontend confirmation endpoint** `/api/copilot/confirm` (uses `action.handler.ts`)

`/api/copilot/confirm` requires both `action` and **non-empty** `entityId`.

### 5.2 `execute_action` supported actions

- `apply_opportunity`
- `join_community`
- `book_space`
- `accept_invitation` (community + organization invitations)
- `decline_invitation` (community + organization invitations)
- `create_agenda_trigger`
- `update_agenda_trigger`

### 5.3 `/confirm` (`action.handler`) supported actions

- `apply_opportunity`
- `join_community`
- `book_space`
- `accept_invitation`
- `decline_invitation`
- `publish_opportunity`
- `create_community`
- `create_space`
- `update_profile`
- `create_agenda_trigger`
- `update_agenda_trigger`

### 5.4 SQL intents (`sql_query`) currently implemented

Talent:
- `my_profile`, `my_applications`, `my_reservations`, `my_invitations`, `my_communities`, `my_bookmarks`, `my_documents`, `my_skills`, `my_triggers`, `my_community_feed`, `my_community_members`

Organization:
- `org_members`, `org_applications`, `org_stats`, `org_opportunities`, `org_communities`, `org_spaces`, `org_invitations`, `org_triggers`, `org_documents`, `org_talents`, `org_talent_profile`, `org_community_feed`, `org_community_members`

Analytics:
- `org_skills_analytics`, `org_application_funnel`, `org_talent_cohorts`, `org_geo_distribution`, `org_community_engagement`, `org_opportunity_performance`

Declared but not implemented in switch-case:
- `create_activity`, `respond_invitation`, `update_application`, and action-like intents listed in constants are not executable via `sql_query`.

---

## 6. Permissions and Role Rules (As Implemented)

### 6.1 Talent-side

- Apply to opportunity: requires opportunity `OPEN`, deadline valid, no duplicate application; KYC verified check enforced in confirmation validator path.
- Join community: checks community exists + `ACTIVE` + not already active member.
- Book space: checks space `ACTIVE` + start/end provided + no conflicting booking.
- Invitation response: community and organization invitations handled in current action logic.
- Profile update via confirmation is allowed for whitelisted fields (`bio`, `city`, `country`, `goals`, `remote_ready`, `willing_to_relocate`, `profile_tags`, `sectors`).

### 6.2 Organization-side (current validators)

- `publish_opportunity`: `OWNER` or `ADMIN`
- `create_space`: `OWNER` or `ADMIN`
- `create_community`: any active organization member

### 6.3 ORG copilot access control

- ORG agent SQL intents are restricted to `org_*` + org analytics intents only.
- ORG session access requires active membership in target organization.

---

## 7. Business Rules (Implemented)

### 7.1 Persistence/lifecycle

- Soft delete present on major entities (`deleted_at`) and queried in most read paths.
- Document limits enforced by DB trigger:
  - Talent docs <= 20
  - Organization docs <= 50

### 7.2 Booking and scheduling

- No overlapping pending/confirmed bookings on identical `(space_id, start_datetime, end_datetime)` via unique partial index.
- Runtime availability checks also evaluate `space_unavailabilities`.

### 7.3 Invitation expiry

- Organization: 7 days
- Community/opportunity/space: 30 days

### 7.4 Copilot skill management

- `manage_skills` resolves a skill LABEL to a catalog `competency_slug` (rejects non-catalog labels, returning suggestions). It writes through the evaluation service (framework guards apply) and is capped at `advanced` — the agent can never write `master`.
- `remove` is not supported
- Stronger evaluations (higher score / direct evidence) win; weaker repeats do not downgrade.
- Participation validates skills automatically: opportunity acceptance, community membership (soft skills), confirmed space/workshop bookings (hard skills/tools) — written with `origin='validated'`.

---

## 8. Copilot Agent Mapping (Current)

### 8.1 Mode -> tools

- `EXPLORE` (Talent Agent): `smart_search`, `sql_query`, `generate_document`, `file_reader`, `web_search`, `execute_action`
- `STUDY` (Talent Agent): restricted `sql_query`, `youtube_search`, `generate_image`, `generate_diagram`, `file_reader`, `web_search`, `manage_skills`, `execute_action`
- `ORG` (Organization Agent): `smart_search`, restricted `sql_query`, `generate_document`, `web_search`, `execute_action`, org-scoped `file_reader`

### 8.2 Study mode SQL whitelist

In study mode, `sql_query` is runtime-restricted to:
- `my_profile`, `my_triggers`, `my_community_feed`, `my_community_members`

`my_skills` and `my_documents` are expected from preloaded context, not re-queried via SQL tool.

### 8.3 Runtime ontology injection behavior

- Agent prompt injection uses ontology cache variants.
- Sections 5 and 8 from this file are removed in runtime slim ontology injection.

---

## 9. Integrity Constraints to Preserve

1. Keep this ontology synchronized with:
- `backend/src/services/copilot/tools/*.ts`
- `backend/src/services/copilot/actions/*.ts`
- `backend/src/services/copilot/agents/*.ts`
- `backend/src/routes/copilot.ts`
- `mobile/src/components/copilot/*`

2. Any new write action must be declared in all relevant layers:
- tool schema (if tool-based)
- confirmation block contract (`entity_id`/`data`)
- backend execution path
- this ontology

3. Any role change must update both:
- validator enforcement
- ontology permissions matrix

