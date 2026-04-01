---
name: repo-naming
description: >
  This skill should be used when the user asks to "name a new repo", "check if a name is taken",
  "score these repo names", "pick a repo name", "is this name good", "what should I call this",
  "evaluate repo name options", "collision check for a package name", or "choose a name for
  a new project". Runs a structured naming pipeline: collision checks across npm/PyPI/GitHub/
  major products, weighted scoring across five dimensions, TLD guidance, and tier classification
  (standalone noun vs org-prefixed) to produce a ranked shortlist.
version: 0.1.0
---

# Repo Naming

Structured pipeline for evaluating and selecting repository names. Covers collision checks,
weighted scoring, domain TLD guidance, and naming tier classification. Produces a ranked
shortlist with rationale.

## Step 1: Gather Candidates

Ask the user for:

1. The repo's primary purpose (one sentence)
2. The tech stack (language, framework, runtime)
3. The target audience (internal tooling, open-source library, product, infrastructure)
4. Any names they are already considering (zero or more)
5. The owning org or namespace (e.g. `phoenixvc`, personal account, or standalone)

If the user provides names, proceed directly to Step 2. If they have no candidates,
generate 3–5 options based on the purpose before continuing.

---

## Step 2: Collision Check

Run all four collision checks for each candidate. A **hard collision** (existing package or
widely-known product with the same name) disqualifies a name; a **soft collision** (similar
but not identical) is noted as a risk.

| Check              | Where to look                                                             | Hard collision if…                                                    |
| ------------------ | ------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| **npm**            | `https://www.npmjs.com/package/<name>`                                    | Package exists and is actively maintained                             |
| **PyPI**           | `https://pypi.org/project/<name>/`                                        | Package exists and is not abandoned (last release < 3 years ago)      |
| **GitHub**         | `https://github.com/<name>` (org) or `https://github.com/search?q=<name>` | A prominent public repo uses the exact name in the same problem space |
| **Major products** | Mental check against well-known SaaS, cloud services, dev tools           | Name is a registered trademark or widely-recognised product name      |

Record the result for each candidate:

```
<candidate>:
  npm:    CLEAR | SOFT (<detail>) | HARD (<detail>)
  PyPI:   CLEAR | SOFT (<detail>) | HARD (<detail>)
  GitHub: CLEAR | SOFT (<detail>) | HARD (<detail>)
  products: CLEAR | SOFT (<detail>) | HARD (<detail>)
  collision-score: PASS | RISK | DISQUALIFIED
```

Drop any candidate marked **DISQUALIFIED** from further evaluation.

---

## Step 3: Weighted Scoring

Score each surviving candidate across five dimensions. Each dimension is scored 1–5
(5 = best). Apply the weights, sum to produce a weighted total out of 5.

| Dimension               | Weight | Score 1                                              | Score 3                                        | Score 5                                                                           |
| ----------------------- | ------ | ---------------------------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------- |
| **Collision risk**      | 25%    | Multiple soft or one hard collision narrowly avoided | Only soft collisions, none in the same space   | Completely clear across all four checks                                           |
| **Distinctiveness**     | 25%    | Generic word (e.g. `runner`, `agent`, `utils`)       | Memorable but shared by several projects       | Unique, coin-worthy, easy to search for                                           |
| **Semantic fit**        | 20%    | Name gives no hint of purpose                        | Name partially conveys purpose                 | Name immediately communicates what the project does                               |
| **Ecosystem coherence** | 15%    | Clashes with naming conventions in the target stack  | Neutral — fits but doesn't stand out           | Follows conventions naturally (e.g. `-rs` suffix for Rust, `-py` for Python libs) |
| **Longevity**           | 15%    | Trendy term or version-specific (e.g. `gpt4-helper`) | Stable but potentially limiting as scope grows | Timeless; will still make sense in 5 years if the project evolves                 |

Calculate each candidate's weighted score:

```
weighted_score = (collision * 0.25) + (distinctiveness * 0.25) +
                 (semantic_fit * 0.20) + (ecosystem_coherence * 0.15) +
                 (longevity * 0.15)
```

Rank candidates from highest to lowest weighted score.

---

## Step 4: Tier Classification

Classify each surviving candidate into the correct naming tier. The tier determines
the final name shape.

### Standalone Nouns — use for products and public-facing projects

- **When:** End-user products, open-source libraries, SaaS apps, anything with a brand identity
- **Pattern:** A single memorable noun or compound noun, no org prefix
- **Examples:** `retort`, `docket`, `sluice`, `xtox`, `zeeplan`, `pigpro`
- **Rule:** The name should work as a standalone brand — someone should be able to say it in conversation without needing an org qualifier

### Org-Prefixed — use for infrastructure and internal tools

- **When:** Infrastructure modules, internal tooling, CI runners, Azure/cloud bootstraps, IaC repos
- **Pattern:** `<org>-<descriptor>` or `<org>-<project>-<type>`
- **Examples:** `phoenix-runner`, `codeflow-infrastructure`, `codeflow-azure-setup`, `phoenixvc-dev-api-fastapi`
- **Rule:** The org prefix signals "this is a component of a larger system, not a standalone product"

### Ambiguous cases — apply these tie-breakers

| Situation                                              | Recommendation                                                             |
| ------------------------------------------------------ | -------------------------------------------------------------------------- |
| Internal tool that may eventually be open-sourced      | Use standalone noun now; add org prefix only if a name collision forces it |
| Infrastructure repo that belongs to a specific product | Prefer `<product>-infrastructure` over a standalone name                   |
| Monorepo package within a Turborepo or Cargo workspace | Use the workspace naming convention (`@<org>/<package>` for npm)           |
| Personal project with no org affiliation               | Standalone noun is fine; no prefix needed                                  |

Record the recommended tier for each candidate.

---

## Step 5: Domain and TLD Guidance

If the repo is a product that will have a public-facing site, evaluate domain availability
and recommend a TLD strategy.

### TLD preference order

| TLD      | Use when                                                |
| -------- | ------------------------------------------------------- |
| `.dev`   | Developer tools, CLIs, libraries, APIs                  |
| `.io`    | SaaS products, platforms, dashboards                    |
| `.app`   | End-user applications (desktop or mobile)               |
| `.com`   | Consumer products, marketplaces, general-purpose        |
| `.co.za` | South Africa-specific or local-market products          |
| `.ai`    | AI-native products (expect higher cost and speculation) |

### Guidance rules

- Prefer a `.dev` or `.io` domain over `.com` if `.com` is taken — a clean `.dev` beats a hyphenated `.com`
- Avoid hyphens in domains even if the repo name uses them
- Do not register a domain with a trademarked term in the TLD suffix zone (e.g. `<brand>tools.io`)
- For internal tools that will never have a public site, skip domain evaluation entirely

Report: for each product-tier candidate, state the recommended TLD and note if the
obvious domain is likely available (based on name distinctiveness).

---

## Step 6: Shortlist and Recommendation

Present a ranked shortlist of the top 3 candidates (or fewer if some were disqualified).

For each finalist:

```
## <candidate>

**Tier:** standalone | org-prefixed
**Weighted score:** X.XX / 5.00
**Collision status:** PASS | RISK (details)
**Recommended domain:** <name>.<tld> (if applicable)

**Rationale:**
- Collision: <one sentence>
- Distinctiveness: <one sentence>
- Semantic fit: <one sentence>
- Ecosystem coherence: <one sentence>
- Longevity: <one sentence>

**Risks / notes:** <any caveats>
```

End with a single bold recommendation:

> **Recommended name:** `<name>` — <one sentence reason>

If the top two candidates are within 0.2 weighted score of each other, present both
and let the user decide rather than forcing a single recommendation.

---

## Quick Reference — Scoring Matrix

| Dimension           | Weight | Key question                                |
| ------------------- | ------ | ------------------------------------------- |
| Collision risk      | 25%    | Is anything out there with this exact name? |
| Distinctiveness     | 25%    | Will someone remember it after one mention? |
| Semantic fit        | 20%    | Does the name hint at what it does?         |
| Ecosystem coherence | 15%    | Does it feel native to the target stack?    |
| Longevity           | 15%    | Will this still make sense in five years?   |

## Additional Resources

- **`references/naming-patterns.md`** — Naming examples by project category (if created)
- **[npmjs.com](https://www.npmjs.com)** — npm package registry search
- **[pypi.org](https://pypi.org)** — PyPI package index search
- **[github.com/search](https://github.com/search)** — GitHub repo search
