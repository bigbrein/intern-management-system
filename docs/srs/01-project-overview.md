# 01 — Project Overview

> **Module purpose:** Establish what MiniHR is, who it's for, and the guardrails that keep the implementation intentionally small. Read this first — every other module assumes this scope.

## 1.1 Project Name

**MiniHR** — Mini Human Resources Management System

## 1.2 Concept

MiniHR is a lightweight HR management platform: a barebones alternative to enterprise HR suites (e.g. SAP SuccessFactors), built for small organizations, teams, departments, or similarly-sized groups (roughly 5–150 people per organization).

It provides basic employee management, scheduling, attendance, leave management, a general request/approval workflow, and notifications — without the configurability, compliance modules, payroll, or workflow-engine complexity of an enterprise HR platform.

## 1.3 Platform Targets

- Web application, mobile-responsive (no native mobile app in the MVP).
- Single Next.js codebase serving all breakpoints — there is no separate mobile client or API-only backend.

## 1.4 Design Priorities (in order)

1. **Speed of development** — ship a working system quickly using managed services, not custom infrastructure.
2. **Maintainability** — a small team (or a single developer, human or AI-assisted) must be able to understand the whole codebase.
3. **Simplicity** — prefer the boring, obvious solution. Every module in this SRS explicitly separates MVP scope from future scope; do not implement future scope early.
4. **Low infrastructure cost** — everything must run comfortably on Vercel's and Supabase's free/hobby tiers for a small organization, scaling to low-cost paid tiers as usage grows.

## 1.5 Explicit Non-Goals for the MVP

These are called out repeatedly across modules, but stated once here as a standing rule: unless a module explicitly says otherwise, **do not build**:

- Payroll, benefits, compensation management, or tax handling.
- Biometric attendance, GPS/geofenced check-in, or facial recognition.
- A workflow/rules engine for approvals (approvals are single-step: reviewer approves or rejects).
- Multi-tenant SaaS billing (the MVP assumes one organization per deployment; see `17-mvp-vs-future.md` for the future multi-tenant path).
- A native mobile app.
- Complex org-chart / multi-level approval chains.
- A separate backend service (Express/NestJS/etc.) — Next.js + Supabase is the entire backend.

## 1.6 Primary Objectives

The system must allow:

1. Supervisors to manage and monitor their teams.
2. Assistants to help manage schedules under delegated, limited permissions.
3. Employees/wards to manage their own schedules and submit HR-related requests.
4. Organizations to track basic attendance.
5. Employees to submit leave and other requests.
6. Supervisors to approve/reject requests.
7. Users to receive relevant notifications, including realtime updates where practical.

## 1.7 Guiding Principle for Implementation

When in doubt, an implementer (human or AI coding assistant) should choose the option that:

- Uses a Supabase or Next.js built-in capability over a custom-built one.
- Uses one generalized data model (e.g. the unified `requests` table in `07-database-schema.md`) over several parallel bespoke ones.
- Pushes authorization into PostgreSQL Row Level Security rather than only checking permissions in UI code.
- Adds a feature to the "Future Features" list (`17-mvp-vs-future.md`) rather than building it now, if it is not explicitly required by the MVP scope in this document.

## 1.8 How to Use This SRS

This SRS is split into modules so that an AI coding assistant (or a human developer) can load only the module relevant to the task at hand instead of the entire document. See `00-index.md` for the full module list and recommended reading order per development phase.
