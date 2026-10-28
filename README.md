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
layouts are easier to review. If a category or role with a
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

### Generated key normalization

The builder allocates internal keys in code before validating or displaying plans.
Keys are globally unique lowercase snake_case, start with a letter, and are capped
at 32 characters. Role keys use `role_`; channel keys start with their category key
(e.g. `community_general`, `information_welcome`). Numeric suffixes resolve
collisions, including after truncation. Display names are kept separate and unchanged.

Original role/category keys and unambiguous display-name aliases are mapped to the
new identifiers. Visibility, posting, voice access and parent-category references
are rewritten together. Normalizing an already-normalized plan is idempotent.
Same-named channels in different categories are preserved and built separately.
Unknown or genuinely ambiguous references are rejected with a targeted error,
not guessed, broadened to everyone, or silently discarded. No object is removed
to make its keys pass validation. Permission and approval checks still apply.

## Per-server economy

Every server has separate accounts, inventory, shop, jobs, rewards, cooldowns and
settings. The default currency is **💵 dollar**. Balances start at zero. This is
fictional game currency: no purchases with real money, withdrawals to real money,
or cross-server transfers. Economy features do not require an AI API key.

### Member commands

- `/balance [user]`, `/profile [user]`: wallet, bank, reserved/available bank funds,
  guard count, work boost, streak, today's earnings and lifetime quiz earnings.
- `/daily`: reward and capped streak bonus.
- `/jobs`, `/work [job]`: browse jobs and work; autocomplete chooses a job. Work
  uses one shared cooldown per member, so switching jobs cannot bypass it.
- `/deposit amount`, `/withdraw amount`: move funds between wallet and bank.
- `/pay user amount`: wallet transfer with an explicit confirmation, expiring in
  two minutes. Funds are checked again on confirmation.
- `/shop`, `/buy item [quantity]`, `/inventory`, `/use item`: paginated shop and
  inventory with autocomplete. Prices are charged to the wallet.
- `/crime`: a configurable reward chance, or a wallet fine on failure. You must
  be able to cover the potential fine before trying.
- `/rob wallet user`, `/rob bank user`: robbery rules below. Targets must be
  human members of the same server; self-robbery is not allowed.
- `/richest [type]`: total wealth or quiz earnings within this server.
- `/transactions`: your wallet/bank transaction history.

### Administration

`/economy config` opens interactive menus, buttons and forms. Server owners and
members with the **Administrator** permission can configure:

- Currency name and emoji.
- Daily reward, streak bonus, maximum bonus streak and cooldown.
- Total daily earning cap and the additional quiz earning cap.
- Per-correct-answer reward, first/second/third bonuses and podium minimum players.
- Jobs: add/edit names, minimum/maximum pay, cooldown and enabled state.
- Shop: create/edit item names, emojis, descriptions, prices and supported effects;
  disable/re-enable sales. Maximum 25 jobs and 50 items per server.
- Wallet/bank robbery percentages, fines, minimum attacker balances and cooldowns.
- Crime payout range, fine, success chance and cooldown.
- Administrator logs of configuration and balance changes.

`/set balance user account amount` sets **wallet or bank** explicitly. It cannot
reduce a bank below funds currently reserved for a robbery. Permissions are
rechecked on form submissions; the bot owner ID does not grant server economy
administration powers. Names/descriptions do not execute code or assign roles.

All amounts are nonnegative whole numbers, with a maximum wallet/bank balance of
1,000,000,000,000. Cooldowns are entered in seconds (10–604,800). Daily earning
limits reset at midnight **Africa/Lagos**. They apply to minted daily, work, crime
and quiz rewards; transfers and robbery proceeds move existing money and are not
counted as minted earnings. A payout can be reduced to the remaining daily limit.

### Initial defaults (editable by each server)

| Setting | Default |
| --- | --- |
| Currency | 💵 dollar |
| Daily | 250; +25 per consecutive claim day, capped at day 7; 24-hour cooldown |
| Courier job | 50–150; 30-minute cooldown |
| Developer job | 100–250; 1-hour cooldown |
| Total daily earned cap | 10,000 |
| Daily quiz earned cap | 2,000 |
| Quiz answer reward | 10 per correct answer |
| Quiz podium bonuses | 150 / 100 / 50; minimum 3 participants |
| Crime | 60% success; 100–300 reward; 100 failure fine; 1-hour cooldown |
| Wallet robbery | 5%–15% theft; 10% guard fine; 100 minimum attacker wallet; 1-hour cooldown |
| Bank robbery | 10%–30% total theft; 20% panic fine; 100 minimum robber bank; 6-hour cooldown |
| Security Guard | 500 each; maximum five guards held |
| Double Shift | 150; +100% on the next work reward after `/use` |
| Golden Ticket | 1,000; collectible |

### Security Guards and custom items

A Security Guard automatically blocks one attempted wallet robbery. The attacker
pays the configured percentage of their current wallet to the victim, and exactly
one guard is consumed. All custom guard items count toward the same five-guard
limit. Without a guard, wallet theft succeeds for a random configured percentage
of the victim's current wallet. Bank robbery is not blocked by guards.

Custom items support three effects: **guard**, **boost** and **collectible**. Boosts
increase the next work payout by 1–500% and must be activated with `/use`; only one
boost can be active at once. Daily caps still apply. Collectibles remain in the
inventory. Disabling sales does not remove owned items. An item's effect/strength
cannot be changed while members own it; create a new item for a different effect.
Name, description and price remain editable. New effect types require code changes.

### Bank robberies and the private panic button

The starter opens a public message in the current channel, mentioning the victim.
The victim must be able to see that channel and its message history. The countdown
is 30 seconds, starting when the message is posted. Up to ten robbers, including
the starter, can join. Each member can be involved in only one active bank robbery
per server, as either victim or robber.

Joining reserves the configured fine percentage of **that robber's bank balance
at joining**. Reserved money still appears in the bank total, but cannot be
withdrawn or removed using `/set balance`. Other bank funds remain available.
Depositing more after joining does not increase the already-reserved fine.

Only the targeted victim can press **Panic**. The press is recorded before network
acknowledgement and receives an ephemeral reply. It never edits the shared message
or reveals the panic state during the countdown. Other robbers may still join.
At the deadline:

- **Panic pressed:** each robber's reserved fine transfers to the victim's bank.
  By default this is 20% of each robber's individual starting bank balance.
- **No panic:** the robbery succeeds. A random whole percentage from 10 through
  30 (by default) is taken from the victim's **bank at resolution**, once total,
  and split equally among the crew. Integer remainders go in join order, differing
  by at most one dollar. Robbers receive the proceeds in their banks and their
  fine holds are released. If the victim has withdrawn everything, the take is zero.

No additional random failure chance is applied. A deleted/unavailable robbery
message, unavailable victim, or a bot restart cancels the pending robbery with all
holds and robbery cooldowns released; no financial outcome is guessed while the
victim cannot interact. A settlement that would exceed a balance limit similarly
cancels atomically. Completed money transfers are never replayed. Undelivered
outcome messages can be retried on the next startup.

### Quiz integration and persistence

New quizzes snapshot their currency/reward/cap configuration when started.
Normally completed quizzes pay answer rewards plus podium bonuses, subject to the
snapshot caps and the participant's earnings that day. Podium rewards require the
configured number of participants and at least one correct answer. Existing quiz
ranking applies: score, then accuracy; exact ties share rank and receive that
rank's bonus. Rewards are shown beside each participant's final results.
Cancelled, failed and interrupted quizzes pay nothing. Pre-economy historical
quizzes are not paid retroactively. The original quiz score leaderboard remains;
`/richest type:Quiz earnings` is the separate money ranking. Currency display uses
the server's current name/emoji if an administrator renames it later.

Economy tables share the existing SQLite database. Balance moves, purchases,
rewards, holds and settlements run in transactions. Interaction IDs and unique
quiz reward rows prevent duplicate credits. Configuration changes and balance
adjustments have administrator logs; financial changes have member ledger entries.
The economy is local to each server, with no shared wallet or bank across servers.

### Deployment and validation

Pull `main` and restart using the existing Node 24 startup. No new packages, API
keys or privileged intents are needed. New slash commands register automatically.
Keep the existing `DATA_DIR` persistent. Back up SQLite safely before upgrades;
run only one bot process per database.

Automated tests use real SQLite and mocked Discord interactions/timers. They cover
server isolation, payouts/cooldowns/caps, shop effects, admin checks, transfer
confirmation and replay protection, escrow spending prevention, ten-person bank
fines, successful split theft, private panic handling, interrupted recovery,
exactly-once quiz payouts, menu payloads and command registration. Live Discord
permissions and notifications still need a smoke test after deployment. Start
with `/economy config`, `/daily`, `/balance`, and a two-account test robbery.
