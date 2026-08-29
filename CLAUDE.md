# Testing

Always use the Makefile to run tests. Do not run `pytest`, `vitest`, or `mypy` directly.

- `make test-backend` — backend pytest (runs in the `test` docker compose profile)
- `make test-frontend` — frontend vitest (installs deps if needed, then `npm run test:run`)
- `make typecheck` — mypy for the backend
- `make check` — all three

# Committing

Other Claude sessions may be editing this same working tree at the same time.

- Never use `git add -A`, `git add .`, or `git commit -a`.
- Stage only the explicit paths you edited this session: `git add path/one.tsx path/two.ts`.
- Before committing, run `git status` and confirm every staged path is one you touched.
- If you see unexpected modified files, leave them alone and mention them rather than committing them.
- Commit as soon as a unit of work lands — uncommitted edits are what get swept into someone else's commit.
