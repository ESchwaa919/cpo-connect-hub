import { StatCard } from '@/components/members/insights/StatCard'
import { ChannelSection, type ChannelData } from '@/components/members/insights/ChannelSection'
import { useState } from 'react'
import { ChannelScopePicker } from '@/components/members/shared/ChannelScopePicker'
import type { ChannelScopeValue } from '@/lib/channel-scope-params'

// ── Aggregate stats ──────────────────────────────────────────────────────────

const aggregateStats = [
  { label: 'Total Messages', value: 783 },
  { label: 'Channels', value: 4 },
  { label: 'Active Days', value: 29 },
  { label: 'New Members', value: '—' },
  { label: 'Active Members', value: '138' },
]

// ── AI Channel ───────────────────────────────────────────────────────────────

const aiChannel: ChannelData = {
  name: 'AI',
  chartColor: '#7c3aed',
  sentimentColor: '#7c3aed',
  dailyVolume: [
    { day: '1', messages: 2 }, { day: '2', messages: 2 }, { day: '4', messages: 2 },
    { day: '5', messages: 13 }, { day: '6', messages: 3 }, { day: '7', messages: 20 },
    { day: '8', messages: 4 }, { day: '9', messages: 2 }, { day: '11', messages: 3 },
    { day: '12', messages: 2 }, { day: '13', messages: 1 }, { day: '14', messages: 32 },
    { day: '15', messages: 4 }, { day: '18', messages: 2 }, { day: '19', messages: 46 },
    { day: '20', messages: 13 }, { day: '21', messages: 13 }, { day: '22', messages: 6 },
    { day: '23', messages: 4 }, { day: '24', messages: 6 }, { day: '26', messages: 1 },
    { day: '28', messages: 2 }, { day: '29', messages: 9 }, { day: '31', messages: 1 },
  ],
  contributors: [
    { name: 'Ashwin', messages: 15, color: 'rgba(251,146,60,0.7)' },
    { name: 'Erik Schwartz', messages: 12, color: 'rgba(167,139,250,0.7)' },
    { name: 'Neshma Emile', messages: 11, color: 'rgba(244,114,182,0.7)' },
    { name: 'Esin', messages: 8, color: 'rgba(248,113,113,0.7)' },
    { name: 'Sascha Brossmann', messages: 8, color: 'rgba(129,140,248,0.7)' },
    { name: 'Caroline', messages: 8, color: 'rgba(251,191,36,0.7)' },
    { name: 'Chanade', messages: 7, color: 'rgba(52,211,153,0.7)' },
    { name: 'Ryan Musselwhite', messages: 7, color: 'rgba(96,165,250,0.7)' },
    { name: 'Graham Reed', messages: 6, color: 'rgba(45,212,191,0.7)' },
    { name: 'Gem Coles', messages: 6, color: 'rgba(251,146,60,0.5)' },
    { name: 'Others', messages: 105, color: 'rgba(71,85,105,0.5)' },
  ],
  sentiment: [
    { label: 'Practical', value: 34 },
    { label: 'Skeptical', value: 24 },
    { label: 'Philosophical', value: 16 },
    { label: 'Enthusiastic', value: 14 },
    { label: 'Humorous', value: 12 },
  ],
  trends: [
    {
      title: 'The Token-Burn Reckoning — “How Much Are You Burning Monthly?”',
      description:
        'May was the month the bill came due. On 7 May Ashwin described 12 hours and 25+ deployments lost to Claude Code going in circles — “It ended with me asking ‘Did you do X and Y as I had clearly specified — in bold and in font size 72?’ Reply: ‘Honest answer: no, on both counts’.” Joana: “I nearly told Claude yesterday: then give me back my tokens.” On 14 May Ashwin ran “the poll of shame” on monthly Claude Code spend per user — the cluster landed at $100–$300 (5 votes) with two members over $500. Kim Faura set the counter-position: “$200 is nothing compared to the value I am getting from Claude Code. I would only move for a better tool, but not a cheaper one.” Then Alastair Preacher flagged incoming Anthropic price changes (“going to get a shit load more expensive”) after spending £150 in a day on API credits, and Sascha Brossmann called the medium-term move: “Lots of business going to China soon. Or at least to the SOTA open weights models, wherever you run them.”',
      tags: [{ label: 'Hottest Moment', variant: 'hot' }],
      dateRange: 'May 7–14',
    },
    {
      title: 'Token Hygiene — The Survival Playbook',
      description:
        'The cost anxiety produced the month’s most useful practical thread (21 May). Suvagata Roy: keep system prompts and retrievals light, selectively load skills/sub-agents per project, store intermediate deliverables as markdown and reference them rather than re-deriving. Max Mizzi: “MCP is really token heavy, use CLIs and APIs where possible. If you have complex system prompts, standards, guidelines etc consider doing a ‘progressive reveal’ setup.” Ashwin’s recipe: a lean CLAUDE.md with references to other .md files invoked only when needed, a sessions/status file so you don’t restart and waste tokens mid-session, the “caveman” skill, and telling Claude not to touch anything you can do manually (SQL in Supabase, git commits/pushes). Graham Reed: “💯 this.” The community is quietly converging on a discipline of restraint.',
      tags: [{ label: 'Practical', variant: 'green' }],
      dateRange: 'May 21',
    },
    {
      title: 'The Great Prototyping Stack Survey',
      description:
        'On 19 May Faith Forster ran a run of polls that mapped the community’s build stack in real time. Prototyping tool: Claude Code (23), Claude Design (9), Figma Make (5), Replit (2). Who/when prototypes: “a mix, depends on the project/team” (18) led decisively. Build tool: Claude Code (16), Cursor (3). And most teams take the prototype to a different platform to build (6 vs 1). The thread underneath was the real gold — Suvagata Roy’s pipeline (Gemini to write the PRD prompt → Lovable → GitHub → Claude Code for design system + logic → Vercel), Ben L and Carla on using one LLM to optimise prompts for another (“they critique each other well”), and Erik Schwartz swapping Google Stitch for Lovable with Render.com for deployment.',
      tags: [{ label: 'Hottest Topic', variant: 'blue' }],
      dateRange: 'May 19',
    },
    {
      title: 'Sascha’s Prototyping Masterclass — “Innovation Doesn’t Work Without Waste”',
      description:
        'Sascha Brossmann (who taught UX prototyping at art college ~20 years ago) turned the prototyping thread into a clinic on 20 May. “Prototyping is nearly always throwaway. Better for diverging more early, which yields far better solutions when converging. If at least ~70% of ideas aren’t failing, you’re doing it wrong.” His diagnosis of the field: “Most product teams diverge far too little and converge way too early… too much fear about ‘wasting time’.” And the limit of the tools: “AI tools gravitate hard to the obvious category unless you really push them hard… better than amateurs for common solutions but not meeting professional quality levels yet. That space is still far from solved (and much harder to train than coding).” Nick Jemetta’s coda: “It’s even more important now than ever to be clear on what you’re trying to learn by prototyping so you can match the desired insights with the right fidelity.”',
      tags: [{ label: 'Deep Dive', variant: 'blue' }],
      dateRange: 'May 20',
    },
    {
      title: 'The AI Jobs Apocalypse — What It Actually Looks Like',
      description:
        'On 7 May Erik Schwartz shared a data piece on the real shape of the AI jobs shift. Ryan Musselwhite gave the from-the-trenches version: “Exactly happening at my workplace too — we’ve increased our outputs due to AI but are still hiring more engineers. We’ve shifted a lot more to higher-value work/roadmap, less on defects/debt after the AI adoption and rollout.” Erik: “That’s brilliant — such an excellent pivot.” It’s the optimistic counter-melody to the doom narrative: AI as a lever that moves humans up the value chain rather than off it.',
      tags: [{ label: 'Industry', variant: 'amber' }],
      dateRange: 'May 7–8',
    },
    {
      title: 'Learning AI — The Overwhelm and the Onboarding Norm',
      description:
        'The channel’s most human recurring thread. Neshma Emile (5 May): “Looking for recs on getting into AI agents… I want to build something that actually ships rather than just do a course.” Robin (7 May) wrote the month’s most relatable confession: “There’s no shortage of trainings on AI and I feel completely overwhelmed by the options… I still feel like I’m missing something, I just don’t know what. I have a fear that if I just continue dabbling on my own, I’ll be on a slow road to nowhere useful.” The community answered generously — Paul surfaced Anthropic’s free Skilljar certs, Karuna pointed to the AI Fluency Framework Foundations course, Neshma offered to share what was working as she went. The same warm, specific onboarding instinct that defined April.',
      tags: [{ label: 'Community', variant: 'green' }],
      dateRange: 'May 5–8',
    },
    {
      title: 'EU AI Act — Esin’s Build-It-In Checklist',
      description:
        'On 5 May Esin shared a practical artifact: a checklist she built (after reading the EU AI Act) to embed its principles into product features from the start — “of course consulting the DPO of the organisation; I am not a compliance professional.” Built with the media sector in mind and already in use at Sky, she dropped the Google Doc straight into the channel. Sarah Baker-White: “This is the best!!! Thanks for sharing.” A small, generous act that turned a regulatory headache into a reusable team tool.',
      tags: [{ label: 'Community Build', variant: 'green' }],
      dateRange: 'May 5–6',
    },
    {
      title: 'LLM Personalities & the Long-Horizon Agent Lab',
      description:
        'On 15 May Caroline surfaced Emergence’s “World” — a laboratory for evaluating long-horizon agent autonomy — after Robin asked whether a bonkers-seeming agent experiment was real (“Seems absolutely bonkers!”). Caroline confirmed it and shared a table comparing each LLM’s emergent “personality”: “it confirms what we probably instinctively knew about each LLM’s personality (I’m sure this could be plotted on a DnD 3×3 chart!).” The thread captured a maturing instinct in the channel — moving from “which model is best” to “which model behaves how, and when does that matter.”',
      tags: [{ label: 'Industry', variant: 'blue' }],
      dateRange: 'May 15',
    },
    {
      title: 'Anthropic + Karpathy, and the Compute Arms Race',
      description:
        'On 19 May Nick Jemetta flagged what he called “a huge move by both Anthropic and Andrej Karpathy.” David Magee connected the dots on why it matters: “They also have all the compute via the xAI deal — massive talent density plus the GPUs!” Nick: “They mean business!” The undercurrent of the whole month — compute scarcity, pricing, and where the leverage sits — surfacing again as a headline-grade industry signal.',
      tags: [{ label: 'Industry', variant: 'amber' }],
      dateRange: 'May 19',
    },
    {
      title: 'Agent Testing & Observability — Beyond Evals',
      description:
        'On 29 May Mauricio asked what tools people use to automate agent testing: “I was looking at promptfoo, but it’s focused on evals which misses what’s going on under the hood (e.g. a tool failed and the agent had to do a second call to the model).” Suvagata Roy answered with a working stack: Arize (arize.com) for his personal projects once you hook up spans and traces properly, and Braintrust (braintrust.dev) at his company. A quiet but high-signal exchange for anyone shipping agents into production.',
      tags: [{ label: 'Practical', variant: 'blue' }],
      dateRange: 'May 29',
    },
    {
      title: 'Erik at LLMday London — “From Prompt to Product”',
      description:
        'Erik Schwartz trailed his LLMday London talk on 21 May and reported back on 29 May: “My talk yesterday at LLMday was really well received,” sharing the slides (“From Prompt to Product”). Layered around it: Dave Killeen’s free LLM-engineering course prompt (“created in between ironing bed sheets!”) and his SaaSiest Malmö preso to 1,000 C-suite execs on leaning into open source. Erik’s reply was the channel’s laugh of the month: “Wait you iron bed sheets?? Now that’s something we need to talk about.”',
      tags: [{ label: 'Community Event', variant: 'green' }],
      dateRange: 'May 21–29',
    },
    {
      title: 'In Praise of AI Sceptics',
      description:
        'Caroline closed the month (28 May) with an article by her friend Athena Peppes reframing the sceptics: “What if we treated the AI sceptics as the signal where adoption isn’t working, instead of people simply resisting and a problem to ‘manage out’?” It paired with Donovan Thomson’s 29 May prompt — “How has AI changed what it means to be a great product leader?” — bookending a month that kept circling the same question: as the tools get more capable, the human judgement about when and whether to use them gets more valuable, not less.',
      tags: [{ label: 'Philosophical', variant: 'amber' }],
      dateRange: 'May 28–29',
    },
  ],
}

const aiStats = [
  { label: 'Messages', value: 193 },
  { label: 'Active Members', value: 66 },
  { label: 'Active Days', value: 24 },
  { label: 'New Members', value: '—' },
]

// ── General Channel ──────────────────────────────────────────────────────────

const generalChannel: ChannelData = {
  name: 'General',
  chartColor: '#60a5fa',
  sentimentColor: '#60a5fa',
  dailyVolume: [
    { day: '1', messages: 6 }, { day: '2', messages: 3 }, { day: '3', messages: 3 },
    { day: '4', messages: 5 }, { day: '5', messages: 5 }, { day: '6', messages: 7 },
    { day: '7', messages: 9 }, { day: '8', messages: 55 }, { day: '9', messages: 9 },
    { day: '11', messages: 7 }, { day: '12', messages: 26 }, { day: '13', messages: 15 },
    { day: '14', messages: 7 }, { day: '15', messages: 8 }, { day: '16', messages: 1 },
    { day: '17', messages: 2 }, { day: '19', messages: 14 }, { day: '20', messages: 25 },
    { day: '21', messages: 18 }, { day: '22', messages: 23 }, { day: '23', messages: 4 },
    { day: '25', messages: 2 }, { day: '26', messages: 4 }, { day: '27', messages: 4 },
    { day: '28', messages: 3 }, { day: '29', messages: 8 },
  ],
  contributors: [
    { name: 'Caroline', messages: 19, color: 'rgba(244,114,182,0.7)' },
    { name: 'Graham Reed', messages: 15, color: 'rgba(52,211,153,0.7)' },
    { name: 'Tania', messages: 14, color: 'rgba(251,191,36,0.7)' },
    { name: 'Gregor Young', messages: 10, color: 'rgba(167,139,250,0.7)' },
    { name: 'Nadia Inv', messages: 10, color: 'rgba(96,165,250,0.7)' },
    { name: 'Ashwin', messages: 9, color: 'rgba(251,146,60,0.7)' },
    { name: 'Esin', messages: 8, color: 'rgba(248,113,113,0.7)' },
    { name: 'Scotty', messages: 8, color: 'rgba(45,212,191,0.7)' },
    { name: 'Emily Tate', messages: 8, color: 'rgba(129,140,248,0.7)' },
    { name: 'Jessie', messages: 8, color: 'rgba(251,146,60,0.5)' },
    { name: 'Others', messages: 164, color: 'rgba(71,85,105,0.5)' },
  ],
  sentiment: [
    { label: 'Practical', value: 34 },
    { label: 'Philosophical', value: 20 },
    { label: 'Humorous', value: 16 },
    { label: 'Enthusiastic', value: 16 },
    { label: 'Skeptical', value: 14 },
  ],
  trends: [
    {
      title: 'The Great No-Show Debate',
      description:
        'On 8 May Gregor Young opened the founders’ question to the community — how to handle no-shows at the free, curated IRL events — and the channel produced 55 messages in a single day, the month’s biggest spike. The poll favoured “a small refundable deposit” (12) but the comment thread split into camps. The deposit/charity-donation side (Ashwin: “2 no-shows → temporary expulsion; 1 no-show with no notice → mandatory donation to charity”) ran into a heavyweight “just oversubscribe” bloc. Emily Tate (9 years running ProductTank/MTP events): “Plan for 50% no-show on free events and call it a day… having the admin of refunds is very obnoxious. The ‘3 strikes you’re out’ method risks reputational damage — life gets busy.” Sascha Brossmann brought the behavioural science: “Once you penalise an undesirable behaviour with a fee you risk eroding intrinsic motivation and legitimising the behaviour (paying for it makes the offender feel settled)” — citing Alfie Kohn’s “Punished by Rewards.” Caroline’s one-liner: “This is what airlines do, with PAID seats.” Scotty’s: a fake ChatGPT prompt to “make sure my wife doesn’t get stuck on a train looking after our 8-year-old next time.” At a 15% no-show rate, several concluded the community was “fretting about a non-issue.”',
      tags: [{ label: 'Hottest Moment', variant: 'hot' }],
      dateRange: 'May 8–9',
    },
    {
      title: 'The “Free Consulting” Interview Red Flag',
      description:
        'On 20 May Tania brought a live dilemma: a 2nd-interview case-study brief that mapped exactly onto the company’s real, current initiative — “if I spend a few days working on this, present it, and then… they now have my work for free.” Craig Unsworth’s reply became the thread of the month: “There’s a big difference between a sensible interview exercise designed to understand how you think, and a company effectively asking candidates to solve their live operational problems for free… A good hiring process should assess how you structure problems, communicate, prioritise and lead ambiguity. It should not require free consulting. TL;DR: Tell them to get stuffed.” Howi was so taken he added Tania’s question and Craig’s reply to a new “Interview RED FLAGS” tab in his master prep doc. Graham Reed and Neil Pleasants confirmed they’d seen identical patterns — including a company that pulled the role right after the interviews.',
      tags: [{ label: 'Hottest Topic', variant: 'hot' }],
      dateRange: 'May 20–21',
    },
    {
      title: 'Skills Atrophy — Caroline’s Use-It-or-Lose-It Series',
      description:
        'Carrying the thread from the April AKQA roundtable, Caroline published a mini-series on mitigating skills atrophy — strategic thinking (#45, 3 May) and decision-making (#46, 9 May). It evolved into something concrete: by 12 May she was vibe-coding an assessment app that scores resistance to AI adoption across 12 areas and advises where to start, and offered it to the channel to test (Nadia Inv, Matt Fitz, J Rainey all volunteered). Meg Porter: “Are we going to have a read-and-react lunch and learn on this topic??” The month’s quiet through-line: deliberately keeping the judgement muscles trained while the tools take the load.',
      tags: [{ label: 'Deep Dive', variant: 'blue' }],
      dateRange: 'May 3–12',
    },
    {
      title: 'The New-Joiner Wave — “Can’t Keep Up With How Fast This Is Growing”',
      description:
        'Mid-month brought a surge of senior arrivals, especially around 19–20 May. Laura Nana (Product Director at Smartsheet, working on Developer Ecosystem, MCP and Data Integrations), Tejus (until recently VP of Product at The Economist, launching Economist Pro), and Katarina Ryan (18 years at Paramount, senior director of product for MTV/Nick across content systems and discovery) all introduced themselves. Jessie sent a warm welcome and pointed everyone to the membership area, directory and chat search; Nick Jemetta caught the mood: “Welcome — can’t keep up with how fast this community is growing. Amazing to see.”',
      tags: [{ label: 'Community', variant: 'green' }],
      dateRange: 'May 19–20',
    },
    {
      title: 'Scotty’s Software in Orbit — The Space Thread',
      description:
        'A gloriously off-piste human moment. Caroline (7 May) flagged the UK Space Agency’s LEO accelerator (she’s a mentor) and asked for early-stage space founders — “I’d particularly like to see more female founders.” Scotty revealed a hidden past: “I wrote software that is still in orbit, and software that is still used to make sure that Ariane rockets are heading in the right direction just after launch. Also designed the UK’s National Remote Sensing Centre’s data collection system.” Caroline countered with her own moonshot: “I’m working towards training astronauts (and space tourists!) on space psychology — want to land humans on Mars by 2040.” Product leaders, but also humans with extraordinary second lives.',
      tags: [{ label: 'Community', variant: 'green' }],
      dateRange: 'May 7',
    },
    {
      title: 'AEO / GEO for Product Discovery',
      description:
        'On 14 May Gem Coles asked who else was exploring Answer/Generative Engine Optimisation for product discovery, ahead of a website replan: “plan is to disrupt ourselves & of course has to be AEO optimised.” Michelle Wright shared her own GEO article and a podcast; Caroline added her takeaways from the Lenny’s episode with Ethan Smith: “1. it’s a long game and 2. it’s based on similar principles to SEO — authority and hyper-personalisation of queries (the long tail).” Nick Jemetta dropped the Google Developers AI-optimization guide the next morning. The annual “how do we get found” question, now refracted through LLM-mediated discovery.',
      tags: [{ label: 'Industry', variant: 'blue' }],
      dateRange: 'May 14–16',
    },
    {
      title: 'Matt LeMay Joins the Room',
      description:
        'On 11 May Matt LeMay introduced himself — “about 15 years in product, most of it as an author/consultant/thinky-talky-person” — author of IMPACT-FIRST PRODUCT TEAMS, offering free physical copies to anyone in the group (“especially to pass along to CFOs, COOs and other folks in leadership roles”). He’s also gathering Impact-First AI stories and, in the most CPO-Connect detail of the month, building “a platform for vintage suiting intelligence (yes, you read that right).” Simon Waldman: “Hi Matt! Great to see you here.”',
      tags: [{ label: 'Community', variant: 'green' }],
      dateRange: 'May 11',
    },
    {
      title: 'SXSW London — “Never Again,” Say the Big Hitters',
      description:
        'On 22 May Robin floated a SXSW London meetup and got an unusually unanimous reality check. Matt LeMay: “BIG FLASHY FANCY HEADLINE EVENT and haven’t quite gotten there executionally.” Craig Unsworth: “Everyone I know who tried has said never again. And there are some big hitters on that list… SXSW was amazing. In Austin. Until around 2016.” Emily Tate (a SXSW veteran and 2017 speaker): “I despise how they curate the agenda — the public vote is obnoxious and just free marketing for them… they’ve never figured out the queueing/capacity, so temper expectations. But the networking and side events are worthwhile.” Honest, funny, and exactly the kind of signal the community exists to share.',
      tags: [{ label: 'Industry', variant: 'amber' }],
      dateRange: 'May 22',
    },
    {
      title: 'One Thing to Improve — “Measuring Success” Wins',
      description:
        'Laurence Bahrami (20 May) asked: “If you could improve one task that you or your team carry out, what would be your highest priority?” The answers converged hard: tracking and validating value (Hannah Day), measuring success (Laura Nana, Graham Reed, Matt LeMay — “I’m a bit biased lol”), confidence (AlanArnfeld), accurate sizing after t-shirt sizing (Tania). A quick crowd-sourced snapshot of where senior product leaders still feel the most friction.',
      tags: [{ label: 'Practical', variant: 'blue' }],
      dateRange: 'May 20–21',
    },
    {
      title: 'Be Kind — You Don’t Know What’s Going On',
      description:
        'Tania (22 May) shared a small story with a big point. A talent person who’d reached out to her went quiet, then sent a rejection; she replied warmly anyway (“I do hope everything is OK with you”). He later apologised — he’d been made redundant. “I’m really glad I sent those messages and didn’t just sweep it under the carpet. TL;DR: Be kind, you don’t know what’s going on in other people’s lives.” The channel’s emotional register at its best.',
      tags: [{ label: 'Personal', variant: 'pink' }],
      dateRange: 'May 22',
    },
    {
      title: 'Little Lenny’s — Two Weeks of Community Build-and-Test',
      description:
        'Michelle Wright spent the back half of the month building Little Lenny’s — real Lenny’s Podcast conversations translated for kids aged 7–11 (Stewart Butterfield, Elena Verna, Annie Duke). She recruited the channel to test it with their children (15 May), iterated on the feedback (“it’s been really helpful and has already shaped a few things”), and on 27 May submitted it to the Lenny’s × Replit Build-a-thon. A clean arc of the community’s favourite pattern: build in the open, test with peers, ship.',
      tags: [{ label: 'Community Build', variant: 'green' }],
      dateRange: 'May 15–27',
    },
  ],
}

const generalStats = [
  { label: 'Messages', value: 273 },
  { label: 'Active Members', value: 94 },
  { label: 'Active Days', value: 26 },
  { label: 'New Members', value: '—' },
]

// ── Jobs Channel ───────────────────────────────────────────────────────────

const jobsChannel: ChannelData = {
  name: 'Jobs',
  chartColor: '#f59e0b',
  sentimentColor: '#f59e0b',
  dailyVolume: [
    { day: '1', messages: 18 }, { day: '2', messages: 4 }, { day: '4', messages: 1 },
    { day: '5', messages: 16 }, { day: '6', messages: 9 }, { day: '7', messages: 5 },
    { day: '8', messages: 8 }, { day: '12', messages: 29 }, { day: '13', messages: 19 },
    { day: '19', messages: 17 }, { day: '20', messages: 13 }, { day: '21', messages: 87 },
    { day: '22', messages: 14 }, { day: '23', messages: 3 }, { day: '26', messages: 1 },
    { day: '28', messages: 1 }, { day: '29', messages: 2 },
  ],
  contributors: [
    { name: 'Jamie Webber', messages: 17, color: 'rgba(251,191,36,0.7)' },
    { name: 'Suvagata Roy', messages: 14, color: 'rgba(129,140,248,0.7)' },
    { name: 'Robin', messages: 14, color: 'rgba(96,165,250,0.7)' },
    { name: 'Caroline', messages: 10, color: 'rgba(244,114,182,0.7)' },
    { name: 'James Engelbert', messages: 10, color: 'rgba(167,139,250,0.7)' },
    { name: 'Sascha Brossmann', messages: 10, color: 'rgba(52,211,153,0.7)' },
    { name: 'Tania', messages: 9, color: 'rgba(248,113,113,0.7)' },
    { name: 'Graham Reed', messages: 9, color: 'rgba(45,212,191,0.7)' },
    { name: 'Jen Heape', messages: 9, color: 'rgba(251,146,60,0.7)' },
    { name: 'Neshma Emile', messages: 7, color: 'rgba(251,146,60,0.5)' },
    { name: 'Others', messages: 138, color: 'rgba(71,85,105,0.5)' },
  ],
  sentiment: [
    { label: 'Practical', value: 44 },
    { label: 'Philosophical', value: 18 },
    { label: 'Polarizing', value: 16 },
    { label: 'Humorous', value: 12 },
    { label: 'Enthusiastic', value: 10 },
  ],
  trends: [
    {
      title: 'IC vs Leadership — The Crossroads (87 Messages in a Day)',
      description:
        'On 21 May Carla asked whether anyone had moved from a leadership role back to IC, prompted by a Lenny’s/Nikhyl podcast on reinvention in an AI-driven future. It detonated into the channel’s biggest day ever — 87 messages. James Engelbert took the principled line: “If you’re a high-performing IC you should be paid the same as a manager. Pushing people into leading teams because that’s the only way to get more money is an anti-pattern.” The pay reality: Jessie pegged senior IC roles at £85–110k base; Graham Reed noted staff/principal tends to map to director level; Jen Heape shared she was starting a senior IC role (“Product & AI Director”) at leadership level on 1 June. Sascha Brossmann widened it into righteous anger at bonus pools and bell curves (“We should all be utterly angry at stupid destructive systems… if you cannot change anything, the fairest answer is full randomisation”), and Suvagata Roy offered a trust model: “Make it you & I against the company policy, rather than you vs me.” Then Robin opened up about a possible pivot entirely out of product — into teenage-mental-health research — and Caroline answered with her Mars-mission reverse-engineering coaching. A thread that started about titles and ended about meaning.',
      tags: [{ label: 'Hottest Moment', variant: 'hot' }],
      dateRange: 'May 21',
    },
    {
      title: 'Jamie Webber’s Proactive-Outreach Masterclass',
      description:
        'It started small: on 1 May Susi Mackeown asked whether anyone had landed roles via speculative outreach. Jamie Webber (RedCat) offered a quick call — and by popular demand (a J Rainey poll, an Esin endorsement: “shamelessly self-promoting because he’s actually that good”) it became three Teams sessions on 13–14 May covering “the psychology of the search, imposter syndrome, identifying and owning your brilliance, who to target and how, building your personal brand, and the importance of tracking all your activity.” The gratitude afterwards was wall-to-wall (Ian, Sadaf Z, Jit, Matt Fitz, Tania). Jamie: “It’s my pleasure — hope it’s helpful (and sorry, I talk a lot!).”',
      tags: [{ label: 'Community', variant: 'green' }],
      dateRange: 'May 1–14',
    },
    {
      title: 'Job Search Councils Become a Norm',
      description:
        'On 5 May Gregor Young nudged the community to self-organise: “A few months back I kick-started a bunch of Job Search Councils… I’d love to see this as a norm — if you’re hoping to join one, take the initiative, put your hand up and ask if anyone else is keen to start one with you,” sharing the how-to doc. Suvagata Roy immediately spun up a new group for people starting around the same time, and by 19 May Ashwin was being slotted into an existing JSC that had spare capacity after members landed roles. Quiet community infrastructure doing exactly what it’s meant to.',
      tags: [{ label: 'Community', variant: 'green' }],
      dateRange: 'May 5–19',
    },
    {
      title: '“Open to Work” — Banner, or Behind the Scenes?',
      description:
        'On 12 May Lisa asked whether LinkedIn’s Open to Work is helpful or just spam — and surfaced a real distinction most miss: the public green banner versus the recruiter-only flag (Richard Buck). The recruiters in the room (Jamie Webber, Jessie, Fiona) were unanimous that it’s a positive signal — “I’d never discount someone just because they had the open-to-work flag on. It honestly blows my mind that anyone would.” Joana described the inverse game in Norway (“hiring managers only want who they can’t hire… playing the product diva”), and Richard named the “scarcity principle” ego dynamic (“we headhunted them, they weren’t even looking”). Jit’s verdict landed it: “My last boss said it was a red flag — which was a red flag to me.”',
      tags: [{ label: 'Polarizing', variant: 'amber' }],
      dateRange: 'May 12',
    },
    {
      title: 'AI Job-Matching Tools on Trial — Jack & Jill',
      description:
        'On 20 May Robin asked whether anyone had used Jack & Jill (jackandjill.ai) and whether the model was working — and the channel delivered a brutal, useful teardown. Neshma Emile and Andy Freeburn savaged the clunky UX and poor matching (“no obvious understanding of my background… basic geography, role title and salary matching dressed up as an ‘intelligent AI tool’”). Max Mizzi’s nuanced take: “I love the concept and initial experience… but reccos got steadily much worse as I gave feedback, which really surprised me. The ‘promise’ of acting like a recruiter vs a job-post aggregation platform fell very flat.” Ben Andrews dissented (“much better at matching than other platforms I’ve used”), and Graham Reed eulogised Welcome to the Jungle’s post-acquisition decline. A real-time, candid product critique from the exact users these tools are built for.',
      tags: [{ label: 'Industry', variant: 'blue' }],
      dateRange: 'May 20–21',
    },
    {
      title: 'Standing Out — Caroline’s Positioning Guide & the Value Proposition',
      description:
        'On 6 May Caroline shared her “stop sounding like everyone else” guide — covering LinkedIn headline, networking intro, CV summary and interview intro — noting every job-seeking client in the last 12 months had landed a role, averaging 7 weeks from start to offer. Gregor Young added his coach-built Value Proposition structure (“I am a ___, I specialize in ___, what makes me special is ___”) plus a memorable Career Story: “Getting these two things right should be the #1 priority for job seekers at a senior level.” Caroline: “It’s like having a compelling opening to a book you can’t put down — what’s the career story you’re going to share throughout the interview process?”',
      tags: [{ label: 'Practical', variant: 'green' }],
      dateRange: 'May 6–8',
    },
    {
      title: 'The Post-Interview Routine',
      description:
        'A lovely, human aside on 22 May. Katarina Ryan: “Does anyone else have a post-interview routine? I can’t really focus on much after interviews, so now I do all the boring chores around my house.” The replies became a little catalogue of self-management — Tania’s walk-away-and-reward, Neshma Emile’s side project (an astrology app for her mum) to stop the rumination, Laura Nana’s reflective dog walk, Robin’s AI-transcribed voice notes followed by talking it out with a product-management bff. Proof the channel is as much about surviving the search as winning it.',
      tags: [{ label: 'Personal', variant: 'pink' }],
      dateRange: 'May 22',
    },
    {
      title: 'The Roles Board — Bauer, Ensek, Payments & a Switzerland Move',
      description:
        'The month’s steady stream of opportunities and asks: James Engelbert announced he’s joining Bauer Media and building a team (Service Design Lead + Senior PM); Prachi Garg opened two PM roles at Ensek, the billing platform for Centrica (IAM/customer config, and API-as-a-product); Donovan Thomson hunted for PMs with payments experience; and Sadaf Z canvassed the room about moving from the UK to Switzerland (Lisa, ex-Zurich, offered a chat). Howi closed the month passing along a Found by Few collective update — “if one or more of these suits you, it’s worth dropping her an email, and/or passing it on.” The channel doing exactly what it was built for.',
      tags: [{ label: 'Practical', variant: 'blue' }],
      dateRange: 'May 6–29',
    },
  ],
}

const jobsStats = [
  { label: 'Messages', value: 247 },
  { label: 'Active Members', value: 83 },
  { label: 'Active Days', value: 17 },
  { label: 'New Members', value: '—' },
]

// ── Leadership Channel ───────────────────────────────────────────────────────

const leadershipChannel: ChannelData = {
  name: 'Leadership & Culture',
  chartColor: '#34d399',
  sentimentColor: '#34d399',
  dailyVolume: [
    { day: '1', messages: 1 }, { day: '2', messages: 8 }, { day: '7', messages: 1 },
    { day: '8', messages: 18 }, { day: '9', messages: 2 }, { day: '11', messages: 6 },
    { day: '12', messages: 4 }, { day: '19', messages: 3 }, { day: '20', messages: 2 },
    { day: '21', messages: 6 }, { day: '22', messages: 3 }, { day: '23', messages: 1 },
    { day: '28', messages: 7 }, { day: '29', messages: 8 },
  ],
  contributors: [
    { name: 'James Engelbert', messages: 12, color: 'rgba(167,139,250,0.7)' },
    { name: 'Caroline', messages: 11, color: 'rgba(244,114,182,0.7)' },
    { name: 'Esin', messages: 5, color: 'rgba(248,113,113,0.7)' },
    { name: 'Jamie', messages: 2, color: 'rgba(251,191,36,0.7)' },
    { name: 'Nick Jemetta', messages: 2, color: 'rgba(96,165,250,0.7)' },
    { name: 'AlanArnfeld', messages: 2, color: 'rgba(52,211,153,0.7)' },
    { name: 'Graham Reed', messages: 2, color: 'rgba(45,212,191,0.7)' },
    { name: 'Ruan Odendaal', messages: 2, color: 'rgba(129,140,248,0.7)' },
    { name: 'Prachi Garg', messages: 2, color: 'rgba(251,146,60,0.7)' },
    { name: 'Ana Woodrow', messages: 1, color: 'rgba(251,146,60,0.5)' },
    { name: 'Others', messages: 29, color: 'rgba(71,85,105,0.5)' },
  ],
  sentiment: [
    { label: 'Philosophical', value: 26 },
    { label: 'Practical', value: 24 },
    { label: 'Polarizing', value: 18 },
    { label: 'Personal', value: 16 },
    { label: 'Humorous', value: 16 },
  ],
  trends: [
    {
      title: 'PM Competency Framework v2 — The Foundations Debate',
      description:
        'The month opened where April closed: Caroline’s updated PM competency framework. James Engelbert pushed on it (2 May): “Did you think about their level of experience, or would you say these are foundations? Managers of PMs would need this + team leadership competencies… What about financial literacy?” Ana Woodrow seconded financial literacy and added “communication skills including managing conflict, presentation and storytelling.” Caroline distinguished the layers — “these are foundations; I’d use the Dreyfus model to delineate levels of accomplishment at the competency level” — and shared the original model she’s updating. A careful, generous working-out-loud on what the modern PM craft actually consists of.',
      tags: [{ label: 'Deep Dive', variant: 'blue' }],
      dateRange: 'May 2',
    },
    {
      title: 'Financial Literacy — From Ask to Webinar',
      description:
        'On 8 May Jamie asked for resources to help his team “communicate more commercially — less ‘feature-speak’, more business impact.” The thread became the channel’s busiest day (18 messages): a reading list (Rich Mironov’s new book via randy silver, Matt LeMay’s Impact-First Product Teams, Martin Eriksson’s Decision Stack, Graham Reed’s own Product Ops playbook) and Esin offering her own frameworks. By 11 May James Engelbert and Esin had turned the energy into a scheduled financial-literacy webinar (poll → 29 May), which Esin ran to warm reviews — Lilli Buettner: “Aligning commercial and product perspectives is an art of itself; for me shared accountability and empathy is always a key driver.” Sascha’s sharp aside: “_not_ considering product teams as commercial is already a telltale symptom.”',
      tags: [{ label: 'Community Build', variant: 'green' }],
      dateRange: 'May 8–29',
    },
    {
      title: 'Is AI Making Us Dumb?',
      description:
        'On 7 May Simon Waldman dropped a single, well-aimed link on AI and critical thinking (“apologies if this has been shared before!”). It’s the Leadership & Culture echo of the skills-atrophy series running in General — the same uncomfortable question viewed through a leadership lens: if the tools do more of the thinking, which cognitive muscles do leaders have to deliberately protect, for themselves and their teams?',
      tags: [{ label: 'Philosophical', variant: 'blue' }],
      dateRange: 'May 7',
    },
    {
      title: 'Caroline’s Leap — A YouTube Channel About Overcoming Fear',
      description:
        'On 21 May Caroline shared something personal: a rebrand and a brand-new YouTube channel, with a first video — fittingly — about overcoming fear. “This is way out of my comfort zone, and somewhat ironically I wasn’t sure whether to post in here because I didn’t want to come across as spammy — yet my first video is about overcoming fear! This is for all you leaders at the frontier, doing hard things.” The channel rallied (Monika Turska, Jessie, Carla — “Liked and subscribed”), and Matt Fitz offered to share it on. Caroline: “I felt a bit vulnerable putting it out there, and appreciate all the support.”',
      tags: [{ label: 'Personal', variant: 'pink' }],
      dateRange: 'May 21–22',
    },
    {
      title: 'Linking Customer Problems to Commercial Opportunity',
      description:
        'Threaded through the commercial-communication conversation, Esin shared a prioritisation framework as a one-pager (8 May) — connecting customer problems to commercial opportunity when planning and prioritising, with a note that “application is simpler in startups than corporates due to the number of people involved.” Ruan Odendaal added the practical primer: “Get them to spend regular time with the commercial teams — actually experiencing how the product is sold and positioned makes a huge difference.” The making-product-commercial theme that defined the month’s Leadership channel.',
      tags: [{ label: 'Practical', variant: 'green' }],
      dateRange: 'May 8',
    },
    {
      title: 'What Are You Listening To?',
      description:
        'A light, connective close on 28–29 May: Caroline asked the channel for podcast recommendations, “product — and otherwise!” The replies — The Knowledge Project with Shane Parrish (Jock Busuttil), Level Up with Ethan Evans and The Skip Podcast for hiring/market (Prachi Garg), and James Engelbert’s own current favourite — a reminder that leadership development in this group happens as much through shared listening as through frameworks.',
      tags: [{ label: 'Community', variant: 'green' }],
      dateRange: 'May 28–29',
    },
  ],
}

const leadershipStats = [
  { label: 'Messages', value: 70 },
  { label: 'Active Members', value: 39 },
  { label: 'Active Days', value: 14 },
  { label: 'New Members', value: '—' },
]

// ── Channel stat grids ───────────────────────────────────────────────────────

function ChannelStats({
  stats,
}: {
  stats: { label: string; value: string | number }[]
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-6">
      {stats.map((s) => (
        <StatCard key={s.label} label={s.label} value={s.value} />
      ))}
    </div>
  )
}

// ── Component ────────────────────────────────────────────────────────────────

export default function May2026() {
  const [scope, setScope] = useState<ChannelScopeValue>({
    mode: 'subset',
    ids: ['ai'],
  })
  const activeId = scope.mode === 'subset' ? scope.ids[0] : 'ai'

  return (
    <div className="space-y-8">
      {/* Aggregate stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {aggregateStats.map((s) => (
          <StatCard key={s.label} label={s.label} value={s.value} />
        ))}
      </div>

      <div className="flex justify-end">
        <ChannelScopePicker
          value={scope}
          onChange={setScope}
          allowMultiSelect={false}
          showAllOption={false}
        />
      </div>

      {activeId === 'ai' && (
        <div className="mt-6">
          <ChannelStats stats={aiStats} />
          <ChannelSection data={aiChannel} />
        </div>
      )}

      {activeId === 'general' && (
        <div className="mt-6">
          <ChannelStats stats={generalStats} />
          <ChannelSection data={generalChannel} />
        </div>
      )}

      {activeId === 'jobs' && (
        <div className="mt-6">
          <ChannelStats stats={jobsStats} />
          <ChannelSection data={jobsChannel} />
        </div>
      )}

      {activeId === 'leadership_culture' && (
        <div className="mt-6">
          <ChannelStats stats={leadershipStats} />
          <ChannelSection data={leadershipChannel} />
        </div>
      )}
    </div>
  )
}
