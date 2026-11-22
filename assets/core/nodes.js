// Real job list, snapshot of the owner's system map on 22 Nov 2026 (core-nodes.real.json; Library Booking and Opportunity Scout left out of the public list on the owner's decision).
// state is the configured state only: "scheduled" or "paused". Nothing here is live.
export default {"snapshot":"2026-11-22","groups":[
{"key":"study","label":"Study"},
{"key":"system","label":"System"},
{"key":"publishing","label":"Publishing"},
{"key":"knowledge","label":"Knowledge"},
{"key":"income","label":"Income"}],
"nodes":[
{"id":"study-sync","name":"Study Sync","group":"study","schedule":"hourly","runsOn":"launchd","does":"Pulls course files and deadlines into the notes vault.","state":"scheduled"},
{"id":"exam-flashcards","name":"Exam Flashcards","group":"study","schedule":"on demand","runsOn":"launchd","does":"Spaced-repetition flashcards delivered through chat.","state":"scheduled"},
{"id":"health-check","name":"Health Check","group":"system","schedule":"hourly","runsOn":"launchd","does":"Checks that every automation is running and reports problems.","state":"scheduled"},
{"id":"self-improver","name":"Self Improver","group":"system","schedule":"03:15 daily","runsOn":"launchd","does":"Proposes small code and note improvements overnight for review.","state":"scheduled"},
{"id":"vault-backup","name":"Vault Backup","group":"system","schedule":"02:30 daily","runsOn":"launchd","does":"Backs up the notes vault to a private repository.","state":"scheduled"},
{"id":"price-watch","name":"Price Watch","group":"system","schedule":"daily","runsOn":"cron","does":"Tracks a product price and sends a daily report.","state":"scheduled"},
{"id":"agent-dashboard","name":"Agent Dashboard","group":"system","schedule":"on demand","runsOn":"manual","does":"Local office-style view of all agents and their status.","state":"scheduled"},
{"id":"overnight-task","name":"Overnight Task","group":"system","schedule":"on demand","runsOn":"manual","does":"Works one assigned task overnight on a separate branch.","state":"scheduled"},
{"id":"social-scheduler","name":"Social Scheduler","group":"publishing","schedule":"always on","runsOn":"launchd","does":"Queues posts for approval and summarises engagement.","state":"scheduled"},
{"id":"release-selector","name":"Release Selector","group":"publishing","schedule":"23:15 daily","runsOn":"launchd","does":"Checks the next project's readiness for public release.","state":"scheduled"},
{"id":"release-runner","name":"Release Runner","group":"publishing","schedule":"every 10 minutes","runsOn":"launchd","does":"Handles approved releases; real publishing stays switched off.","state":"scheduled"},
{"id":"signal-tracker","name":"Signal Tracker","group":"publishing","schedule":"daily","runsOn":"launchd","does":"Measures stars, downloads and reach of released projects.","state":"scheduled"},
{"id":"story-pack","name":"Story Pack","group":"publishing","schedule":"on demand","runsOn":"manual","does":"Drafts a project write-up and social notes from its repository.","state":"scheduled"},
{"id":"morning-digest","name":"Morning Digest","group":"knowledge","schedule":"hourly","runsOn":"launchd","does":"Builds a summary of tasks, approvals and overnight results.","state":"scheduled"},
{"id":"inbox-router","name":"Inbox Router","group":"knowledge","schedule":"every 60 seconds","runsOn":"launchd","does":"Sorts captured messages into notes and idea drafts.","state":"scheduled"},
{"id":"idea-verifier","name":"Idea Verifier","group":"knowledge","schedule":"Sun 21:00","runsOn":"launchd","does":"Fact-checks flagged notes against web sources weekly.","state":"scheduled"},
{"id":"vault-indexer","name":"Vault Indexer","group":"knowledge","schedule":"hourly","runsOn":"launchd","does":"Rebuilds search and code-map indexes for the notes.","state":"scheduled"},
{"id":"vault-map","name":"Vault Map","group":"knowledge","schedule":"hourly","runsOn":"launchd","does":"Generates hub pages for agents, courses and research.","state":"scheduled"},
{"id":"archive-fetcher","name":"Archive Fetcher","group":"knowledge","schedule":"always on","runsOn":"manual","does":"Downloads archived forum threads into a local database.","state":"scheduled"},
{"id":"idea-radar","name":"Idea Radar","group":"income","schedule":"22:00 daily","runsOn":"launchd","does":"Scans public forums for product ideas and scores them.","state":"scheduled"},
]}
;
