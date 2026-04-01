# Google Reviews Automation System — PRD

## Project Overview

**Owner:** Anthony @ QuickLaunchWeb
**Status:** Pre-build (schema + MVP implementation)
**Created:** 2026-03-24
**Stack:** Next.js (Vercel) + Supabase + Google Sheets API + Resend (email)

### What It Is

A multi-tenant, automated Google Reviews funnel for QuickLaunchWeb clients (small/local businesses). The system plugs into whatever tool the client already uses (Square, QuickBooks, Google Calendar, etc.) so that review requests go out automatically after a job/service is completed — zero manual work for the client after initial setup.

### Core Value Proposition

- **For QuickLaunchWeb:** Productized, recurring-revenue service offering
- **For Clients:** Automated review generation with zero learning curve. They don't need to adopt new tools or remember to ask for reviews

---

## User Flow

```
Client completes a job/service
        |
        v
Their existing tool (Square, Calendar, etc.)
triggers a webhook via Zapier/Make/direct API
        |
        v
POST /api/webhook/{client_slug}
  -> Contact saved to DB
  -> Review request email queued (with configurable delay)
        |
        v
Cron job picks up queued emails, sends via Resend
  -> Personalized email with link to /review/{client_slug}?c={contact_id}
        |
        v
Customer lands on sentiment page (branded per client)
  -> "How was your experience?"
  -> 4-5 stars: redirect to client's Google Review URL
  -> 1-3 stars: private feedback form -> saved to DB
        |
        v
Google Sheet (shared with client) auto-updates with:
  customer name, email, date, review status, feedback
```

---

## Architecture

### Hosting

Everything on **Vercel** (single Next.js app, single repo):
- API routes (webhook, email sender) = serverless functions
- Sentiment landing page = Next.js page
- Admin route = Next.js page with .env auth
- Cron jobs = Vercel Cron

### Database

**Supabase** (Postgres + RLS)
- Project: `GoogleReviewsAutomation`
- Project ID: `ocmpzezhdelmiivgazte`
- URL: `https://ocmpzezhdelmiivgazte.supabase.co`
- Region: `us-east-1`

### External Services

| Service | Purpose | Status |
|---------|---------|--------|
| Supabase | Database, auth (future), RLS | Active, empty |
| Resend | Transactional email | TBD - needs API key |
| Google Sheets API | Per-client sheet sync | TBD - needs service account |
| Vercel | Hosting | TBD - needs project setup |
| Twilio | SMS (future phase) | Not started |

---

## Database Schema

### `clients`

The business/client that QuickLaunchWeb serves.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | Auto-generated |
| name | text NOT NULL | Business name |
| slug | text UNIQUE NOT NULL | URL-safe identifier (e.g., "jn-ornamental") |
| google_review_url | text | Their Google Business review link |
| logo_url | text | Logo for branding the review page |
| brand_color | text | Hex color for review page |
| email_from_name | text | "From" name on review emails |
| email_subject | text DEFAULT 'How was your experience?' | Subject line for review emails |
| email_body_template | text | Custom email body (supports {{name}}, {{business_name}}, {{review_url}} placeholders) |
| email_delay_minutes | int DEFAULT 120 | Delay before sending review request |
| api_key | text UNIQUE NOT NULL | API key for webhook auth (generated on client creation) |
| sheet_id | text | Google Sheet ID for this client |
| custom_domain | text | Custom domain (e.g., "reviews.jnornamental.com") for white-label |
| active | boolean DEFAULT true | Is this client active? |
| created_at | timestamptz DEFAULT now() | |
| updated_at | timestamptz DEFAULT now() | |

### `contacts`

Customers of the client who will receive review requests.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | Auto-generated |
| client_id | uuid FK -> clients.id | Which client this contact belongs to |
| name | text | Customer name |
| email | text NOT NULL | Customer email |
| phone | text | Phone number (for future SMS) |
| source | text | How they were added (zapier, manual, square, etc.) |
| created_at | timestamptz DEFAULT now() | |

**Unique constraint:** (client_id, email) — prevent duplicate contacts per client.

### `messages`

Log of all outbound messages (email now, SMS later).

| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | Auto-generated |
| contact_id | uuid FK -> contacts.id | Who this was sent to |
| client_id | uuid FK -> clients.id | Denormalized for easier queries |
| channel | text DEFAULT 'email' | 'email' or 'sms' (future) |
| status | text DEFAULT 'queued' | queued, sent, delivered, opened, clicked, failed |
| scheduled_for | timestamptz NOT NULL | When to send (created_at + delay) |
| sent_at | timestamptz | When actually sent |
| created_at | timestamptz DEFAULT now() | |

### `feedback`

Private feedback from unhappy customers (1-3 stars).

| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | Auto-generated |
| contact_id | uuid FK -> contacts.id | |
| client_id | uuid FK -> clients.id | Denormalized |
| rating | int | 1-5 star rating |
| message | text | Their feedback text |
| created_at | timestamptz DEFAULT now() | |

### `review_clicks`

Tracks when happy customers click through to Google.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | Auto-generated |
| contact_id | uuid FK -> contacts.id | |
| client_id | uuid FK -> clients.id | Denormalized |
| clicked_at | timestamptz DEFAULT now() | |

---

## API Routes

### `POST /api/webhook/[slug]`

Universal intake endpoint. Accepts contacts from any source.

**Request body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+15551234567",
  "source": "square"
}
```

**Behavior:**
1. Look up client by slug
2. Upsert contact (skip if already exists for this client)
3. Create a `messages` row with `status: 'queued'` and `scheduled_for: now() + client.email_delay_minutes`
4. Return 200

**Auth:** API key checked via `Authorization: Bearer {api_key}` header. Key stored hashed in `clients.api_key`.

### `GET /api/cron/send-emails`

Vercel cron (every 5 min). Picks up queued messages past their `scheduled_for` time, sends via Resend, updates status.

**Protected by:** Vercel cron secret (`CRON_SECRET` env var).

### `GET /review/[slug]`

Sentiment landing page. Dynamic route.

**Query params:** `t={signed_token}` (HMAC-signed token encoding contact_id + client_id — prevents enumeration/spoofing)

**Renders:**
- Client logo + name
- "How was your experience?" prompt
- Star rating (1-5)
- 4-5 stars -> redirect to `client.google_review_url`
- 1-3 stars -> show feedback form

### `POST /api/feedback`

Accepts private feedback submission from the review page.

```json
{
  "token": "signed_token",
  "rating": 2,
  "message": "The service was slow..."
}
```

Validates token, extracts contact_id/client_id, confirms a message was sent to this contact.

### `POST /api/review-click`

Logs when a customer clicks through to Google Reviews.

```json
{
  "token": "signed_token"
}
```

Same token validation as feedback.

### `GET /admin`

Admin dashboard (protected by .env credentials, same pattern as /demo).

**Shows:**
- All clients with stats (total contacts, emails sent, reviews, feedback)
- Per-client detail view
- Add/edit client form
- View feedback

### `POST /api/sync-sheet/[slug]`

Syncs contact + review data to the client's Google Sheet. Called after email sent, review click, or feedback received.

---

## Google Sheets Sync

Each client gets a shared Google Sheet with columns:

| Customer Name | Email | Date Added | Review Requested | Status | Rating | Feedback |
|--------------|-------|------------|-----------------|--------|--------|----------|
| John Doe | john@ex.com | 2026-03-24 | 2026-03-24 | Reviewed | 5 | - |
| Jane Smith | jane@ex.com | 2026-03-24 | 2026-03-24 | Feedback | 2 | "Service was slow" |

**Sync is one-way:** System writes to Sheet. Client only reads.

---

## Build Phases

### Phase 1 — Foundation (Current Session)
- [x] Supabase project created
- [x] Database schema (all tables + RLS + indexes)
- [x] Webhook endpoint (`/api/webhook/[slug]`)
- [x] Sentiment landing page (`/review/[slug]`)
- [x] Email sending (Resend + Vercel cron)
- [x] Feedback + review-click API routes
- [x] Signed token system (HMAC)
- [x] Input validation + sanitization
- [x] Custom domain middleware
- [x] Next.js project builds clean

### Phase 2 — Client Layer (Next Session)
- [ ] Google Sheets sync per client
- [ ] Admin dashboard (`/admin`)
- [ ] Client onboarding flow

### Phase 3 — Enhancements (Future)
- [ ] SMS via Twilio (channel: 'sms' in messages table — schema already supports it)
- [ ] Drip campaigns (multi-step sequences)
- [ ] Client self-serve login (Supabase Auth — RLS already scoped per client)
- [ ] Email open/click tracking (webhook from Resend)
- [ ] Analytics dashboard
- [ ] Zapier/Make integration templates per common tool

---

## Onboarding a New Client

1. Add client to `clients` table (name, slug, google_review_url, branding)
2. Create a Google Sheet, share with client, save `sheet_id`
3. Ask: "What tool do you use to manage jobs/invoices/appointments?"
4. Set up the trigger:
   - **Square/Stripe/QuickBooks:** Zapier webhook -> `/api/webhook/{slug}`
   - **Google Calendar:** Zapier "event ended" -> webhook
   - **Email/Invoice:** BCC rule forwarding to a parsing endpoint (future)
   - **Manual:** Direct API call or simple form
5. Test with a sample contact
6. Done — reviews flow automatically

---

## Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://ocmpzezhdelmiivgazte.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<from Supabase dashboard>

# Email
RESEND_API_KEY=<from resend.com>

# Google Sheets
GOOGLE_SERVICE_ACCOUNT_EMAIL=<service account email>
GOOGLE_PRIVATE_KEY=<service account private key>

# Admin Auth
ADMIN_USERNAME=<your admin username>
ADMIN_PASSWORD=<your admin password>

# Vercel Cron
CRON_SECRET=<random secret for cron auth>

# Token Signing
REVIEW_TOKEN_SECRET=<random secret for HMAC signing contact tokens>
```

---

## File Structure (Planned)

```
google-reviews-automation/
├── PRD.md                          # This file
├── CLAUDE.md                       # Instructions for AI agents
├── package.json
├── next.config.js
├── vercel.json                     # Cron config
├── .env.local                      # Local env vars
├── supabase/
│   └── migrations/                 # SQL migration files
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── review/
│   │   │   └── [slug]/
│   │   │       └── page.tsx        # Sentiment landing page
│   │   ├── admin/
│   │   │   └── page.tsx            # Admin dashboard
│   │   └── api/
│   │       ├── webhook/
│   │       │   └── [slug]/
│   │       │       └── route.ts    # Universal webhook intake
│   │       ├── feedback/
│   │       │   └── route.ts        # Feedback submission
│   │       ├── review-click/
│   │       │   └── route.ts        # Track Google clicks
│   │       ├── cron/
│   │       │   └── send-emails/
│   │       │       └── route.ts    # Email cron job
│   │       └── sync-sheet/
│   │           └── [slug]/
│   │               └── route.ts    # Google Sheets sync
│   └── lib/
│       ├── supabase.ts             # Supabase client
│       ├── resend.ts               # Email client
│       └── sheets.ts               # Google Sheets client
└── public/
    └── ...                         # Static assets
```

---

## Design Decisions

1. **Single webhook, not per-client endpoints:** One route (`/api/webhook/[slug]`) handles all clients. Slug differentiates. Simpler to maintain.

2. **Denormalized client_id on messages/feedback:** Avoids joins for common queries (stats per client). Small data duplication is worth the query simplicity.

3. **Configurable delay, not immediate send:** Clients may want emails sent 2 hours or 1 day after service. Default is 2 hours. Configurable per client.

4. **Google Sheets over client dashboard (MVP):** Clients already know Sheets. Zero adoption friction. Dashboard comes later when/if needed.

5. **Email-first, SMS-ready:** Schema has `channel` field on messages. Adding Twilio later is just a new code path, no schema changes.

6. **No client auth for MVP:** Admin manages everything. Client just gets a shared Sheet. Login/portal is Phase 3.

7. **.env admin auth:** Same pattern as existing /demo route. Simple, works, no overhead.

8. **Signed tokens for review links:** Contact IDs are never exposed in URLs. Instead, a HMAC-signed token encodes `contact_id:client_id` and is verified server-side. Prevents enumeration, spoofing, and fake feedback.

9. **Input validation + rate limiting:** Webhook validates email format and sanitizes all inputs. Vercel's edge rate limiting protects public endpoints. Admin auth uses timing-safe string comparison.

10. **Sheets sync is inline:** After sending an email, recording a review click, or saving feedback, the relevant route calls the sheets sync function directly. No separate trigger needed.

11. **Custom domains via middleware:** MVP uses `reviews.quicklaunchweb.com/{slug}`. Later, clients can point their own domain (e.g., `reviews.jnornamental.com`) via CNAME to Vercel. Next.js middleware reads the hostname, looks up the client by `custom_domain`, and serves their page. One app, infinite branded domains.

## Domain Strategy

**MVP:** `reviews.quicklaunchweb.com` — single subdomain, slug-based routing.
- DNS: CNAME `reviews` -> `cname.vercel-dns.com`
- URLs: `reviews.quicklaunchweb.com/review/{slug}`

**Scale (per-client custom domains):**
- Client adds CNAME: `reviews.theirdomain.com` -> `cname.vercel-dns.com`
- Domain added in Vercel (dashboard or API)
- Next.js middleware maps hostname -> client slug via `custom_domain` column
- Customer sees fully branded URL: `reviews.theirdomain.com`
