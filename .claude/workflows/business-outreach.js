export const meta = {
  name: 'business-outreach',
  description: 'Search for businesses to approach (SerpApi Google Maps), find new/booked ones, research their campaigns, draft tailored emails (never sent), check replies, and keep the Notion outreach tracker up to date',
  whenToUse: 'Run daily or weekly to work the business pipeline: who is new, what to say to them, who replied, who still needs a nudge',
  phases: [
    { title: 'Prospect', detail: 'SerpApi Google Maps search: name, address, phone, website' },
    { title: 'Discover', detail: 'load Notion tracker, find new bookings/applications/prospects' },
    { title: 'Research', detail: 'what campaigns each new business runs' },
    { title: 'Draft', detail: 'tailored Gmail draft per business (drafts only)' },
    { title: 'Replies', detail: 'check Gmail for replies on approached businesses' },
    { title: 'Track', detail: 'create/update one Notion row per business' },
  ],
}

// args (all optional):
//   mode: 'full' | 'outreach' | 'replies'      (default 'full')
//   bookingUrl: public link to the /book page  (else drafts carry a [BOOKING LINK] placeholder)
//   senderName: sign-off name                  (default 'Dan')
//   lookbackDays: how far back to look for new orgs/applications (default 14)
//   followUpAfterDays: days of silence before one follow-up draft (default 5)
//   maxNew: cap on new businesses handled per run (default 15)
//   angle: 'goal' (default) leads with each business's own vision/goals; 'product' leads with what Tangaza does
//   prospects: [{ business, contactName?, email?, phone?, website? }]  cold leads you supply
//   search: { queries?: string[], location?: string, country?: string, perQuery?: number }
//     finds new businesses with SerpApi's Google Maps engine (needs SERPAPI_API_KEY in web/.env.local or the environment).
//     e.g. { queries: ['coffee shop','salon','boutique'], location: 'Nairobi, Kenya', country: 'ke', perQuery: 10 }
const A = args || {}
const mode = A.mode || 'full'
const bookingUrl = A.bookingUrl || null
const senderName = A.senderName || 'Dan'
const lookbackDays = A.lookbackDays || 14
const followUpAfterDays = A.followUpAfterDays || 5
const maxNew = A.maxNew || 15
const angle = A.angle === 'product' ? 'product' : 'goal'
const suppliedProspects = A.prospects || []
const search = A.search || null

// Notion database "Business Outreach Tracker" (private; one row per business).
const TRACKER_DB = 'https://app.notion.com/p/13f5368dc21045c6b89b50fdd89c06b8'
const TRACKER_DS = 'collection://e027940b-5de5-4ac2-b5a0-d5c5898c7bda'
const NOTION = `Notion tools are deferred: load them with ToolSearch ("select:mcp__claude_ai_Notion__notion-fetch,mcp__claude_ai_Notion__notion-query-data-sources,mcp__claude_ai_Notion__notion-create-pages,mcp__claude_ai_Notion__notion-update-page"). The tracker is the data source ${TRACKER_DS} (database ${TRACKER_DB}). Fetch the data source once for the exact property names. Date properties are written as "date:<Name>:start" (ISO date) plus "date:<Name>:is_datetime" = 0.`

const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

if (!bookingUrl) log('No args.bookingUrl given — drafts will contain a [BOOKING LINK] placeholder you must fill in.')

// Rules every drafting/replying agent must follow.
const SAFETY = `HARD RULES:
- NEVER send email. Only create Gmail DRAFTS (create_draft / update_draft). Do not call send_message, reply, or forward.
- Only state facts you can find in the repo (PITCH.md, README.md, web/) or in what the business has published. No invented customers, statistics, testimonials or traction numbers.
- Rewards are honoured by the business itself (trust-based). Never say Tangaza holds, escrows or pays out money, and never promise M-Pesa deposits or withdrawals. M-Pesa is used only to attribute referrals.
- Keep emails short (under 150 words), plain and warm, one clear ask. Sign off as ${senderName}.
- Do not print or store database credentials or tokens anywhere.`

const CANDIDATE = {
  type: 'object',
  properties: {
    business: { type: 'string' },
    source: { type: 'string', enum: ['booking', 'application', 'org', 'prospect'] },
    kind: { type: 'string', enum: ['booked', 'applied', 'cold'] },
    contactName: { type: 'string' },
    email: { type: 'string' },
    phone: { type: 'string' },
    website: { type: 'string' },
    location: { type: 'string' },
    searchQuery: { type: 'string' },
    orgId: { type: 'string' },
    bookingSlot: { type: 'string' },
    notes: { type: 'string' },
  },
  required: ['business', 'source', 'kind'],
}

const TRACKED = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    pageUrl: { type: 'string' },
    business: { type: 'string' },
    email: { type: 'string' },
    status: { type: 'string' },
    draftId: { type: 'string' },
    threadId: { type: 'string' },
    followUps: { type: 'integer' },
    firstDraftedAt: { type: 'string' },
  },
  required: ['id', 'business', 'status'],
}

const DISCOVER = {
  type: 'object',
  properties: {
    tracked: { type: 'array', items: TRACKED },
    fresh: { type: 'array', items: CANDIDATE },
    warnings: { type: 'array', items: { type: 'string' } },
  },
  required: ['tracked', 'fresh', 'warnings'],
}

const RESEARCH = {
  type: 'object',
  properties: {
    campaigns: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          summary: { type: 'string' },
          source: { type: 'string' },
        },
        required: ['name', 'summary', 'source'],
      },
    },
    vision: { type: 'string' },
    goals: { type: 'array', items: { type: 'string' } },
    fit: { type: 'string' },
    hooks: { type: 'array', items: { type: 'string' } },
    confidence: { type: 'string', enum: ['high', 'medium', 'low', 'none'] },
    website: { type: 'string' },
    publicEmail: { type: 'string' },
  },
  required: ['campaigns', 'hooks', 'confidence', 'vision', 'goals', 'fit'],
}

const DRAFT = {
  type: 'object',
  properties: {
    channel: { type: 'string', enum: ['email', 'whatsapp_text', 'none'] },
    subject: { type: 'string' },
    body: { type: 'string' },
    draftCreated: { type: 'boolean' },
    draftId: { type: 'string' },
    threadId: { type: 'string' },
    reason: { type: 'string' },
  },
  required: ['channel', 'body', 'draftCreated'],
}

const REPLY = {
  type: 'object',
  properties: {
    status: {
      type: 'string',
      enum: ['drafted', 'sent', 'no_reply', 'replied_interested', 'replied_question', 'replied_not_now', 'replied_declined', 'booked', 'bounced'],
    },
    summary: { type: 'string' },
    nextAction: { type: 'string' },
    threadId: { type: 'string' },
    sentAt: { type: 'string' },
    replyDraftId: { type: 'string' },
    followUpDraftId: { type: 'string' },
  },
  required: ['status', 'summary', 'nextAction'],
}

// ---------------------------------------------------------------- Prospect
const FOUND = {
  type: 'object',
  properties: {
    found: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          business: { type: 'string' },
          location: { type: 'string' },
          phone: { type: 'string' },
          website: { type: 'string' },
          searchQuery: { type: 'string' },
        },
        required: ['business', 'location', 'searchQuery'],
      },
    },
    warnings: { type: 'array', items: { type: 'string' } },
  },
  required: ['found', 'warnings'],
}

let prospects = suppliedProspects
const prospectWarnings = []
if (search && mode !== 'replies') {
  phase('Prospect')
  const queries = search.queries || ['coffee shop', 'salon', 'boutique', 'barbershop']
  const location = search.location || 'Nairobi, Kenya'
  const country = search.country || 'ke'
  const perQuery = search.perQuery || 10
  const res = await agent(
    `Find local businesses to approach using the SerpApi Google Maps API (serpapi.com).

API key: read SERPAPI_API_KEY from the environment, or from the line SERPAPI_API_KEY=... in /home/gene/Work/tangaza/web/.env.local. NEVER print the key or include it in your output (do not echo the full request URL either). If there is no key, return found [] and a warning saying SERPAPI_API_KEY is missing.

For each of these queries: ${JSON.stringify(queries)}
call: curl -s -G https://serpapi.com/search.json --data-urlencode "engine=google_maps" --data-urlencode "type=search" --data-urlencode "q=<query> in ${location}" --data-urlencode "gl=${country}" --data-urlencode "hl=en" --data-urlencode "api_key=$KEY"
Use the "local_results" array (title, address, phone, website, rating). If it is missing, inspect the response keys (e.g. "place_results") and the "error" field and report what you saw in "warnings". Take at most ${perQuery} per query; each page of results is one billed search, so do not paginate beyond what is needed.

Keep real, currently operating small/local businesses. Drop duplicates (same name or same website), chains with national head offices, and anything marked permanently or temporarily closed. Return for each: business = title, location = address, phone, website, searchQuery = the query that surfaced it. Empty string for missing fields. Do not invent any value. Put API errors or empty results in "warnings".`,
    { label: 'serpapi-prospect', phase: 'Prospect', schema: FOUND },
  )
  if (res) {
    res.warnings.forEach(w => { prospectWarnings.push(w); log(`warning: ${w}`) })
    log(`SerpApi found ${res.found.length} businesses across ${queries.length} queries in ${location}`)
    prospects = [
      ...suppliedProspects,
      ...res.found.map(f => ({ business: f.business, location: f.location, phone: f.phone, website: f.website, searchQuery: f.searchQuery })),
    ]
  } else {
    prospectWarnings.push('SerpApi prospecting agent failed; continuing without it.')
  }
}

// ---------------------------------------------------------------- Discover
phase('Discover')
const disc = await agent(
  `Load the outreach tracker and find businesses we have not approached yet.

1. Read the Notion outreach tracker. ${NOTION}
   Query it in "rows" mode (up to 100 rows; page through if more). Return every row as "tracked": id = the "Business ID" property, pageUrl = the row's page url, business = "Business", email = "Email", status = "Status", draftId = "Draft ID", threadId = "Thread ID", followUps = "Follow-ups", firstDraftedAt = "First drafted". Use empty string / 0 if unset. NOTE: people edit statuses in Notion by hand (e.g. marking a business "booked"); treat what is in Notion as the truth.
2. Find new businesses from these sources, using READ-ONLY SELECT queries only (connection string is in web/.env.local; use node with @neondatabase/serverless or psql; schema is in web/db/*.sql, notably 016_bookings.sql, 005_campaigns_and_tiers.sql org_applications, 001_init.sql orgs):
   - bookings with status = 'requested' (kind "booked"; put the slot ISO time in bookingSlot; contact is a phone/WhatsApp number, email may be null)
   - org_applications that are not 'rejected' (kind "applied")
   - orgs created in the last ${lookbackDays} days that have no booking/application already in the list (kind "applied", source "org", set orgId)
${prospects.length ? `   - these supplied prospects (kind "cold", source "prospect"; keep their location and searchQuery fields): ${JSON.stringify(prospects)}` : ''}
3. Drop any business already in the tracker (match case-insensitively on Business ID, business name, Email or Phone). Merge duplicates across sources into one candidate.
4. If the database is unreachable, put why in "warnings" and continue with whatever you could get. Return empty strings for unknown fields.

If the Notion tracker cannot be read, STOP and put the error in "warnings" with tracked and fresh both empty (never proceed without it, or businesses would be approached twice).

Return { tracked, fresh, warnings }. This step is read-only: modify nothing.`,
  { label: 'discover', phase: 'Discover', schema: DISCOVER },
)
if (!disc) return { error: 'Discovery agent failed; nothing was changed.' }
disc.warnings.forEach(w => log(`warning: ${w}`))
if (!disc.tracked.length && !disc.fresh.length && disc.warnings.length) return { error: 'Nothing to do or tracker unreadable (see warnings); nothing was changed.', warnings: disc.warnings }

let fresh = mode === 'replies' ? [] : disc.fresh
if (fresh.length > maxNew) {
  log(`${fresh.length} new businesses found; handling the first ${maxNew}, deferring ${fresh.length - maxNew} to the next run (raise args.maxNew to include them).`)
  fresh = fresh.slice(0, maxNew)
}
fresh = fresh.map(b => ({ ...b, id: slug(b.business) }))

const REPLY_STATUSES = ['drafted', 'sent', 'no_reply', 'replied_interested', 'replied_question']
const toCheck = mode === 'outreach' ? [] : disc.tracked.filter(t => REPLY_STATUSES.includes(t.status))
log(`${fresh.length} new to approach, ${toCheck.length} approached businesses to check for replies`)

// ------------------------------------------------- Research -> Draft, and Replies, in parallel
const [outreach, replies] = await parallel([
  () => pipeline(
    fresh,
    b => agent(
      `Research what this business is trying to achieve — its vision and goals — and what campaigns it already runs, so an outreach email can be specific to THEM rather than about our product.

Business: ${JSON.stringify(b)}

- If it has an orgId or came from an application/booking, first look in the app database (read-only SELECT, connection string in web/.env.local, schema in web/db/005_campaigns_and_tiers.sql) for its campaigns (title, blurb, active, dates), reward tiers and engagement types. Never print credentials.
- Find the business's vision / mission / stated goals: its About page, mission statement, founder interviews, press, annual or impact reports, recent announcements, what it says it wants to grow (members, community, sales, reach, impact). Return "vision" (one sentence in their own terms) and "goals" (1-4 concrete goals, each traceable to a source you read). If nothing is stated, return vision "" and goals [].
- Then look at what the business publishes: website, Instagram/Facebook/X/TikTok, Google listing. Use WebSearch (standard mode is fine) and WebFetch. Look for promotions, loyalty cards, referral offers, ambassador or influencer programmes, and how they currently get word-of-mouth.
- Report only what you actually found, with a source for each. If you find nothing, return empty lists and confidence "none" — do not guess.
- If no email is given above, look on the business's OWN website/contact page for a published general or partnerships contact email and return it as "publicEmail" (with the page as source in "website"). Never guess or construct an address, and never use personal emails found elsewhere. Leave empty if not published.
- "fit": one honest sentence on how rewarding customers/members/community for referrals and posts could help them reach THEIR goal, or "unclear" if you cannot see a real link. Do not stretch.
- "hooks" are 1-3 specific, true talking points for the email (e.g. "runs a stamp-card for coffee; no referral reward").`,
      { label: `research:${b.id}`, phase: 'Research', schema: RESEARCH },
    ),
    (research, b) => {
      const r = research || { campaigns: [], hooks: [], confidence: 'none', publicEmail: '', website: '', vision: '', goals: [], fit: 'unclear' }
      return agent(
        `Write a tailored outreach message to this business and save it as a Gmail DRAFT.

Business: ${JSON.stringify(b)}
Research: ${JSON.stringify(r)}
Booking link: ${bookingUrl || '[BOOKING LINK] (leave this literal placeholder; the user fills it in)'}

What Tangaza is (background only — do not lead with it${angle === 'goal' ? '' : ' unless the angle is product'}): pay-for-advocacy for local businesses and communities — customers or members bring friends or post about the organisation, it approves each action, and rewards accumulate toward perks it chooses and honours itself. Read PITCH.md and README.md for exact wording; do not exceed what they claim.

${angle === 'goal'
  ? `ANGLE: their goal first. Structure the message as:
1. One sentence showing you understand what THEY are trying to achieve (use research.vision / research.goals in their own terms; do not quote anything you cannot source). If goals are empty, use the most specific true thing from the research instead and do not invent a mission.
2. One or two sentences on how recognising and rewarding the people who already spread the word could help them reach that goal (use research.fit). Describe the outcome for them, not product features.
3. One clear, low-pressure ask: a short call about their goal (30 minutes), with the booking link.
If research.fit is "unclear" or confidence is "none", write a shorter, more curious note that asks about their goals instead of claiming a fit.`
  : `ANGLE: product. Lead with what Tangaza does and how it fits their campaigns.`}

Adjust by kind (keeping the angle above):
- "booked": they already booked a setup session (${b.bookingSlot || 'time unknown'}). Confirm warmly and ask 1-2 questions that help prepare, starting with "what do you most want to achieve in the next few months?" Do not re-pitch.
- "applied": they signed up/applied but have not booked. Thank them, reference their application, and invite them to book a session to shape it around their goal.
- "cold": a short intro as described by the angle.
If the research shows they already run a referral/loyalty scheme, position Tangaza as complementing it, not replacing it.

Channel: the email address is ${b.email || r.publicEmail || '(none)'}. If there is an email address, load the Gmail tools with ToolSearch ("select:mcp__claude_ai_Gmail__create_draft") and create a draft to that address; return its draftId and threadId if provided. If there is NO email but there is a phone, do not create a draft; write a WhatsApp-length text (channel "whatsapp_text", draftCreated false). If neither, channel "none" and explain in "reason".

${SAFETY}`,
        { label: `draft:${b.id}`, phase: 'Draft', schema: DRAFT },
      ).then(draft => ({ business: b, research: r, draft }))
    },
  ),
  () => parallel(toCheck.map(t => () => agent(
    `Check Gmail for what happened with this business we approached, and update its status.

Tracked entry: ${JSON.stringify(t)}
Today: run \`date -I\` for the date. Follow-up threshold: ${followUpAfterDays} days of silence.

Load Gmail tools with ToolSearch (e.g. "select:mcp__claude_ai_Gmail__search_threads,mcp__claude_ai_Gmail__get_thread,mcp__claude_ai_Gmail__create_draft,mcp__claude_ai_Gmail__list_drafts"). Then:
1. Was our draft actually sent? Search for sent mail to ${t.email || 'the business'} (and the draftId if given). If the draft still exists unsent, status "drafted" and nextAction "review and send the draft".
2. If sent: read the thread. Classify the latest state:
   - replied_interested (wants to proceed or book), replied_question (asked something), replied_not_now, replied_declined, booked (a session is confirmed), bounced (delivery failure), or no_reply.
   - Summarise what they said in one or two sentences.
3. If they replied with interest or a question: create a reply DRAFT in the thread answering them (facts only, from the repo). If status is no_reply and our message was sent more than ${followUpAfterDays} days ago and followUps is ${t.followUps || 0} (create a follow-up only when this is 0): create ONE short follow-up DRAFT. Never create a draft for replied_not_now or replied_declined — just recommend a nextAction (e.g. "revisit in 60 days" or "do not contact again").
4. Return the new status, summary, nextAction, threadId, sentAt (ISO or empty), and any replyDraftId / followUpDraftId.

${SAFETY}`,
    { label: `replies:${t.id}`, phase: 'Replies', schema: REPLY },
  ).then(r => (r ? { id: t.id, pageUrl: t.pageUrl, business: t.business, followUps: t.followUps || 0, ...r } : null)))),
])

const newItems = (outreach || []).filter(Boolean).map(x => {
  const d = x.draft
  const status = !d ? 'needs_review'
    : d.channel === 'email' && d.draftCreated ? 'drafted'
    : d.channel === 'whatsapp_text' ? 'whatsapp_ready'
    : 'needs_contact'
  return {
    id: x.business.id,
    business: x.business.business,
    source: x.business.source,
    kind: x.business.kind,
    contactName: x.business.contactName || '',
    email: x.business.email || x.research.publicEmail || '',
    phone: x.business.phone || '',
    website: x.business.website || x.research.website || '',
    location: x.business.location || '',
    searchQuery: x.business.searchQuery || '',
    orgId: x.business.orgId || '',
    bookingSlot: x.business.bookingSlot || '',
    campaigns: x.research.campaigns,
    vision: [x.research.vision, ...(x.research.goals || [])].filter(Boolean).join(' | '),
    researchConfidence: x.research.confidence,
    status,
    channel: d ? d.channel : 'none',
    subject: d ? d.subject || '' : '',
    body: d ? d.body : '',
    draftId: d ? d.draftId || '' : '',
    threadId: d ? d.threadId || '' : '',
    followUps: 0,
    nextAction: status === 'drafted' ? 'review and send the Gmail draft'
      : status === 'whatsapp_ready' ? 'send the WhatsApp text from the tracker entry'
      : 'find a contact method',
    firstDraftedAt: '',
  }
})
const replyItems = (replies || []).filter(Boolean)

// ------------------------------------------------------------------- Track
// One agent per row: rows are independent, so they can be written concurrently.
phase('Track')
const OK = { type: 'object', properties: { ok: { type: 'boolean' }, note: { type: 'string' } }, required: ['ok'] }

const writes = await parallel([
  ...newItems.map(i => () => agent(
    `Create ONE row in the Notion outreach tracker for this new business. ${NOTION}
Run \`date -I\` for today's date.

Use notion-create-pages with parent {"type":"data_source_id","data_source_id":"${TRACKER_DS}"} and these properties (omit any whose value is empty; Campaigns is a short readable summary of the campaigns array, one line per campaign):
- "Business": ${JSON.stringify(i.business)}
- "Business ID": ${JSON.stringify(i.id)}
- "Status": ${JSON.stringify(i.status)}
- "Source": ${JSON.stringify(i.source)}
- "Kind": ${JSON.stringify(i.kind)}
- "Contact name": ${JSON.stringify(i.contactName)}
- "Email": ${JSON.stringify(i.email)}
- "Phone": ${JSON.stringify(i.phone)}
- "Website": ${JSON.stringify(i.website)}
- "Location": ${JSON.stringify(i.location)}
- "Search query": ${JSON.stringify(i.searchQuery)}
- "Org ID": ${JSON.stringify(i.orgId)}
- "date:Booking slot:start": ${JSON.stringify(i.bookingSlot)} (with is_datetime 1)
- "Campaigns": from ${JSON.stringify(i.campaigns)}
- "Vision / goal": ${JSON.stringify(i.vision)} (omit if empty)
- "Research confidence": ${JSON.stringify(i.researchConfidence)}
- "Channel": ${JSON.stringify(i.channel)}
- "Draft subject": ${JSON.stringify(i.subject)}
- "Draft body": ${JSON.stringify(i.body)}
- "Draft ID": ${JSON.stringify(i.draftId)}
- "Thread ID": ${JSON.stringify(i.threadId)}
- "Follow-ups": 0
- "Next action": ${JSON.stringify(i.nextAction)}
- "date:First drafted:start": today
- "date:Last checked:start": today

Before creating, query the tracker for an existing row with the same "Business ID"; if one exists, do NOT create a duplicate — return ok false with a note. Write nothing else.`,
    { label: `track:new:${i.id}`, phase: 'Track', schema: OK },
  )),
  ...replyItems.map(r => () => agent(
    `Update ONE existing row in the Notion outreach tracker. ${NOTION}
Run \`date -I\` for today's date.

Row: ${r.pageUrl} (business "${r.business}"). Use notion-update-page with command "update_properties" and set only these:
- "Status": ${JSON.stringify(r.status)}
- "Last reply": ${JSON.stringify(r.summary)}
- "Next action": ${JSON.stringify(r.nextAction)}
- "date:Last checked:start": today
${r.threadId ? `- "Thread ID": ${JSON.stringify(r.threadId)}\n` : ''}${r.sentAt ? `- "date:Sent at:start": ${JSON.stringify(r.sentAt)}\n` : ''}${r.followUpDraftId ? `- "Follow-up draft ID": ${JSON.stringify(r.followUpDraftId)}\n- "Follow-ups": ${r.followUps + 1}\n` : ''}${r.replyDraftId ? `- "Reply draft ID": ${JSON.stringify(r.replyDraftId)}\n` : ''}
Change nothing else on the row.`,
    { label: `track:update:${r.id}`, phase: 'Track', schema: OK },
  )),
])
const failed = writes.map((w, idx) => (w && w.ok ? null : idx)).filter(idx => idx !== null)
const labels = [...newItems.map(i => i.business), ...replyItems.map(r => r.business)]
if (failed.length) log(`Notion write problem for: ${failed.map(idx => labels[idx]).join(', ')}`)

const byStatus = {}
for (const t of [...newItems, ...replyItems]) byStatus[t.status] = (byStatus[t.status] || 0) + 1
log(`tracker updated: ${labels.length - failed.length}/${labels.length} rows written. ${JSON.stringify(byStatus)}`)

return {
  trackerUrl: TRACKER_DB,
  notionWriteFailures: failed.map(idx => labels[idx]),
  warnings: [...prospectWarnings, ...disc.warnings],
  deferred: Math.max(0, disc.fresh.length - maxNew),
  newDrafts: newItems.map(i => ({ business: i.business, email: i.email, location: i.location, phone: i.phone, website: i.website, kind: i.kind, status: i.status, subject: i.subject, confidence: i.researchConfidence })),
  replies: replyItems.map(r => ({ business: r.business, status: r.status, summary: r.summary, nextAction: r.nextAction })),
  needsYourAction: [
    ...newItems.filter(i => i.status !== 'drafted').map(i => `${i.business}: ${i.nextAction}`),
    ...replyItems.filter(r => ['replied_interested', 'replied_question', 'no_reply', 'drafted'].includes(r.status)).map(r => `${r.business}: ${r.nextAction}`),
  ],
}
