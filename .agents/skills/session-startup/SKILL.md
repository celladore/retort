---
name: session-startup
description: Run at the start of every session. Orients the agent and user — returns recent context, roadmap status, and session tips for returning users; runs full onboarding for new users.
---

# Session Startup Protocol

Run this skill at the beginning of every session before doing anything else.

## Detection: New vs Returning User

1. Check `.agents/users/{user-id}.yaml` — if it exists, the user is **returning**
2. Check `.agents/history/` — if empty or absent, likely a **new session/repo**
3. Check for the most recent trace in `.agents/traces/` — if none exist, treat as new
4. If uncertain, ask: "Is this your first time working in this repo?"

---

## For RETURNING Users

### 1. Load User Profile

Read `.agents/users/{user-id}.yaml` — recall:

- communication preferences
- expertise areas
- tool preferences
- session history summary

### 2. Read Last Handover

Read the most recent file in `.agents/traces/` matching `YYYY-MM-DD-handover-*.md`.
Extract:

- date and one-line summary
- current branch + pending work
- any unresolved blockers

### 3. Orient to Repo State

```bash
git status
git branch --list
```

### 4. Check Roadmap Status

Scan `~/.roadmaps/` — for each active roadmap, find the highest-priority incomplete task.

### 5. Present Session Brief

Output to the user:

```
Welcome back, {name}. Last session: {date} — {one-line summary from trace}

Current branch:     {branch}
Open roadmaps:      {N} active
Top priority:       {first item from highest-priority roadmap}

Session tips:
- {tip 1 from user prefs / observed patterns}
- {tip 2}

Ready. What would you like to work on?
```

---

## For NEW Users

### 1. Introduce the Repo

"I'm your AI coding assistant for Mystira.workspace — an AI-powered interactive
storytelling platform combining blockchain, generative AI, and immersive narratives."

Read `.agents/instructions/new-user-onboarding.yaml` for the full onboarding script.

### 2. Request Identity

Ask the user to identify themselves:
"What's your name or GitHub handle? I can save your preferences to make future
sessions more efficient. (You can opt out at any time.)"

### 3. Present Exploration Options

```
What would you like to do?

A) Explore the repo architecture (what this project does, how it's structured)
B) Look at a specific feature area (UI, authentication, agent infrastructure, etc.)
C) See the active roadmap and outstanding work
D) Get oriented on the agent/AI tooling setup
E) Just tell me what you want to do
```

### 4. Dispatch Discovery Agents

Based on their choice, dispatch agents per `.agents/instructions/skill-discovery.md`.

### 5. Save User Profile

After orientation (with explicit permission):
Create `.agents/users/{handle}.yaml` — see `.agents/users/README.md` for format.

---

## Always (Both User Types)

- If any guard in `.agents/guards/` is relevant to today's planned work, surface it
- If `.agents/history/` has an unresolved task from a prior session, flag it
- Do NOT claim knowledge of files/code you haven't read in this session
