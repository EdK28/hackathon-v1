# Clarify

**An AI requirements assistant that turns vague client requests into clear, signed-off project briefs.**

Clients often say things like *"make the homepage more modern and user friendly, like Shopee, ASAP"*. Developers then guess, build, and redo. Clarify sits in the **Planning & Analysis** stage of the SDLC: it interviews the client with a short chat, chases every vague word, and produces a brief with testable user stories that the client approves before any work starts.

## How it works

1. **Developer creates a brief.** Pick the request type (new feature, redesign, new site, change/bug) and paste the client's original message.
2. **Client gets a link** (copy it or share it to WhatsApp). No login needed; it works on a phone.
3. **The assistant interviews them**, one question at a time:
   - **Tap-to-answer options** instead of blank boxes (clients can still type their own answer).
   - **Vague words get followed up** with concrete choices: "modern", "simple", "user-friendly", "fast", "like &lt;site&gt;", "ASAP", "everything"…
   - **Thin answers** ("website not nice") get a request for a real example.
   - **"Not sure"** is allowed: it becomes an open question instead of blocking the client.
   - **Contradictions** (e.g. 5 must-haves in 2 weeks) and **assumptions** are flagged for the developer.
4. **A rough wireframe is drawn** as soon as the interview ends: grey-box layouts of each page the client picked, with phone/desktop views. Numbered notes link each part to what the client said (e.g. "Fits these models → solves: customers order parts for the wrong bike"). It's stored as data (screens → blocks), not generated HTML, so it's safe to render, versioned with the brief and included in the Markdown export. The developer can regenerate it from the Wireframe tab.
5. **Developer reviews** the brief (summary, agreed requirements, clarified words, user stories with acceptance criteria, risks), edits it if needed, and can ask the client extra questions.
6. **The chat stays open.** The sketch is posted in the client's chat. They tap **👍 Looks right** or just type what to change ("add a Compare button next to Add to cart", "move the photos above the price", "I don't need the account page"). Layout requests update the sketch immediately and the new version is posted in the chat (older ones collapse). Anything that isn't layout ("make it blue") is passed to the developer. The developer can also type a change on the Wireframe tab, or press **Apply client changes** to retry requests that weren't applied.
7. **Client approves.** They check the brief and sketch; if something's still off they can request changes there too. Otherwise they approve a frozen version with their name. If the developer changes anything afterwards, Clarify shows exactly what changed against the signed version and asks for a new approval.
8. **Export** as Markdown (paste into GitHub/Jira/Notion) or print to PDF.

## AI engines

| Engine | When | Notes |
| --- | --- | --- |
| **Claude** | `ANTHROPIC_API_KEY` set | Each turn returns JSON guaranteed to match a schema ([Structured Outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs), `output_config.format`). Writes natural follow-ups, user stories and risks. Model set by `ANTHROPIC_MODEL`. |
| **Offline** | No key (default) | Rule-based: same checklist, vague-word follow-ups, contradiction rules. Free and predictable, which makes it good for demos and tests, but its wording is formulaic. |

If a Claude call fails, that turn falls back to the offline engine automatically, so the client is never stuck.

> The Claude path is tested against a fake API server (request shape and response handling), not yet against the live API. Run one real interview with your own key before relying on it.

## Quick start

Requirements: Node 22+, MongoDB as a replica set (MongoDB Atlas is easiest; the same cluster as the shop works, just use the database name `clarify`).

```bash
npm install
cp apps/api/.env.example apps/api/.env     # set MONGO_URI, JWT_SECRET, optionally ANTHROPIC_API_KEY
npm run seed                               # demo data (wipes the clarify database)
npm run dev                                # API :4100, web :3100
```

Open http://localhost:3100 and log in with **dev@demo.local / Clarify123!**. The seed creates three example briefs: one mid-interview, one ready for review, and one signed then changed.

Ports 3100/4100 are used so it can run alongside the Zontes shop (3000/4000).

## Run with Docker

You need [Docker Desktop](https://www.docker.com/products/docker-desktop/). It runs the database, API and website together.

```bash
cp .env.example .env        # Windows: copy .env.example .env
# edit .env: set JWT_SECRET (required) and ANTHROPIC_API_KEY (optional)
docker compose up --build   # first build takes a few minutes
```

Open http://localhost:3100. For the demo account and sample briefs, run this in a second terminal:

```bash
docker compose exec api node src/seed/seed.js
```

| What | Command |
| --- | --- |
| Stop | `Ctrl+C`, or `docker compose down` |
| Start again (no rebuild) | `docker compose up` |
| Rebuild after code changes | `docker compose up --build` |
| See API logs | `docker compose logs -f api` |
| Wipe the database | `docker compose down -v` |

The bundled MongoDB runs as a one-node replica set (needed for transactions) and keeps its data in a Docker volume. To use Atlas instead, set `MONGO_URI` in `.env`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | API (watch mode) + Next.js dev server |
| `npm run seed` | Demo developer and three sample briefs |
| `npm test` | API tests: a simulated vague client, sign-off/change control, access control, Claude request shape, Claude fallback |

## Project layout

```
apps/api/src
  services/templates.js       checklists per request type (questions, options, what a good answer looks like)
  services/vague.js           vague-word dictionary with follow-up questions
  services/engine-offline.js  rule-based interviewer
  services/engine-claude.js   Claude interviewer (structured JSON output)
  services/briefs.js          conversation flow, sign-off, versions, change diff, Markdown export
  routes/projects.js          developer API (login required)
  routes/client.js            client API (secret link token, no login)
apps/web/app
  b/[token]                   client chat + brief approval (mobile-first)
  (dev)/projects              developer dashboard, new brief, brief review
```

## Privacy (PDPA)

Client answers are stored in your database and, when Claude is enabled, sent to the Anthropic API to generate questions and the brief. Tell clients this, avoid collecting sensitive personal data in briefs, and delete projects you no longer need.

## Ideas for next steps

- Clients attach screenshots and the AI describes what's in them
- Bahasa Malaysia interview mode
- Email/WhatsApp notification when the client finishes or approves
- Rough effort estimate per user story (for the developer only, never shown to the client)
- Push approved stories to GitHub Issues / Jira
