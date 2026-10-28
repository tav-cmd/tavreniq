# TAVRENIQ

A Discord moderation bot with Gemini AI chat. One Node.js service; no website or separate database service. Source code is included. Hosting, Discord credentials and a Gemini API key are required before it can go online. The name has not received trademark clearance.

## Quick start on Railway

1. Extract this ZIP. Create a GitHub repository and upload the **contents of the tavreniq folder** so `package.json`, `Dockerfile`, `railway.json` and `src` are at the repository root. Include `package-lock.json`. Never upload `.env` or your tokens.
2. At https://discord.com/developers/applications create an application named TAVRENIQ. Open **Bot**, obtain/reset its token and enable **Message Content Intent**. This is required for wake words and message replies. The bot does not request Server Members or Presence intents.
3. Create one Railway service from the GitHub repository. The included Dockerfile installs dependencies and Railway starts `npm start`. Use **one replica**.
4. Add these Railway variables:

| Variable | Value |
| --- | --- |
| `DISCORD_TOKEN` | The bot token from Discord |
| `GEMINI_API_KEY` | API key from https://aistudio.google.com/apikey |
| `GEMINI_MODEL` | A text model available to your Google API project; default `gemini-2.5-flash` |
| `DATA_DIR` | `/data` |
| `BOT_OWNER_NAME` | Your desired owner attribution; default `Hitman` |
| `DISCORD_GUILD_ID` | Optional server ID for immediate testing; omit for global commands |

5. Attach a Railway **volume mounted at `/data`** to this service. Warning and moderation audit records are stored there in SQLite. Without a persistent volume, redeploys can lose records. No PostgreSQL or Redis service is needed. Do not enable service sleeping if you need the bot online continuously. Paid hosting/API usage may be necessary.
6. In Discord's OAuth2 URL Generator select `bot` and `applications.commands`. Request View Channels, Send Messages, Read Message History, Moderate Members, Kick Members, Ban Members, Manage Messages, and Manage Roles. Open the generated invite link and add the bot to your server. Administrator is not required.
7. In Server Settings → Roles, put TAVRENIQ **above the roles it must moderate or assign**. Ensure channel overrides allow it to view and send messages. Test `/ping`, `/help`, `/ask`, and a timeout on a consenting test account below your role.

Commands register automatically on startup. Global commands may need time to appear; use `DISCORD_GUILD_ID` while testing. Remove that variable when deploying global commands; Discord's separate test-server registrations can be removed with its API if duplicate commands remain. `DISCORD_CLIENT_ID` is only needed for manual `npm run register`.

## Commands

| Command | Purpose |
| --- | --- |
| `/help` | Command list and privacy notice |
| `/ping` | Bot connection latency |
| `/invite` | Invite URL |
| `/ask message` | Private (ephemeral) Gemini response |
| `/forget` | Clear your public and private AI memory in this channel |
| `/warn user reason` | Save a warning |
| `/warnings user` | Show last 10 warnings for a member |
| `/timeout user duration reason` | Timeout from 1 second to 28 days |
| `/untimeout user reason` | Remove timeout |
| `/kick user reason` | Kick a member |
| `/ban user reason` | Ban a member without deleting message history |
| `/unban user_id reason` | Unban by Discord ID |
| `/purge count` | Delete up to 100 recent messages; skip messages older than 14 days |
| `/role user role action reason` | Add/remove a non-administrative role |

All slash command responses are private to the requester. Text-command results are public in the channel. Warnings do not automatically DM the target.

## AI chat and text moderation

Mention the bot at the beginning of a message, start with `Tavreniq` or `Tav`, or reply directly to one of its messages:

```text
Tav hello
Tavreniq explain how Discord roles work
Tav timeout @member 10m Spamming
Tav warn @member Repeated advertising
Tav kick @member Breaking server rules
Tav ban @member Repeated serious violations
Tav untimeout @member
```

Use an actual Discord mention, not a typed username. Natural-language support deliberately uses these explicit patterns. Free-form AI responses cannot execute moderation. The model has no moderation tool, and telling it to ignore permissions cannot grant permissions.

AI has a typing indicator, 5-second per-user cooldown, up to five simultaneous requests, a 45-second request timeout, and up to six conversation turns of memory. Memory is separate by server, channel, user and public/private mode. It expires after 30 minutes of inactivity, on restart, or with `/forget`. If a request is in progress, wait before clearing memory.

Only messages you send to AI, its conversation history, and your display/server names go to Google Gemini. It does not read the channel's general history, inspect attachments, browse the web or know every member's private information. Do not send secrets. Server moderation warnings/audit records remain in the SQLite volume until the operator removes them; establish a retention policy for your community and back up the volume as appropriate.

## Permission rules

Every moderation request fetches the executor and bot membership again and checks Discord permissions. Member actions also enforce the executor's and bot's role hierarchy, including protection for the server owner, the executor and the bot. Administrators do not bypass role hierarchy; the server owner bypasses only the executor comparison, never the bot's Discord limitations. `BOT_OWNER_NAME` is attribution only and grants no privileges.

Role commands reject integration-managed roles, @everyone and privileged roles. Assign administrative/moderation roles manually in Discord. Ban/kick are immediate once an authorized command is issued. There is no mass-ban or server-destruction command.

## Local development

Install Node.js 24 LTS, then:

```sh
npm ci
cp .env.example .env
# Fill .env in your editor (Windows: copy .env.example .env)
npm test
npm run check
npm start
```

The app uses Node's built-in SQLite module (some Node versions print an experimental warning). No TypeScript compilation or native npm database build is required. `/api/healthz` reports HTTP 200 only after Discord connects and commands register; otherwise 503. Railway uses this endpoint for deployment readiness. A successful build is not a guarantee of continuous availability; credentials, network, quotas and host availability still matter.

## Troubleshooting

- **Token/login failure:** reset the bot token and replace `DISCORD_TOKEN`. Never put tokens in chat, screenshots or GitHub.
- **Disallowed intents:** enable Message Content Intent in the Discord developer portal. Verified apps may need Discord approval.
- **Slash commands absent:** confirm the invite includes `applications.commands`, check the service logs and verify `DISCORD_GUILD_ID` if set.
- **Missing permissions:** inspect both server roles and channel overrides. Move the bot role above the target. Discord prevents timeouts for administrators.
- **AI unavailable / quota reached:** check the Gemini API key, project quota/billing and model availability. Set `GEMINI_MODEL` to an available model and restart the service.
- **Lost warning data:** verify the volume is attached at `/data` and `DATA_DIR=/data`.

## Validation

The included tests cover duration validation, hierarchy protections, exact text command parsing, slash-command schema ordering, and moderation authorization. Installation and local checks do not replace a live Discord/Gemini smoke test after you supply credentials.

References: https://discord.js.org/docs/packages/discord.js/14.27.0 • https://docs.discord.com/developers/topics/gateway • https://ai.google.dev/api/generate-content


## Multiplayer quiz

TAVRENIQ includes exactly **150 built-in questions**, ten each in 15 topics. No AI
key, extra dependency, privileged member intent, or manual question entry is needed.
Existing moderation, AI, tagging and custom presence remain available.

### Commands

- `/quiz start number_of_questions:10` — start immediately; choose 1–150.
- `/quiz questions` — view the bank size and instructions.
- `/quiz leaderboard` — server-wide lifetime totals from completed quizzes.
- `/quiz stop` — cancel; available to the starter or a member with Moderate Members
  or Manage Server (including administrators).
- `/quiz results` — retrieve the latest finished quiz in this channel, even after
  restart or if Discord could not receive the original results message.

Click A/B/C/D to join; no lobby or category selection. Each user submits once per
question. Both questions and answer choices are shuffled using cryptographic
randomness, without repeating a question in a session. Separate channels and
servers have independent sessions, with one active session per channel.

### Scoring and privacy

Correct = 1 point; incorrect or missed = 0. A participant is someone who submits
at least one answer. Late joiners can play immediately; earlier questions count
as unanswered. Accuracy is correct / answered, not correct / questions played.
Rank by score, then unrounded accuracy. Equal score and accuracy share competition
rank (1, 1, 3); user ID orders tied rows consistently without changing their rank.

Answer clicks receive **ephemeral feedback only**. Shared buttons never reveal a
correct option or a player's choice, even when disabled. Answers are checked on
the server. Review becomes available only after the whole session ends and shows
question answer keys, never another player's selected choices. Results display
score, answered/correct/incorrect/unanswered counts and accuracy, eight players
per page. Reviews show one question per page. Pagination opens privately.

### Hosting and persistence

1. Pull the latest `main` and restart. Bot-Hosting's **Auto-pull at restart** can do
   this. Entry file remains `src/index.js`; use Node 24 (minimum 22.13).
2. Allow View Channel, Send Messages and Embed Links in quiz channels. Threads
   also need Send Messages in Threads. Read Message History lets the bot remove
   expired buttons after restart.
3. Slash commands register automatically at startup. No extra tokens are needed.
4. Optional `QUIZ_SECONDS=20` sets 5–120 seconds per question. Restart to apply.
5. Keep `DATA_DIR` persistent and back up `tavreniq.sqlite` using a SQLite-aware
   backup or while the bot is stopped (WAL files matter during live copies).

Quizzes use the existing SQLite database, with new `quiz_sessions` and
`quiz_answers` tables. A database uniqueness constraint prevents duplicate
answers and overlapping sessions. Each accepted answer is saved before feedback.
Completed status and leaderboard eligibility are committed before public results
are sent. Cancelled, failed and interrupted sessions retain partial results but
never count toward leaderboards. The in-progress question counts as played once
its buttons have been activated. Unopened questions do not count.

On restart, previously active quizzes are marked **Interrupted by restart** and
receive a notice where channel permissions allow. They do not resume. Old answer
buttons are rejected; historical result/review buttons keep working. Run one bot
process per database; do not run multiple replicas sharing this SQLite file.
Discord.js manages REST rate-limit queues and retries. Interaction acknowledgements
are sent before network work; long quizzes use channel messages rather than
expiring slash-command tokens. If a channel disappears or sends fail, the quiz is
stopped, its partial records retained, and its timer cleaned up.

### Verification

Run `npm ci`, `npm run check`, and `npm test` on Node 24. Automated tests use real
SQLite databases and mocked Discord interactions/time. They cover 1/10/50/150
questions, concurrent players, duplicate submissions, private-only feedback,
late joins, scoring/ties, isolation, cancellation, timers, persistence/restarts,
expired interactions, permission/API failures, embed pagination and slash-command
payloads. These tests do not make live Discord calls.

After deploying, run `/quiz questions`, then `/quiz start number_of_questions:1`
with two human accounts. Confirm each account sees only its own feedback, wait
for results, open Review answers, and check `/quiz leaderboard`. The console
should report command registration and `TAVRENIQ online`.

## Natural quiz commands and owner mentions

Only the server owner or members with Discord's **Administrator** permission may
start quizzes, via slash commands or text. Manage Server or Moderate Members alone
does not allow starting. Everyone can still answer questions.

- `Tav start a quiz 2 questions`
- `Tav begin a quiz with 10 questions`
- `Tav start a quiz` → the bot asks how many; the same administrator replies with
  `2` or `2 questions` in the same channel within two minutes. `cancel` cancels setup.

Permissions are fetched again before starting, including after follow-up replies.
Quiz setup waits are scoped to user, channel and server and expire on restart.

Set `BOT_OWNER_ID` to the bot owner's Discord user ID and `BOT_OWNER_NAME` to the
owner's display name. These settings do not grant server permissions. Questions
such as `Tav who is your owner?`, `Tav who created you?` and `/ask` with an owner
question bypass AI and mention only that configured account if it is a current
server member. Without an ID, the bot explains that owner tagging is not configured.
If the owner is absent, it gives the name without pinging anyone else.

## Prompt-based server builder

Use `/create server prompt:Create a gaming community with public rules and chat,
private staff channels, staff and member roles, and two voice rooms` or say
`Tav create a server`. The text command asks for your description and accepts the
same user's next message in the same channel for five minutes. Say `cancel` to
cancel that prompt request. Descriptions are sent to the configured Gemini model;
this feature needs `GEMINI_API_KEY`. It does not use or change `/ask` conversation
memory and does not connect to a personal ChatGPT conversation.

The command builds **inside the current server**, not a new Discord guild. It
creates new roles, categories, and ordinary text/voice channels only. It does not
rename the server, assign members to roles, install bots, create forum/stage
channels, configure Community, or modify/delete existing channels and roles.

### Preview and approval

Only the server owner or a member with the actual Administrator permission can
request/approve a build. The bot re-fetches permissions before building and before
each creation. The AI produces data, never executable code. An allowlisted schema
validates names, counts, permission flags, role references, and visibility.

The paginated preview includes every planned role permission, category/channel
visibility, text-posting/voice access, topic and slow mode. **Build** executes the
reviewed plan once. **Change plan** opens a form for a complete revised description
and invalidates the old confirmation. **Cancel** creates nothing. Only the original
requester can use those buttons. Previews expire in ten minutes. Plan requests
have a 30-second per-user/server cooldown and a global concurrency limit of four.

Maximum per plan: 15 new roles, 10 categories, 25 text/voice channels. Smaller
layouts are easier to review. If a same-type channel/category or role with a
planned name already exists, the builder asks for a different name rather than
merging or changing permissions on it. New roles are created in the planned order,
with the highest responsibility first; they remain below the bot's highest role.
No roles are assigned automatically. Assign them in Discord after reviewing the
result. Administrator roles always bypass channel access restrictions.

### Permissions and deployment

Pull `main` and restart; slash commands register at startup. The existing Node 24
startup and database work unchanged. No new package is needed. The updated invite
link requests Manage Channels in addition to the bot's previous permissions.

The bot needs Manage Channels and Manage Roles, plus any permission it is asked
to grant to a role. Channel creation checks View Channel, Read Message History,
Send Messages, Embed Links, Send Messages in Threads, Create Public Threads and
Create Private Threads, and for voice layouts Connect/Speak. The bot must have
permissions it allows or denies in channel overwrites. Place its role above the
roles it will manage. Send Messages/Embed Links are needed in the command channel;
Attach Files allows the detailed report to be attached. The builder reports
missing capabilities before the first creation. Grant only capabilities needed by
your reviewed plan; Administrator is not required for ordinary layouts.

Private visibility is applied atomically when channels are created. Everyone is
denied viewing unless the preview permits everyone; only the named new roles and
the bot get explicit access. Read-only channels deny ordinary-member posting and
thread creation. A person with any allowed role can access the channel; Discord
combines role allows, and administrators bypass overwrites. Voice channel text
chat and new thread creation are disabled by this builder. Existing server-wide
@everyone permissions are preserved.

### Reliability and reports

The existing SQLite database stores plans and build journals in `server_builds`.
One build can run per server. Duplicate Build clicks cannot execute the same plan
twice. Creation calls are sequential and use Discord.js's rate-limit handling.
Each request is journaled before sending and its new object ID saved afterward.
A failure stops subsequent steps; successfully created objects remain in place.
No automatic rollback/deletion or automatic retry of a failed build is performed.

`/create status` retrieves the latest build's status and report of saved object IDs.
A network failure or crash can leave the last request's outcome uncertain. Inspect
that named object in Discord before retrying. On restart, active builds are marked
interrupted, reported when possible, and never replayed automatically. Preview
plans remain usable only until their original expiration. Use one bot process per
database and keep `DATA_DIR` persistent.

Automated tests use real SQLite and mocked Gemini/Discord APIs. They cover schema
validation, permission boundaries, private/read-only overwrites, preview-only
planning, approval, duplicate confirmation, revocation, cancellation/revision,
expired previews, partial failures, restart recovery, pagination and command
registration payloads. No live server creation or Gemini generation was performed
in the development tests. After deployment, first preview a small layout in a test
server, review every page, and approve it to verify your actual hosting permissions.
