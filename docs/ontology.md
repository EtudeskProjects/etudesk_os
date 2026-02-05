# Etudesk Platform Ontology (OWL-structured)

> Complete ontology of all entities, relationships, actions, and permissions on the Etudesk platform.

---

## 1. Classes (Entities)

### 1.1 Core Actors

| Class | Description | Superclass |
|-------|-------------|------------|
| `Agent` | Abstract root class for all actors | `owl:Thing` |
| `Talent` | Individual user (student, job seeker, professional…) | `Agent` |
| `Organization` | Legal entity (company, startup, NGO, institution…) | `Agent` |
| `SystemAgent` | Platform system (automated actions, copilot) | `Agent` |

### 1.2 Core Resources

| Class | Description | Superclass |
|-------|-------------|------------|
| `Resource` | Abstract root class for all platform objects | `owl:Thing` |
| `Community` | Group of talents around a topic or organization | `Resource` |
| `Opportunity` | Job, internship, freelance gig, volunteer posting | `Resource` |
| `Space` | Bookable physical location (room, coworking, studio…) | `Resource` |
| `TalentDocument` | File strictly owned by a talent (CV, diploma, certificate…) | `Resource` |
| `TalentSkill` | Competency strictly associated with a specific talent | `Resource` |
| `Publication` | Community activity (post, event, poll) | `Resource` |
| `Comment` | Threaded comment on a publication | `Resource` |
| `Notification` | System or community notification | `Resource` |
| `CopilotSession` | AI assistant conversation session | `Resource` |

### 1.3 Relationship Objects (Reified Relations)

| Class | Description | Connects |
|-------|-------------|----------|
| `Membership` | Talent belonging to a community | Talent → Community |
| `OrgMembership` | Talent belonging to an organization | Talent → Organization |
| `Application` | Talent applying to an opportunity | Talent → Opportunity |
| `Booking` | Talent reserving a space | Talent → Space |
| `Subscription` | Talent subscribing to a paid community | Talent → Community |
| `OrgInvitation` | Organization inviting a talent to join (as ADMIN, MANAGER, or MEMBER) | Organization → Talent |
| `OfferInvitation` | Organization inviting a talent to an offer (Community, Opportunity, or Space) | Organization → Talent |
| `Reaction` | Talent liking a publication | Talent → Publication |
| `Bookmark` | Talent saving a resource for later | Talent → Resource |
| `PollVote` | Talent voting on a poll option | Talent → Publication(POLL) |

---

## 2. Datatype Properties (Attributes)

### 2.1 Talent

| Property | Type | Constraints |
|----------|------|-------------|
| `slug` | `xsd:string` | unique |
| `firstName` | `xsd:string` | required |
| `lastName` | `xsd:string` | required |
| `email` | `xsd:string` | unique, via User |
| `phone` | `xsd:string` | optional |
| `bio` | `xsd:string` | optional |
| `avatarUrl` | `xsd:anyURI` | optional |
| `gender` | `xsd:string` | optional |
| `city` | `xsd:string` | optional |
| `region` | `xsd:string` | optional |
| `country` | `xsd:string` | optional |
| `remoteReady` | `xsd:boolean` | default false |
| `willingToRelocate` | `xsd:boolean` | default false |
| `profileTags` | `ProfileTag[]` | enum, multi-valued |
| `goals` | `Goal[]` | enum, multi-valued |
| `sectors` | `Sector[]` | enum, multi-valued |
| `learningPreferences` | `LearningPreference` | JSONB (Style, Interaction, Depth, Difficulty) |
| `embedding` | `vector(1536)` | auto-computed |
| `isVisible` | `xsd:boolean` | default true |

### 2.2 Organization

| Property | Type | Constraints |
|----------|------|-------------|
| `name` | `xsd:string` | required |
| `slug` | `xsd:string` | unique |
| `types` | `OrgType[]` | enum, multi-valued |
| `sectors` | `Sector[]` | enum, multi-valued |
| `description` | `xsd:string` | optional |
| `logoUrl` | `xsd:anyURI` | optional |
| `websiteUrl` | `xsd:anyURI` | optional |
| `contactEmail` | `xsd:string` | optional |
| `contactPhone` | `xsd:string` | optional |
| `city` | `xsd:string` | optional |
| `region` | `xsd:string` | optional |
| `country` | `xsd:string` | optional |
| `coordinates` | `geo:Point` | optional |
| `verificationStatus` | `VerificationStatus` | enum |
| `createdBy` | `Talent` | FK, required |
| `embedding` | `vector(1536)` | auto-computed |
| `isVisible` | `xsd:boolean` | default true |

### 2.3 Community

| Property | Type | Constraints |
|----------|------|-------------|
| `name` | `xsd:string` | required |
| `slug` | `xsd:string` | unique |
| `type` | `CommunityType` | enum |
| `description` | `xsd:string` | optional |
| `rules` | `xsd:string` | optional |
| `visibility` | `Visibility` | enum |
| `accessType` | `AccessType` | enum |
| `isPaid` | `xsd:boolean` | default false |
| `monthlyPrice` | `xsd:decimal` | if isPaid |
| `currency` | `xsd:string` | default XOF |
| `trialPeriodDays` | `xsd:integer` | enum: 0,1,3,7,30 |
| `applicationQuestions` | `xsd:string[]` | if accessType=MEMBERSHIP |
| `coverImageUrl` | `xsd:anyURI` | optional |
| `images` | `xsd:anyURI[]` | optional |
| `status` | `CommunityStatus` | enum |
| `organizationId` | `Organization` | FK, required |
| `createdBy` | `Talent` | FK, required |
| `embedding` | `vector(1536)` | auto-computed |

### 2.4 Opportunity

| Property | Type | Constraints |
|----------|------|-------------|
| `title` | `xsd:string` | required |
| `slug` | `xsd:string` | unique |
| `type` | `OpportunityType` | enum |
| `contractType` | `ContractType` | enum |
| `workRhythm` | `WorkRhythm` | enum |
| `summary` | `xsd:string` | optional |
| `requirements` | `xsd:string` | optional |
| `niceToHave` | `xsd:string` | optional |
| `compensationMin` | `xsd:decimal` | optional |
| `compensationMax` | `xsd:decimal` | optional |
| `compensationCurrency` | `xsd:string` | default XOF |
| `compensationFrequency` | `CompensationFrequency` | enum |
| `locationType` | `LocationType` | enum |
| `locations` | `Location[]` | array of objects |
| `cvRequired` | `xsd:boolean` | default false |
| `applicationQuestions` | `xsd:string[]` | optional |
| `status` | `OpportunityStatus` | enum |
| `visibility` | `Visibility` | enum |
| `deadline` | `xsd:dateTime` | optional |
| `startDate` | `xsd:date` | optional |
| `duration` | `xsd:string` | optional |
| `idealCandidateSummary` | `xsd:string` | auto-generated |
| `embedding` | `vector(1536)` | auto-computed |

### 2.5 Space

| Property | Type | Constraints |
|----------|------|-------------|
| `name` | `xsd:string` | required |
| `slug` | `xsd:string` | unique |
| `type` | `SpaceType` | enum |
| `description` | `xsd:string` | optional |
| `surfaceM2` | `xsd:decimal` | optional |
| `capacity` | `xsd:integer` | optional |
| `floorNumber` | `xsd:integer` | optional |
| `address` | `xsd:string` | optional |
| `city` | `xsd:string` | optional |
| `region` | `xsd:string` | optional |
| `country` | `xsd:string` | optional |
| `coordinates` | `geo:Point` | optional |
| `equipment` | `xsd:string[]` | optional |
| `amenities` | `xsd:string[]` | optional |
| `isAccessible` | `xsd:boolean` | default false |
| `accessibilityFeatures` | `xsd:string[]` | optional |
| `coverImageUrl` | `xsd:anyURI` | optional |
| `galleryImages` | `xsd:anyURI[]` | optional |
| `hourlyRate` | `xsd:decimal` | FCFA |
| `dailyRate` | `xsd:decimal` | FCFA |
| `weeklyRate` | `xsd:decimal` | FCFA |
| `monthlyRate` | `xsd:decimal` | FCFA |
| `depositAmount` | `xsd:decimal` | FCFA |
| `isBookable` | `xsd:boolean` | default true |
| `minBookingHours` | `xsd:integer` | optional |
| `maxBookingHours` | `xsd:integer` | optional |
| `advanceBookingDays` | `xsd:integer` | optional |
| `cancellationHours` | `xsd:integer` | optional |
| `status` | `SpaceStatus` | enum |
| `organizationId` | `Organization` | FK, required |

### 2.6 TalentDocument

| Property | Type | Constraints |
|----------|------|-------------|
| `type` | `DocumentType` | enum |
| `category` | `DocumentCategory` | enum |
| `originalFilename` | `xsd:string` | required |
| `mimeType` | `xsd:string` | required |
| `fileSize` | `xsd:integer` | required |
| `fileUrl` | `xsd:anyURI` | required |
| `tags` | `xsd:string[]` | optional |
| `isPublic` | `xsd:boolean` | default false |
| `isVerified` | `xsd:boolean` | default false |
| `verifiedBy` | `xsd:string` | optional |
| `status` | `DocumentStatus` | enum |

### 2.7 TalentSkill

| Property | Type | Constraints |
|----------|------|-------------|
| `canonicalName` | `xsd:string` | required |
| `type` | `SkillType` | enum |
| `proficiencyLevel` | `ProficiencyLevel` | enum |
| `origin` | `SkillOrigin` | enum |
| `documentId` | `TalentDocument` | FK, optional |
| `context` | `xsd:string` | optional |

### 2.8 Publication

| Property | Type | Constraints |
|----------|------|-------------|
| `type` | `PublicationType` | enum: POST, EVENT, POLL |
| `content` | `xsd:string` | required |
| `attachments` | `Attachment[]` | max 5, max 20MB each |
| `metadata` | `xsd:JSON` | event/poll-specific |
| `status` | `PublicationStatus` | enum |
| `moderationStatus` | `ModerationStatus` | enum |
| `isPinned` | `xsd:boolean` | default false |
| `reactionsCount` | `xsd:integer` | computed |
| `commentsCount` | `xsd:integer` | computed |
| `publishedAt` | `xsd:dateTime` | null = immediate |

---

## 3. Enumerations (Named Individuals)

### 3.1 Actor Enums

```
ProfileTag := { STUDENT | PUPIL | JOB_SEEKER | SALARIED | ENTREPRENEUR |
                CIVIL_SERVANT | MANAGER | CONSULTANT | INVESTOR |
                CONTENT_CREATOR | COACH | RETIRED }

Goal := { LEARN_NEW_SKILLS | PREPARE_EXAMS | FIND_JOB | ADVANCE_CAREER |
          RESEARCH_SUPPORT | IMPROVE_PRODUCTIVITY | COLLABORATIVE_LEARNING |
          TEACH_OR_MENTOR | BUILD_NETWORK_OR_VISIBILITY | CONTRIBUTE_OR_GIVE_BACK }

OrgType := { COMPANY | STARTUP | NGO | ASSOCIATION | EDUCATIONAL_INSTITUTION |
             PUBLIC_ADMINISTRATION | TRAINING_CENTER | CONSULTING_FIRM |
             RECRUITMENT_AGENCY | FINANCIAL_INSTITUTION | RESEARCH_CENTER |
             COOPERATIVE | SOCIAL_ENTERPRISE }

VerificationStatus := { CLAIMED | VERIFIED | OFFICIAL }

OrgRole := { OWNER | ADMIN | MANAGER | MEMBER }

OrgMemberStatus := { PENDING | ACTIVE | SUSPENDED }

LearningPreference := {
  STYLE: { VISUAL | AUDITORY | TEXT_BASED | INTERACTIVE },
  INTERACTION: { SOCRATIC | DIRECT | EXPLORATORY },
  DEPTH: { THEORETICAL | PRACTICAL | BALANCED },
  DIFFICULTY: { GENTLE | STANDARD | CHALLENGING }
}
```

### 3.2 Resource Enums

```
Sector := { AGRICULTURE | RESOURCES | ENERGY | ENVIRONMENT | INDUSTRY |
            CONSTRUCTION | TRANSPORT | COMMERCE | FINANCE | DIGITAL |
            MEDIA | TOURISM | HEALTH | EDUCATION | PROFESSIONAL_SERVICES |
            RESEARCH | PUBLIC | SECURITY | SOCIAL_IMPACT |
            PERSONAL_SERVICES | CRAFTS }

Visibility := { PUBLIC | PRIVATE }

CommunityType := { ONLINE | OFFLINE | HYBRID }
CommunityStatus := { ACTIVE | INACTIVE | ARCHIVED }
AccessType := { PUBLIC | MEMBERSHIP }
CommunityRole := { ADMIN | MEMBER }
MembershipStatus := { PENDING | ACTIVE | REJECTED | SUSPENDED | ARCHIVED }
MembershipType := { MEMBER | ALUMNI | STAFF }

OpportunityType := { EMPLOYMENT | INTERNSHIP | ENTREPRENEURSHIP |
                     ALTERNATION | FREELANCE | VOLUNTEER }
OpportunityStatus := { DRAFT | OPEN | PAUSED | FILLED | EXPIRED }
ContractType := { CDI | CDD | APPRENTICESHIP | INTERNSHIP |
                  FREELANCE | SERVICE | INTERIM }
WorkRhythm := { FULL_TIME | PART_TIME | FLEXIBLE | OCCASIONAL }
CompensationFrequency := { HOURLY | MONTHLY | YEARLY | PROJECT }
LocationType := { ON_SITE | REMOTE | HYBRID }
ApplicationStatus := { SUBMITTED | IN_REVIEW | ACCEPTED | REJECTED }

SpaceType := { SALLE_COURS | SALLE_INFORMATIQUE | AMPHITHEATRE |
               SALLE_FORMATION | OPEN_SPACE | BUREAU_PRIVE |
               POSTE_NOMADE | SALLE_REUNION | SALLE_CONFERENCE |
               CABINE_APPEL | ATELIER | LABORATOIRE | STUDIO |
               SALLE_EVENEMENT | ROOFTOP | TERRASSE }
SpaceStatus := { ACTIVE | INACTIVE | MAINTENANCE }
BookingStatus := { PENDING | CONFIRMED | CANCELLED | COMPLETED | NO_SHOW }
PricingType := { HOURLY | DAILY | WEEKLY | MONTHLY }


DocumentType := { CV | CERTIFICATE | DIPLOMA | LICENSE | PORTFOLIO |
                  TRANSCRIPT | PUBLICATION |
                  PATENT | ID_CARD | PASSPORT | DRIVER_LICENSE |
                  STUDENT_CARD | PROOF_OF_ADDRESS | OTHER }
DocumentCategory := { PROFESSIONAL | ACADEMIC | IDENTITY | OTHER }
DocumentStatus := { PENDING | PROCESSING | PROCESSED | FAILED |
                    VERIFIED | REJECTED }

SkillType := { KNOWLEDGE | SOFT_SKILL | HARD_SKILL }
ProficiencyLevel := { BEGINNER | INTERMEDIATE | EXPERT | MASTER }
SkillOrigin := { DECLARED | EXTRACTED | INFERRED }

PublicationType := { POST | EVENT | POLL }
PublicationStatus := { DRAFT | PUBLISHED | ARCHIVED }
ModerationStatus := { APPROVED | FLAGGED | PENDING | REJECTED }

NotificationType := { MENTION | COMMENT_REPLY | NEW_ACTIVITY |
                      EVENT_REMINDER_1D | EVENT_REMINDER_1H |
                      SUBSCRIPTION_EXPIRING | SUBSCRIPTION_EXPIRED |
                      MEMBERSHIP_APPROVED | MEMBERSHIP_REJECTED |
                      APPLICATION_STATUS_CHANGED | NEW_MESSAGE |
                      NEW_APPLICATION | INTERVIEW_SCHEDULED |
                      INTERVIEW_REMINDER | INVITATION_RECEIVED | SYSTEM }

SubscriptionStatus := { ACTIVE | CANCELLED | EXPIRED | TRIAL | PAST_DUE }

InvitationStatus := { PENDING | ACCEPTED | DECLINED | EXPIRED | CANCELLED }


CopilotMode := { EXPLORE | STUDY }
```

---

## 4. Object Properties (Relationships)

### 4.1 Ownership & Creation

| Property | Domain | Range | Inverse | Cardinality |
|----------|--------|-------|---------|-------------|
| `createdBy` | `Organization` | `Talent` | `createdOrganizations` | N:1 |
| `createdBy` | `Community` | `Talent` | `createdCommunities` | N:1 |
| `belongsToOrg` | `Community` | `Organization` | `hasCommunities` | N:1 |
| `hostedBy` | `Space` | `Organization` | `hasSpaces` | N:1 |
| `publishedBy` | `Opportunity` | `Organization` | `hasOpportunities` | N:1 |
| `authoredBy` | `Publication` | `Talent` | `hasPublications` | N:1 |
| `postedIn` | `Publication` | `Community` | `hasFeed` | N:1 |
| `ownedBy` | `TalentDocument` | `Talent` | `hasDocuments` | N:1 |
| `authoredBy` | `Comment` | `Talent` | `hasComments` | N:1 |
| `commentOn` | `Comment` | `Publication` | `hasComments` | N:1 |
| `replyTo` | `Comment` | `Comment` | `hasReplies` | N:1 (optional) |

### 4.2 Membership & Association

| Property | Domain | Range | Cardinality | Note |
|----------|--------|-------|-------------|------|
| `hasMembership` | `Talent` | `Membership` | 1:N | |
| `inCommunity` | `Membership` | `Community` | N:1 | |
| `hasOrgMembership` | `Talent` | `OrgMembership` | 1:N | |
| `inOrganization` | `OrgMembership` | `Organization` | N:1 | |
| `hasSkill` | `Talent` | `TalentSkill` | 1:N | unique per canonical name |
| `extractedFrom` | `TalentSkill` | `TalentDocument` | N:1 | optional |

### 4.3 Actions & Transactions

| Property | Domain | Range | Cardinality |
|----------|--------|-------|-------------|
| `hasApplication` | `Talent` | `Application` | 1:N |
| `appliedTo` | `Application` | `Opportunity` | N:1 |
| `hasBooking` | `Talent` | `Booking` | 1:N |
| `bookedSpace` | `Booking` | `Space` | N:1 |
| `hasSubscription` | `Talent` | `Subscription` | 1:N |
| `subscribedTo` | `Subscription` | `Community` | N:1 |
### 4.4 Engagement

| Property | Domain | Range | Cardinality |
|----------|--------|-------|-------------|
| `hasReaction` | `Talent` | `Reaction` | 1:N |
| `reactedTo` | `Reaction` | `Publication` | N:1 |
| `hasBookmark` | `Talent` | `Bookmark` | 1:N |
| `bookmarked` | `Bookmark` | `Resource` | N:1 |
| `hasVote` | `Talent` | `PollVote` | 1:N |
| `votedOn` | `PollVote` | `PollOption` | N:1 |

### 4.5 Notification & Communication

| Property | Domain | Range | Cardinality |
|----------|--------|-------|-------------|
| `notifiedTo` | `Notification` | `Talent` | N:1 |
| `triggeredBy` | `Notification` | `Talent` | N:1 (optional) |
| `hasMessage` | `Application` | `ApplicationMessage` | 1:N |
| `hasMessage` | `Booking` | `BookingMessage` | 1:N |

---

## 5. Action Ontology (Intent = Action + Subject + Object)

### 5.1 Intent Grammar

```
Intent := <Action>_<Subject>_<Object> [filter?, params?]
Subject := TALENT | ORGANIZATION | SYSTEM
Action  := CREATE | READ | UPDATE | DELETE | EXECUTE
Object  := see §5.3
```

### 5.2 Action Definitions

| Action | Semantics | Confirmation Required |
|--------|-----------|----------------------|
| `CREATE` | Instantiate a new resource | No (except paid actions) |
| `READ` | Retrieve / list / search resources | No |
| `UPDATE` | Modify properties of an existing resource | No |
| `DELETE` | Remove or archive a resource | **Yes, always** |
| `EXECUTE` | Trigger a stateful side-effect (apply, book, vote…) | Depends on context |

### 5.3 Complete Intent Matrix

#### TALENT as Subject

| Intent | Object | Constraints | Status |
|--------|--------|-------------|--------|
| **Profile** | | | |
| `read_talent_profile` | `Talent` | own or public others | ALLOWED |
| `update_talent_profile` | `Talent` | own only | ALLOWED |
| `create_talent_profile` | `Talent` | — | DENIED (system-created on signup) |
| `delete_talent_profile` | `Talent` | — | DENIED (account deactivation only) |
| **TalentDocument** | | | |
| `create_talent_document` | `TalentDocument` | own, max 20 | ALLOWED |
| `read_talent_document` | `TalentDocument` | own (all), others (public only) | ALLOWED |
| `update_talent_document` | `TalentDocument` | own only (tags, visibility) | ALLOWED |
| `delete_talent_document` | `TalentDocument` | own only, **confirm** | ALLOWED |
| **TalentSkill** | | | |
| `create_talent_skill` | `TalentSkill` | own, unique canonical_name | ALLOWED |
| `read_talent_skill` | `TalentSkill` | own (all), others (public) | ALLOWED |
| `update_talent_skill` | `TalentSkill` | own only (proficiency, type) | ALLOWED |
| `delete_talent_skill` | `TalentSkill` | own only, **confirm** | ALLOWED |
| **Organization** | | | |
| `create_talent_organization` | `Organization` | becomes OWNER | ALLOWED |
| `read_talent_organization` | `Organization` | any public org | ALLOWED |
| `update_talent_organization` | `Organization` | — | DENIED (via org role) |
| `delete_talent_organization` | `Organization` | — | DENIED |
| **Community** | | | |
| `read_talent_community` | `Community` | public or member-of | ALLOWED |
| `create_talent_community` | `Community` | — | DENIED (org only) |
| `update_talent_community` | `Community` | — | DENIED (org admin only) |
| `delete_talent_community` | `Community` | — | DENIED |
| **Membership** | | | |
| `create_talent_membership` | `Membership` | join public / request membership | ALLOWED |
| `read_talent_membership` | `Membership` | own memberships | ALLOWED |
| `update_talent_membership` | `Membership` | — | DENIED (admin only) |
| `delete_talent_membership` | `Membership` | leave, **confirm** | ALLOWED |
| **Publication** | | | |
| `create_talent_publication` | `Publication(POST)` | must be community member | ALLOWED |
| `create_talent_publication` | `Publication(EVENT)` | — | DENIED (admin only) |
| `create_talent_publication` | `Publication(POLL)` | — | DENIED (admin only) |
| `read_talent_publication` | `Publication` | community member | ALLOWED |
| `update_talent_publication` | `Publication` | own only | ALLOWED |
| `delete_talent_publication` | `Publication` | own only, **confirm** | ALLOWED |
| **Comment** | | | |
| `create_talent_comment` | `Comment` | community member | ALLOWED |
| `read_talent_comment` | `Comment` | community member | ALLOWED |
| `update_talent_comment` | `Comment` | own only | ALLOWED |
| `delete_talent_comment` | `Comment` | own only, **confirm** | ALLOWED |
| **Reaction** | | | |
| `create_talent_reaction` | `Reaction` | community member, 1 per pub | ALLOWED |
| `delete_talent_reaction` | `Reaction` | own only | ALLOWED |
| **Bookmark** | | | |
| `create_talent_bookmark` | `Bookmark` | any accessible resource | ALLOWED |
| `read_talent_bookmark` | `Bookmark` | own only | ALLOWED |
| `delete_talent_bookmark` | `Bookmark` | own only | ALLOWED |
| **PollVote** | | | |
| `execute_talent_vote` | `PollVote` | community member, 1 per poll | ALLOWED |
| **Opportunity** | | | |
| `read_talent_opportunity` | `Opportunity` | public or via org | ALLOWED |
| `create_talent_opportunity` | `Opportunity` | — | DENIED (org only) |
| `update_talent_opportunity` | `Opportunity` | — | DENIED (org only) |
| `delete_talent_opportunity` | `Opportunity` | — | DENIED |
| **Application** | | | |
| `create_talent_application` | `Application` | 1 per opportunity | ALLOWED |
| `read_talent_application` | `Application` | own only | ALLOWED |
| `update_talent_application` | `Application` | — | DENIED (org reviews) |
| `delete_talent_application` | `Application` | withdraw, **confirm** | ALLOWED |
| **Space** | | | |
| `read_talent_space` | `Space` | public and active | ALLOWED |
| `create_talent_space` | `Space` | — | DENIED (org only) |
| `update_talent_space` | `Space` | — | DENIED (org only) |
| `delete_talent_space` | `Space` | — | DENIED |
| **Booking** | | | |
| `create_talent_booking` | `Booking` | bookable space, no conflict | ALLOWED |
| `read_talent_booking` | `Booking` | own only | ALLOWED |
| `update_talent_booking` | `Booking` | cancel own (within policy), **confirm** | ALLOWED |
| `delete_talent_booking` | `Booking` | — | DENIED (cancel instead) |
| **Subscription** | | | |
| `create_talent_subscription` | `Subscription` | for paid community | ALLOWED |
| `read_talent_subscription` | `Subscription` | own only | ALLOWED |
| `update_talent_subscription` | `Subscription` | cancel/resume | ALLOWED |
| `delete_talent_subscription` | `Subscription` | — | DENIED (cancel instead) |
| **Notification** | | | |
| `read_talent_notification` | `Notification` | own only | ALLOWED |
| `update_talent_notification` | `Notification` | mark as read | ALLOWED |
| `delete_talent_notification` | `Notification` | own only | ALLOWED |
| `create_talent_notification` | `Notification` | — | DENIED (system only) |
| **Copilot** | | | |
| `create_talent_copilot_session` | `CopilotSession` | own | ALLOWED |
| `read_talent_copilot_session` | `CopilotSession` | own only | ALLOWED |
| `update_talent_copilot_session` | `CopilotSession` | own (title) | ALLOWED |
| `delete_talent_copilot_session` | `CopilotSession` | own, **confirm** | ALLOWED |
| `execute_talent_copilot_message` | `CopilotMessage` | in own session | ALLOWED |
| **Invitations** | | | |
| `read_talent_invitation` | `OrgInvitation`/`OfferInvitation` | received by self | ALLOWED |
| `execute_talent_invitation` | `OrgInvitation`/`OfferInvitation` | accept/decline | ALLOWED |
| `create_talent_invitation` | `OrgInvitation`/`OfferInvitation` | — | DENIED (org only) |

---

#### ORGANIZATION as Subject

> **Note:** Organizations act through their members. The acting talent's `OrgRole` determines permissions.

| Intent | Object | Required Role | Constraints | Status |
|--------|--------|---------------|-------------|--------|
| **Organization** | | | | |
| `read_org_organization` | `Organization` | any member | own org | ALLOWED |
| `update_org_organization` | `Organization` | OWNER, ADMIN | own org | ALLOWED |
| `delete_org_organization` | `Organization` | — | — | DENIED |
| **OrgMembership** | | | | |
| `create_org_membership` | `OrgMembership` | OWNER, ADMIN | via invitation | ALLOWED |
| `read_org_membership` | `OrgMembership` | any member | own org | ALLOWED |
| `update_org_membership` | `OrgMembership` | OWNER, ADMIN | change role/status | ALLOWED |
| `delete_org_membership` | `OrgMembership` | OWNER, ADMIN | remove member, **confirm** | ALLOWED |
| **Invitations** | | | | |
| `create_org_invitation` | `OrgInvitation` | OWNER, ADMIN | for Organization, includes ADMIN role | ALLOWED |
| `create_offer_invitation` | `OfferInvitation` | OWNER, ADMIN, MANAGER | target: Community, Opportunity, or Space | ALLOWED |
| `read_org_invitation` | `OrgInvitation`/`OfferInvitation` | OWNER, ADMIN | own org's invitations | ALLOWED |
| `update_org_invitation` | `OrgInvitation`/`OfferInvitation` | — | — | DENIED (auto-expires) |
| `delete_org_invitation` | `OrgInvitation`/`OfferInvitation` | OWNER, ADMIN | cancel, **confirm** | ALLOWED |
| **Community** | | | | |
| `create_org_community` | `Community` | OWNER, ADMIN | linked to org | ALLOWED |
| `read_org_community` | `Community` | any member | own org | ALLOWED |
| `update_org_community` | `Community` | OWNER, ADMIN | settings, pricing | ALLOWED |
| `delete_org_community` | `Community` | OWNER | archive, **confirm** | ALLOWED |
| **Community Members** | | | | |
| `read_org_membership` | `Membership` | ADMIN | community members | ALLOWED |
| `update_org_membership` | `Membership` | ADMIN | approve/reject/suspend | ALLOWED |
| `delete_org_membership` | `Membership` | ADMIN | remove member, **confirm** | ALLOWED |
| **Publication (Community)** | | | | |
| `create_org_publication` | `Publication(POST)` | ADMIN | in own communities | ALLOWED |
| `create_org_publication` | `Publication(EVENT)` | ADMIN | in own communities | ALLOWED |
| `create_org_publication` | `Publication(POLL)` | ADMIN | in own communities | ALLOWED |
| `update_org_publication` | `Publication` | ADMIN | moderate, pin/unpin | ALLOWED |
| `delete_org_publication` | `Publication` | ADMIN | any in own communities, **confirm** | ALLOWED |
| **Comment (Moderation)** | | | | |
| `update_org_comment` | `Comment` | ADMIN | moderate | ALLOWED |
| `delete_org_comment` | `Comment` | ADMIN | in own communities, **confirm** | ALLOWED |
| **Opportunity** | | | | |
| `create_org_opportunity` | `Opportunity` | OWNER, ADMIN, MANAGER | linked to org | ALLOWED |
| `read_org_opportunity` | `Opportunity` | any member | own org | ALLOWED |
| `update_org_opportunity` | `Opportunity` | OWNER, ADMIN, MANAGER | own org's opps | ALLOWED |
| `delete_org_opportunity` | `Opportunity` | OWNER, ADMIN | archive, **confirm** | ALLOWED |
| **Application (Review)** | | | | |
| `read_org_application` | `Application` | OWNER, ADMIN, MANAGER | own org's opps | ALLOWED |
| `update_org_application` | `Application` | OWNER, ADMIN, MANAGER | status, notes, rating | ALLOWED |
| `create_org_application` | `Application` | — | — | DENIED (talent only) |
| `delete_org_application` | `Application` | — | — | DENIED |
| **Application Messages** | | | | |
| `create_org_application_message` | `ApplicationMessage` | OWNER, ADMIN, MANAGER | in own org's apps | ALLOWED |
| `read_org_application_message` | `ApplicationMessage` | OWNER, ADMIN, MANAGER | in own org's apps | ALLOWED |
| **Space** | | | | |
| `create_org_space` | `Space` | OWNER, ADMIN, MANAGER | linked to org | ALLOWED |
| `read_org_space` | `Space` | any member | own org | ALLOWED |
| `update_org_space` | `Space` | OWNER, ADMIN, MANAGER | settings, availability | ALLOWED |
| `delete_org_space` | `Space` | OWNER, ADMIN | deactivate, **confirm** | ALLOWED |
| **Space Availability** | | | | |
| `create_org_availability` | `SpaceAvailability` | OWNER, ADMIN, MANAGER | for own spaces | ALLOWED |
| `read_org_availability` | `SpaceAvailability` | any | public | ALLOWED |
| `create_org_unavailability` | `SpaceUnavailability` | OWNER, ADMIN, MANAGER | blackout dates | ALLOWED |
| **Booking (Management)** | | | | |
| `read_org_booking` | `Booking` | OWNER, ADMIN, MANAGER | own org's spaces | ALLOWED |
| `update_org_booking` | `Booking` | OWNER, ADMIN, MANAGER | confirm/cancel | ALLOWED |
| `create_org_booking` | `Booking` | — | — | DENIED (talent only) |
| `delete_org_booking` | `Booking` | — | — | DENIED (cancel instead) |
| **Booking Messages** | | | | |
| `create_org_booking_message` | `BookingMessage` | OWNER, ADMIN, MANAGER | in own org bookings | ALLOWED |
| `read_org_booking_message` | `BookingMessage` | OWNER, ADMIN, MANAGER | in own org bookings | ALLOWED |
| **Subscription (View)** | | | | |
| `read_org_subscription` | `Subscription` | ADMIN | own community subs | ALLOWED |
| `create_org_subscription` | `Subscription` | — | — | DENIED (talent only) |

---

#### SYSTEM as Subject

| Intent | Object | Trigger | Status |
|--------|--------|---------|--------|
| `create_system_notification` | `Notification` | on events (mention, reply, status change…) | ALLOWED |
| `update_system_subscription` | `Subscription` | on expiry | ALLOWED |
| `execute_system_skill_extraction` | `TalentSkill` | on document upload (PROCESSED) | ALLOWED |
| `execute_system_embedding` | `embedding` | on entity create/update | ALLOWED |
| `update_system_booking` | `Booking` | auto-complete past bookings | ALLOWED |
| `update_system_invitation` | `Invitation` | auto-expire after 7 days | ALLOWED |
| `update_system_otp` | `OTP` | auto-expire, max attempts | ALLOWED |
| `execute_system_skill_inference` | `TalentSkill` | Study Mode (Socratic assessment) | ALLOWED |

---

## 6. Restrictions & Business Rules

### 6.1 Study Mode & Skill Inference Rules

| Rule | Description |
|------|-------------|
| **L1** | **Inference Authority**: `INFERRED` origin > `EXTRACTED` > `DECLARED`. Agent updates override user claims if evidence contradicts. |
| **L2** | **Progression Constraints**: BEGINNER → INTERMEDIATE (min 5h active study) → EXPERT (min 20h + verification) → MASTER (peer review/cert). |
| **L3** | **Degradation Logic**: If User claims EXPERT but fails basic Socratic questions, Agent sets level to INTERMEDIATE or BEGINNER with `confidence_score`. |
| **L4** | **Socratic Method**: Agent must ask guiding questions to verify depth before "teaching". No direct answers for "Challenging" difficulty. |
| **L5** | **Hyper-parameters**: `learningPreferences` dictate content format (e.g., `VISUAL` = generated diagrams, `AUDITORY` = text-to-speech prompts). |

### 6.2 Universal Restrictions

| Rule | Description |
|------|-------------|
| **R1** | All DELETE actions require user confirmation |
| **R2** | Soft delete via `deleted_at` — data is never physically removed |
| **R3** | All entities support `created_at`, `updated_at` timestamps |
| **R4** | Vector embeddings (1536-dim) are auto-computed on create/update for Talent, Organization, Community, Opportunity |
| **R5** | All list endpoints use limit/offset pagination |
| **R6** | **Universal Matching Logic prioritizes**: City > Region > Country > Continent > Global, then relocation flexibility/remote, then sectors, then profile objectives. |
| **R7** | Entities where `isVisible` is false are excluded from public listings and Copilot global search (unless specific access). |

### 6.2 Talent Restrictions

| Rule | Description |
|------|-------------|
| **T1** | A talent cannot create their own profile (created on signup) |
| **T2** | A talent cannot delete their profile (deactivation only via User.is_active) |
| **T3** | Max 20 documents per talent (enforced by DB trigger) |
| **T4** | 1 application per talent per opportunity (unique constraint) |
| **T5** | 1 reaction per talent per publication (PK constraint) |
| **T6** | 1 vote per talent per poll (PK constraint) |
| **T7** | A talent can only create POST-type publications (not EVENT/POLL) |
| **T8** | A talent must be a community member to interact with community content |
| **T9** | A talent cannot book a space that has a conflicting PENDING/CONFIRMED booking |

| **T11** | OTP max 3 attempts before code invalidation |

### 6.3 Organization Restrictions

| Rule | Description |
|------|-------------|
| **O1** | An organization cannot be deleted |
| **O2** | Only OWNER/ADMIN can manage org members |
| **O3** | Only OWNER/ADMIN/MANAGER can create opportunities and spaces |
| **O4** | Only ADMIN role in community can create EVENT and POLL publications |
| **O5** | Only ADMIN can moderate content (flag, approve, reject) |
| **O6** | OrgInvitations and OfferInvitations (Community/Opportunity) expire after 7 days |
| **O6.1** | OfferInvitations for Spaces expire after 30 days |
| **O7** | An organization must have at least one OWNER |
| **O8** | Community must belong to exactly one organization |

### 6.4 Subscription Rules

| Rule | Description |
|------|-------------|
| **P2** | Trial periods: 0, 1, 3, 7, or 30 days only |
| **P3** | Subscriptions auto-renew monthly unless cancelled |
| **P5** | Cancellation takes effect at end of current billing period |

### 6.5 Community Rules

| Rule | Description |
|------|-------------|
| **C1** | PUBLIC access → auto-join, MEMBERSHIP access → requires approval |
| **C2** | Paid communities require active subscription for membership |
| **C3** | Max 5 attachments per publication, max 20MB each |
| **C4** | Org members automatically get ADMIN role in org's communities |
| **C5** | Pinning is ADMIN-only |
| **C6** | Scheduled publications use `published_at` (null = immediate) |

### 6.6 Space Booking Rules

| Rule | Description |
|------|-------------|
| **S1** | No double-booking (unique constraint on space + time range where status IN PENDING, CONFIRMED) |
| **S2** | Booking duration must respect `min_booking_hours` and `max_booking_hours` |
| **S3** | Advance booking limited by `advance_booking_days` |
| **S4** | Space invitations expire after 30 days |
| **S5** | Only org admin/manager can confirm bookings |
| **S6** | Booking lifecycle: PENDING → CONFIRMED → COMPLETED (or CANCELLED/NO_SHOW) |

---

## 7. Capability Matrix (Summary View)

### 7.1 Talent Capabilities

```
CAN CREATE:   TalentDocument, TalentSkill, Organization, Membership (join),
              Application, Booking,
              Subscription, Publication(POST), Comment, Reaction,
              Bookmark, PollVote, CopilotSession

CAN READ:     Own profile, Public profiles, Public organizations,
              Public communities, Public opportunities, Public spaces,
              Own talent_documents/talent_skills/applications/bookings/subscriptions/
              notifications/copilot sessions,
              Community feed (if member)

CAN UPDATE:   Own profile, Own talent_documents (tags/visibility),
              Own talent_skills (proficiency), Own publications,
              Own comments, Own subscription (cancel/resume),
              Own notifications (mark read), Own copilot session (title)

CAN DELETE:   Own talent_documents, Own talent_skills, Own membership (leave),
              Own publications, Own comments, Own reactions,
              Own bookmarks,
              Own notifications, Own copilot sessions
              ⚠️ All deletes require confirmation

CANNOT:       Create/delete own profile,
              Create community/opportunity/space,
              Create EVENT or POLL publications,
              Moderate content,
              Manage org/community members,
              Review applications,
              Confirm/manage bookings (org side)
```

### 7.2 Organization Capabilities (by Role)

```
OWNER:        Full control of organization
              + All ADMIN capabilities

ADMIN:        Create/update community, opportunity, space
              Manage org members (invite, update role, remove)
              Moderate community content (flag, approve, reject, pin)
              Manage community members (approve, reject, suspend, remove)
              Create EVENT and POLL publications
              Review applications (status, notes, rating)
              Manage space bookings (confirm, cancel)
              Manage space availability/unavailability
              Send application & booking messages
              View subscription data

MANAGER:      Create/update opportunity, space
              Review applications
              Manage space bookings
              Send application & booking messages

MEMBER:       View org profile and opportunities
              View own org's spaces
              No management capabilities
```

### 7.3 System Capabilities

```
CAN CREATE:   Notifications
CAN UPDATE:   Subscriptions, Bookings (auto-complete),
              Invitations (auto-expire), OTP (invalidate)
CAN EXECUTE:  Skill extraction, Embedding computation
CANNOT:       Create/update/delete core entities (Talent, Organization)
```


---

## 8. Copilot Agent Intent Mapping

The Copilot (AI assistant) uses `sql_query` tool intents that map to this ontology:

| Copilot Intent Pattern | Maps To | Agent Permission |
|------------------------|---------|------------------|
| `read_talent_profile` | `read_talent_profile` | READ only |
| `read_talent_skills` | `read_talent_skill` | READ only |
| `read_talent_documents` | `read_talent_document` | READ only (own) |
| `read_org_*` | `read_org_organization` | READ only |
| `read_community_*` | `read_talent_community` | READ only |
| `read_opportunity_*` | `read_talent_opportunity` | READ only |
| `read_talent_applications` | `read_talent_application` | READ only (own) |
| `read_talent_bookings` | `read_talent_booking` | READ only (own) |
| `read_talent_notifications` | `read_talent_notification` | READ only (own) |
| `update_talent_notification` | `update_talent_notification` | Mark as read only |
| `delete_talent_notification` | `delete_talent_notification` | Own only, **confirm** |

**Copilot Restrictions:**
- Cannot CREATE profiles, organizations, or any resource
- Cannot UPDATE profiles or resources (except notifications)
- Can only READ and surface information
- DELETE limited to notifications (with confirmation)
- All write operations must go through the actual API routes
