# Agent Instructions

## Project Overview

This is a React + TypeScript + Vite application for an automotive workshop management system (`ecossistema-automotivo`). The current UI is centered on `Ordens de Serviço` with routes for listing, creating, and viewing service orders.

## Tech Stack

- React 19
- TypeScript
- Vite
- React Router
- Tailwind CSS
- ESLint

## Common Commands

- Install dependencies: `npm install`
- Start development server: `npm run dev`
- Build production bundle: `npm run build`
- Run lint checks: `npm run lint`
- Preview production build: `npm run preview`

## Repository Structure

- `src/App.tsx` defines the main layout, sidebar, and routes.
- `src/pages/os/` contains service-order pages:
  - `OSList.tsx`
  - `OSNew.tsx`
  - `OSDetail.tsx`
- `src/index.css` loads Tailwind layers.
- `src/assets/` contains static assets.

## Working Guidelines

- Follow the existing TypeScript and React component style.
- Prefer Tailwind utility classes for styling.
- Keep route-level pages in `src/pages/`.
- Preserve the dashboard/workshop-management tone: practical, dense, and operational rather than marketing-oriented.
- Use Portuguese for visible UI copy unless the surrounding feature clearly uses another language.
- Keep changes scoped to the requested feature or bug fix.
- Do not remove user changes or generated files unless explicitly asked.

## Validation

Before handing off meaningful code changes, run:

```bash
npm run lint
npm run build
```

If either command cannot be run, explain why and mention any residual risk.
