# Repository Guidelines

## Project Structure & Module Organization
This is a Vite + React + TypeScript app with a feature-based layout.
- `src/app`: App shell, providers, routing.
- `src/features`: Feature modules (UI + model per feature).
- `src/shared`: Shared UI, hooks, types, and styles.
- `src/assets`: Static app assets.
- `public`: Static files served as-is.

## Build, Test, and Development Commands
Use `pnpm` as the package manager.
- `pnpm dev`: Start the Vite dev server.
- `pnpm build`: Type-check with `tsc -b` and create a production build.
- `pnpm build-nocheck`: Build without TypeScript checks.
- `pnpm lint`: Run ESLint on the codebase.
- `pnpm preview`: Preview the production build locally.

## Coding Style & Naming Conventions
- Indentation: 2 spaces.
- Quotes: double quotes (match existing files).
- Semicolons: required.
- File naming: `PascalCase` for React components (e.g., `HeaderSection.tsx`), `camelCase` for utility modules.
- Linting: ESLint with TypeScript + React Hooks rules (`eslint.config.js`).
- Styling: Tailwind CSS for utility classes and MUI for component primitives. Prefer consistent tokens/variants within a feature.

## Testing Guidelines
Testing libraries (`vitest`, `@testing-library/react`) are installed, but no test scripts or suites are currently defined. If adding tests, use:
- Naming: `*.test.ts(x)` or `*.spec.ts(x)`.
- Suggested command: `pnpm vitest` (add a script if needed).
- Keep tests close to features under `src/features/<Feature>/__tests__`.

## Commit & Pull Request Guidelines
Recent history follows Conventional Commit-style prefixes:
`feat:`, `fix:`, `refactor:`, plus occasional merges. Keep messages short and scoped (e.g., `feat: add room playlist badges`).

PRs should include:
- A clear summary of the change and rationale.
- Linked issue/task if available.
- Screenshots or GIFs for UI changes (especially in `src/features`).

## Configuration & Environment
Environment variables live in `.env`. Avoid committing secrets; document any new required keys in `README.md`.
