# Secure-MaintAI — Frontend Engineering Rules & Standards
# Framework Specifications: Next.js 16 (App Router) & Tailwind CSS v4

---

## 1. Architectural Scope & Core Principles

The frontend of **Secure-MaintAI** is an AI-driven university infrastructure resilience platform dashboard. Its responsibilities and boundaries are defined under Section 5 and Section 26 of [`secure-maintai.md`](../.agents/rules/secure-maintai.md):

1. **Presentation & User Interaction Only**:
   - The frontend is strictly a presentation and interaction layer.
   - **Never place business logic, policy decisions, ML training/scoring pipelines, or destructive security containment in frontend components.**
   - All critical actions (surgical isolation, user enrollment, RBAC changes, SOAR execution) must be dispatched to and authorized by backend domain services (`/api/v1/...`).
2. **Never Trust Frontend State for Authorization**:
   - Never rely on `localStorage.getItem("role")` or client-side variables for security decisions.
   - Client-side role checks (e.g. `user.role === 'ADMIN'`) only control UI element visibility and contextual guidance. All privileged requests must send verified Bearer JWT tokens to backend endpoints enforcing `require_role(...)`.
3. **Fail-Safe & Graceful Degradation**:
   - If backend endpoints return `401 Unauthorized` (unauthenticated/guest session) or `404 Not Found` (endpoint not yet seeded), pages must gracefully display typed mock topologies rather than throwing unhandled exceptions or crashing the UI.

---

## 2. Next.js 16 Architecture & App Router Rules

Secure-MaintAI is built on **Next.js 16** with **React 19** and the **Turbopack** engine. All code must adhere to modern Next.js 16 architectural conventions:

### 2.1 Async Request APIs (Next.js 15/16 Breaking Standard)
In Next.js 16, request-dependent data structures (`params`, `searchParams`, `cookies()`, and `headers()`) are **Promises** and must always be awaited or unwrapped.

```tsx
// ✅ Correct: Next.js 16 Server Page
interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function DeviceDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { tab } = await searchParams;
  // ...
}
```

```tsx
// ❌ Deprecated / Forbidden in Next.js 16:
export default function DeviceDetailPage({ params }: { params: { id: string } }) {
  const id = params.id; // Error: params should be awaited
}
```

When accessing headers or cookies in Server Components, Route Handlers, or Server Actions:
```tsx
import { cookies, headers } from "next/headers";

export async function getSessionToken() {
  const cookieStore = await cookies();
  return cookieStore.get("access_token")?.value ?? null;
}
```

### 2.2 Server vs. Client Component Boundaries
- **Default to Server Components**: Keep data fetching, page scaffolding, and static layouts on the server whenever possible to minimize client bundle size.
- **Explicit `"use client"` Directives**: Mark files with `"use client"` only when:
  - Using React state hooks (`useState`, `useEffect`, `useReducer`, `useMemo`, `useCallback`).
  - Using browser APIs (`window`, `localStorage`, `navigator.clipboard`, `document.cookie`).
  - Handling user interaction events (`onClick`, `onChange`, `onSubmit`).
- **Clean Component Splitting**: In dynamic routes (e.g., `devices/[id]/page.tsx`), use a server-side entry page to resolve `await params` and render an interactive client component (`DeviceDetailClient.tsx`) for live state.

### 2.3 Network Boundary & Proxy Architecture (`proxy.ts`)
Next.js 16 streamlines edge routing and network boundary control via `src/proxy.ts`:
- Public paths (`/login`, `/favicon.ico`, `/_next`, `/api/auth`) are explicitly whitelisted.
- Protected routes require the `access_token` cookie; missing tokens redirect to `/login?redirect=<target>`.
- Authenticated users visiting `/login` are automatically forwarded to `/` (Dashboard).

### 2.4 Modern Route Structure & File Conventions
All dashboard features must reside within `src/app/(dashboard)/` using route grouping so URLs remain clean (e.g., `/devices`, not `/(dashboard)/devices`):
- `page.tsx`: Unique UI route entry point.
- `layout.tsx`: Persistent shell wrapping TopNavbar, Sidebar, and content container.
- `loading.tsx`: Telemetry shimmer skeleton displayed during Suspense transitions.
- `error.tsx`: Catch-all client error boundary providing telemetry diagnostics and a `reset()` retry button.
- `not-found.tsx`: Clean 404 page for missing workstations, alerts, or audit records.

---

## 3. Tailwind CSS v4 Standards & CSS-First Design System

Secure-MaintAI utilizes **Tailwind CSS v4** (`@tailwindcss/postcss`). Tailwind v4 replaces legacy `tailwind.config.js` with a **CSS-first configuration** model.

### 3.1 CSS-First Token Configuration (`@theme`)
All project design tokens (colors, font families, radius tokens) are centralized in `src/app/globals.css` using the `@theme` directive:

```css
@import "tailwindcss";

@theme {
  /* Surface & Background Tokens */
  --color-brand-dark: #060b18;
  --color-brand-surface: #0b1329;
  --color-brand-card: rgba(13, 22, 42, 0.78);
  --color-brand-card-border: rgba(30, 41, 59, 0.75);
  --color-brand-card-hover: rgba(19, 32, 60, 0.9);

  /* Primary Accent & Cyberpunk Tokens */
  --color-brand-blue: #3b82f6;
  --color-brand-blue-hover: #2563eb;
  --color-brand-cyan: #06b6d4;
  --color-brand-cyan-hover: #0891b2;
  --color-brand-purple: #8b5cf6;
  --color-brand-purple-hover: #7c3aed;

  /* Semantic Status Colors */
  --color-brand-emerald: #10b981;
  --color-brand-amber: #f59e0b;
  --color-brand-rose: #ef4444;
  --color-brand-slate: #64748b;

  /* Typography */
  --font-sans: "Plus Jakarta Sans", system-ui, -apple-system, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, monospace;
}
```

### 3.2 Custom Utility Classes (`@utility`)
In Tailwind v4, custom utility classes are declared with `@utility` rather than `@layer utilities`:
- `@utility glass-card`: Applies the dark glassmorphic background (`backdrop-blur-xl`), subtle border, and rounded corners.
- `@utility glass-card-hover`: Adds smooth hover elevation, border illumination, and glow.
- `@utility glow-blue`, `glow-cyan`, `glow-rose`: Box shadow glow accents for active statuses and containment modes.

### 3.3 Class Renaming & Modern Tailwind v4 Syntax
- Use `shrink-0` instead of `flex-shrink-0`.
- Use `bg-linear-to-*` instead of legacy `bg-gradient-to-*`.
- Avoid arbitrary bracket values like `bg-[#060b18]` where `@theme` tokens exist (`bg-brand-dark`, `bg-brand-surface`).
- Dark mode defaults to selector-based scoping (`dark:`) or system preference; do not hardcode light-mode white backgrounds in dashboard pages.

---

## 4. Domain Page Architecture (Rule 27 Compliance)

All dashboard pages must correspond strictly to the 11 functional modules defined in Section 27 of `secure-maintai.md`:

```text
src/app/(dashboard)/
├── page.tsx            # Dashboard (Main Overview & Gauges)
├── devices/
│   ├── page.tsx        # Device Monitoring Fleet & Enrollment
│   └── [id]/page.tsx   # Device Details & Host Telemetry
├── alerts/page.tsx     # Incident & Alert Management (SOAR)
├── cybersecurity/      # SIEM / Threat Intelligence & MITRE ATT&CK
├── predictions/        # AI Predictive Maintenance & Model Inference
├── reports/page.tsx    # Audit, Compliance & Performance Reports
├── maintenance/        # Predictive Maintenance Schedule & Dispatch
├── users/page.tsx      # Identity Directory & RBAC Governance
├── activity-logs/      # Immutable System Audit & Activity Logs
├── settings/page.tsx   # Platform Configuration & Kill Switch
└── help/page.tsx       # Help, Documentation & Support
```

### 4.1 Header Coordination Rule (Eliminating Redundancy)
[`TopNavbar.tsx`](file:///d:/workspace/2026_2027/FirstSemester/KKU/secure-maintai/frontend/src/components/layout/TopNavbar.tsx) dynamically displays the active page title, subtitle, live UTC clock, notification drawer, and identity context.
- **Rule**: Do not create redundant in-page `<h1>Page Title</h1>` blocks that duplicate the `TopNavbar` title.
- **Pattern**: Place page-specific controls (Search input, Filter dropdowns, Date Range picker, `Export` button, `+ Add Device` / `+ Add User`) in an in-page action bar aligned to the right or immediately start with top-level KPI cards.

---

## 5. Security, SOAR & Surgical Containment Rules

### 5.1 Surgical Network Containment Workflow (`Rule 19 & 20`)
Network isolation is a security-critical action. Never allow a click to immediately sever a host's network:
1. **Confirmation Modal Required**: Must trigger an explicit `Modal` showing:
   - Target workstation hostname, IP address, hardware type, and current CPU/RAM metrics.
   - Clear policy description: Dropping inbound/outbound packets to sever C2 beaconing while keeping the host OS running without reboots.
   - Role-sensitive warning: If target hosts `RESEARCHER` workloads, alert operator that process state is preserved.
2. **Rollback Action**: The modal must provide an immediate, accessible rollback button (`Rollback Isolation`) returning the host status to `ONLINE`.
3. **Audit Feedback**: Action dispatches must render an immediate feedback banner notifying the user that an immutable audit log entry was created.

### 5.2 Device Enrollment & Telemetry Governance (`Rule 9 & 10`)
1. Every new device enrollment must collect: Hostname, IPv4, Category, Model, Department, Lab/Location, and Operating System.
2. The enrollment modal must provide:
   - Unique generated agent token (`sm-agt-...`).
   - Copyable deployment commands for Linux/macOS (`curl -sSL ... | sudo bash -s -- ...`) and Windows (`irm ... | iex; ...`).
   - Rule 9 privacy notice: Telemetry monitors only system performance metadata (CPU, RAM, disk, network, process names) and never inspects private files or communications.

---

## 6. TypeScript & State Management Standards

1. **Strict Typing**:
   - Never use `any`. Always import types from `@/types`.
   - Every state hook must be typed: `useState<DeviceItem[]>(...)`, `useState<string | null>(null)`.
2. **DTO & Schema Normalization**:
   - Backend APIs return snake_case models (e.g. `workstation_hostname`, `is_isolated`, `cpu_usage`). Maintain typed API transformers or schema compatibility in `src/lib/api.ts`.
3. **Component Reusability**:
   - Reusable UI widgets (`Modal`, `StatusBadge`, `StatCard`, `GaugeMeter`, `LineChart`, `DonutChart`) must reside in `src/components/ui/` and `src/components/charts/`.
   - Components must not embed route-specific business logic.

---

## 7. Quality Checklist for Every Frontend Page

Before completing any page modification or addition, verify:
- [ ] `npx tsc --noEmit` compiles with **0 errors**.
- [ ] No duplicate `<h1>` titles that clash with `TopNavbar`.
- [ ] Dynamic route parameters use `await params` (Next.js 16 standard).
- [ ] All interactive buttons (`Export`, `+ Add`, `Isolate`, `Rollback`) have functional click handlers.
- [ ] High contrast, dark cyber aesthetic compliant with King Khalid University brand tokens.
- [ ] All actions generate visual feedback (toast/banner).
- [ ] Accessibility: semantic buttons (`type="button"` or `type="submit"`), label associations, and keyboard dismiss (`Escape` on modals).
