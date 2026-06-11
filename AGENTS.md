# tf-dashboard

Dashboard for LLM backend token usage (OpenCode + DeepSeek official APIs) and server information display.

## Status

**Greenfield.** Single commit (empty README). No tech stack chosen. No code written.

## Purpose

- Display real-time token consumption from two sources:
  - **OpenCode** LLM backend API
  - **DeepSeek official API**
- Display server/VM information (metrics, health, status)

## Available Skills (24)

All in `skills/`. Load on demand via `load_skills=["skill-name"]` when task matches description:

| Skill | For |
|---|---|
| `api-and-interface-design` | REST/GraphQL endpoints, module boundaries, API contracts |
| `frontend-ui-engineering` | UI components, layouts, production-quality frontend |
| `browser-testing-with-devtools` | DOM inspection, console errors, network analysis |
| `ci-cd-and-automation` | Pipeline setup, test runners, deployment |
| `code-review-and-quality` | Pre-merge code review across multiple axes |
| `code-simplification` | Refactoring for clarity without behavior change |
| `context-engineering` | Agent context setup, rules files configuration |
| `debugging-and-error-recovery` | Root-cause debugging |
| `deprecation-and-migration` | Safe removal of old APIs/systems |
| `documentation-and-adrs` | Architecture Decision Records, design docs |
| `doubt-driven-development` | Adversarial review for correctness-critical decisions |
| `git-workflow-and-versioning` | Branching, committing, resolving conflicts |
| `idea-refine` | Vague idea → sharp concept |
| `incremental-implementation` | Multi-file changes delivered in small steps |
| `interview-me` | Extracting requirements via one-question-at-a-time |
| `observability-and-instrumentation` | Logging, metrics, tracing |
| `performance-optimization` | Core Web Vitals, load time, profiling |
| `planning-and-task-breakdown` | Breaking specs into ordered tasks |
| `security-and-hardening` | Auth, input handling, external integrations |
| `shipping-and-launch` | Pre-launch checklist, rollout, rollback |
| `source-driven-development` | Grounding implementation in official docs |
| `spec-driven-development` | Creating specs before coding |
| `test-driven-development` | TDD for logic and bug fixes |
| `using-agent-skills` | Meta-skill for discovering what applies |

## Environment

- **OS**: Linux
- **Node**: v22.22.2, npm 10.9.7
- **Python**: 3.14.5
- **GitHub remote**: `https://github.com/touchfish1/tf-dashboard.git`

## Conventions

- No conventions established yet — this is a greenfield project.
- No linter, formatter, typechecker, or test framework configured.
- No `.gitignore` exists yet.
- User prefers Chinese for requirements; keep code comments and identifiers in English.
- `skills/` directory contains OpenCode skill definitions (`.gitignore`-worthy candidate).

## Architecture Guidance

- Will involve at least two external API integrations (OpenCode + DeepSeek).
- Token usage data likely requires an API key / auth token for each provider.
- Server info display suggests an agent or SSH-based collection mechanism.
- No decisions have been made on: frontend framework, backend framework, data storage, deployment.

## Key Agents

| Agent | When |
|---|---|
| `explore` | Find patterns, search codebase |
| `librarian` | External docs, API references, GitHub examples |
| `oracle` | Architecture decisions, hard debugging |
| `metis` | Pre-planning, scope clarification |
| `momus` | Plan review, quality assurance |
