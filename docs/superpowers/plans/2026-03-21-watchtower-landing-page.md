# WATCHTOWER Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a stage-first WATCHTOWER landing page in a dedicated `web/` Next.js app, with a cinematic hero, a smoked-glass full-screen doctrine terminal, and a boot-sequence hold state ending at `Stand by.`

**Architecture:** Create a standalone `web/` Next.js App Router frontend so the landing page does not collide with the repo's Python/runtime files. Model the UI as an explicit state machine (`idleHero`, `terminalOpening`, `terminalEditing`, `deploying`, `standbyHold`) that drives a hero scene, a terminal overlay, and a timed deployment renderer, with CSS-first motion and graceful silent fallback for ambience.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, Vitest, React Testing Library, Playwright

---

## Planned File Structure

- `web/package.json` - frontend scripts and dependencies
- `web/src/app/layout.tsx` - metadata, font wiring, root body classes
- `web/src/app/page.tsx` - homepage route entry
- `web/src/app/globals.css` - design tokens, background art, motion, terminal styling, responsive rules
- `web/src/components/watchtower/watchtower-experience.tsx` - stateful client entry for the full landing-page experience
- `web/src/components/watchtower/hero-scene.tsx` - title card, silhouette layers, atmospheric backdrop
- `web/src/components/watchtower/command-actions.tsx` - primary CTA cluster
- `web/src/components/watchtower/terminal-overlay.tsx` - full-screen smoked-glass terminal shell, close affordance, doctrine input
- `web/src/components/watchtower/deploy-sequence.tsx` - timed boot-sequence renderer ending in `Stand by.`
- `web/src/components/watchtower/audio-toggle.tsx` - subordinate sound control with silent fallback state
- `web/src/lib/watchtower/state-machine.ts` - reducer and event types for all UI states
- `web/src/lib/watchtower/boot-sequence.ts` - boot lines and pacing constants
- `web/src/lib/watchtower/use-prefers-reduced-motion.ts` - motion preference hook
- `web/src/lib/watchtower/use-ambient-audio.ts` - best-effort ambience playback with error-safe fallback
- `web/src/test/setup.ts` - Vitest + Testing Library setup
- `web/vitest.config.ts` - unit/component test config
- `web/playwright.config.ts` - browser test config
- `web/src/lib/watchtower/state-machine.test.ts` - reducer tests
- `web/src/components/watchtower/watchtower-experience.test.tsx` - interaction and rendering tests
- `web/tests/landing-page.spec.ts` - keyboard-first and end-to-end flow coverage

### Task 1: Bootstrap The Dedicated Frontend Workspace

**Files:**
- Create: `web/package.json`
- Create: `web/next.config.ts`
- Create: `web/tsconfig.json`
- Create: `web/postcss.config.mjs`
- Create: `web/eslint.config.mjs`
- Create: `web/src/app/layout.tsx`
- Create: `web/src/app/page.tsx`
- Create: `web/src/app/globals.css`
- Create: `web/src/components/watchtower/watchtower-experience.tsx`
- Create: `web/src/components/watchtower/watchtower-experience.test.tsx`
- Create: `web/src/test/setup.ts`
- Create: `web/vitest.config.ts`

- [ ] **Step 1: Generate the Next.js app scaffold in `web/`**

This is the allowed generated-code exception before feature TDD starts.

Run:
```bash
npm create next-app@latest web -- --ts --tailwind --eslint --app --src-dir --use-npm --import-alias "@/*"
```

Expected: the command creates a runnable App Router project under `web/`.

- [ ] **Step 2: Install the frontend test dependencies**

Run:
```bash
cd web
npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

Expected: `package.json` gains the testing dependencies without changing the generated app structure.

- [ ] **Step 3: Add the test harness configuration**

```ts
// web/vitest.config.ts
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "./src"),
    },
  },
});
```

```ts
// web/src/test/setup.ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 4: Write the failing hero smoke test**

```tsx
// web/src/components/watchtower/watchtower-experience.test.tsx
import { render, screen } from "@testing-library/react";
import Page from "@/app/page";

test("renders the two primary WATCHTOWER commands", () => {
  render(<Page />);

  expect(
    screen.getByRole("button", { name: /deploy default agent/i }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: /write your doctrine/i }),
  ).toBeInTheDocument();
});
```

- [ ] **Step 5: Run the smoke test and verify it fails for the right reason**

Run:
```bash
cd web
npx vitest run src/components/watchtower/watchtower-experience.test.tsx
```

Expected: FAIL because the generated homepage does not render the WATCHTOWER controls yet.

- [ ] **Step 6: Replace the generated homepage with the minimal WATCHTOWER shell**

```tsx
// web/src/app/page.tsx
import { WatchtowerExperience } from "@/components/watchtower/watchtower-experience";

export default function Page() {
  return <WatchtowerExperience />;
}
```

```tsx
// web/src/components/watchtower/watchtower-experience.tsx
"use client";

export function WatchtowerExperience() {
  return (
    <main>
      <h1>WATCHTOWER</h1>
      <button type="button">DEPLOY DEFAULT AGENT</button>
      <button type="button">WRITE YOUR DOCTRINE</button>
    </main>
  );
}
```

- [ ] **Step 7: Run the smoke test again and verify it passes**

Run:
```bash
cd web
npx vitest run src/components/watchtower/watchtower-experience.test.tsx
```

Expected: PASS with `1 passed`.

- [ ] **Step 8: Commit the bootstrap task**

```bash
git add web docs/superpowers/plans/2026-03-21-watchtower-landing-page.md
git commit -m "feat: scaffold watchtower landing page app"
```

### Task 2: Add The Hero Scene And Explicit State Machine

**Files:**
- Create: `web/src/lib/watchtower/state-machine.ts`
- Create: `web/src/lib/watchtower/state-machine.test.ts`
- Create: `web/src/components/watchtower/hero-scene.tsx`
- Create: `web/src/components/watchtower/command-actions.tsx`
- Create: `web/src/components/watchtower/terminal-overlay.tsx`
- Modify: `web/src/components/watchtower/watchtower-experience.tsx`
- Modify: `web/src/app/globals.css`
- Test: `web/src/lib/watchtower/state-machine.test.ts`
- Test: `web/src/components/watchtower/watchtower-experience.test.tsx`

- [ ] **Step 1: Write the failing reducer tests for the approved UI states**

```ts
// web/src/lib/watchtower/state-machine.test.ts
import {
  initialWatchtowerState,
  reduceWatchtowerState,
} from "@/lib/watchtower/state-machine";

test("opens into terminalOpening from the hero", () => {
  const next = reduceWatchtowerState(initialWatchtowerState, {
    type: "OPEN_TERMINAL",
  });

  expect(next.mode).toBe("terminalOpening");
});

test("moves from terminalOpening to terminalEditing", () => {
  const next = reduceWatchtowerState(
    { ...initialWatchtowerState, mode: "terminalOpening" },
    { type: "TERMINAL_OPENED" },
  );

  expect(next.mode).toBe("terminalEditing");
});

test("can close the terminal during the opening phase", () => {
  const next = reduceWatchtowerState(
    { ...initialWatchtowerState, mode: "terminalOpening" },
    { type: "CLOSE_TERMINAL" },
  );

  expect(next.mode).toBe("idleHero");
});

test("default deploy bypasses editing", () => {
  const next = reduceWatchtowerState(initialWatchtowerState, {
    type: "DEPLOY_DEFAULT_AGENT",
  });

  expect(next.mode).toBe("deploying");
});
```

- [ ] **Step 2: Run the reducer tests and verify they fail**

Run:
```bash
cd web
npx vitest run src/lib/watchtower/state-machine.test.ts
```

Expected: FAIL because the reducer does not exist yet.

- [ ] **Step 3: Implement the state reducer and event model**

```ts
// web/src/lib/watchtower/state-machine.ts
export type WatchtowerMode =
  | "idleHero"
  | "terminalOpening"
  | "terminalEditing"
  | "deploying"
  | "standbyHold";

export type WatchtowerState = {
  mode: WatchtowerMode;
  doctrine: string;
};

export type WatchtowerEvent =
  | { type: "OPEN_TERMINAL" }
  | { type: "TERMINAL_OPENED" }
  | { type: "CLOSE_TERMINAL" }
  | { type: "SET_DOCTRINE"; value: string }
  | { type: "DEPLOY_DEFAULT_AGENT" }
  | { type: "DEPLOY_CUSTOM_AGENT" }
  | { type: "DEPLOYMENT_FINISHED" };
```

Implement `reduceWatchtowerState()` so:
- `OPEN_TERMINAL` moves `idleHero -> terminalOpening`
- `TERMINAL_OPENED` moves `terminalOpening -> terminalEditing`
- `CLOSE_TERMINAL` moves `terminalOpening -> idleHero` and `terminalEditing -> idleHero`
- `SET_DOCTRINE` updates `state.doctrine`
- deploy events move into `deploying`
- `DEPLOYMENT_FINISHED` moves `deploying -> standbyHold`

Keep the doctrine draft inside the reducer state so Task 3 can preserve it across close/reopen without inventing a second source of truth.

- [ ] **Step 4: Run the reducer tests and verify they pass**

Run:
```bash
cd web
npx vitest run src/lib/watchtower/state-machine.test.ts
```

Expected: PASS with `4 passed`.

- [ ] **Step 5: Write the failing component test for open and close behavior**

```tsx
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WatchtowerExperience } from "@/components/watchtower/watchtower-experience";

test("opens the terminal and returns to the hero before deployment", async () => {
  vi.useFakeTimers();
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

  render(<WatchtowerExperience />);

  await user.click(
    screen.getByRole("button", { name: /write your doctrine/i }),
  );
  await act(async () => {
    vi.advanceTimersByTime(250);
  });

  expect(screen.getByRole("dialog", { name: /watchtower command system/i })).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: /close terminal/i }));

  expect(
    screen.getByRole("button", { name: /write your doctrine/i }),
  ).toBeInTheDocument();
});
```

- [ ] **Step 6: Run the component test and verify it fails**

Run:
```bash
cd web
npx vitest run src/components/watchtower/watchtower-experience.test.tsx
```

Expected: FAIL because no dialog or transition logic exists yet.

- [ ] **Step 7: Implement the hero scene and wire it to the reducer**

```tsx
// web/src/components/watchtower/watchtower-experience.tsx
"use client";

import { useEffect, useReducer } from "react";
import { CommandActions } from "@/components/watchtower/command-actions";
import { HeroScene } from "@/components/watchtower/hero-scene";
import { TerminalOverlay } from "@/components/watchtower/terminal-overlay";
import { reduceWatchtowerState, initialWatchtowerState } from "@/lib/watchtower/state-machine";

export function WatchtowerExperience() {
  const [state, dispatch] = useReducer(
    reduceWatchtowerState,
    initialWatchtowerState,
  );

  useEffect(() => {
    if (state.mode !== "terminalOpening") return;
    const timer = window.setTimeout(
      () => dispatch({ type: "TERMINAL_OPENED" }),
      250,
    );
    return () => window.clearTimeout(timer);
  }, [state.mode]);

  return (
    <main data-mode={state.mode}>
      <HeroScene />
      <CommandActions
        onDeployDefault={() => dispatch({ type: "DEPLOY_DEFAULT_AGENT" })}
        onWriteDoctrine={() => dispatch({ type: "OPEN_TERMINAL" })}
      />
      {state.mode === "terminalOpening" || state.mode === "terminalEditing" ? (
        <TerminalOverlay
          doctrine={state.doctrine}
          canClose
          onChangeDoctrine={(value) =>
            dispatch({ type: "SET_DOCTRINE", value })
          }
          onClose={() => dispatch({ type: "CLOSE_TERMINAL" })}
          onDeploy={() => {}}
        />
      ) : null}
    </main>
  );
}
```

Also add the dusk background layers, typography tokens, and CTA styling in `web/src/app/globals.css`.

- [ ] **Step 8: Run the reducer and component tests and verify they pass**

Run:
```bash
cd web
npx vitest run src/lib/watchtower/state-machine.test.ts src/components/watchtower/watchtower-experience.test.tsx
```

Expected: PASS once the dialog shell and close path are present.

- [ ] **Step 9: Commit the hero/state-machine task**

```bash
git add web
git commit -m "feat: add watchtower hero and state machine"
```

### Task 3: Implement Doctrine Editing, Close/Reopen, And Keyboard Escape

**Files:**
- Modify: `web/src/components/watchtower/terminal-overlay.tsx`
- Modify: `web/src/components/watchtower/watchtower-experience.tsx`
- Modify: `web/src/components/watchtower/watchtower-experience.test.tsx`
- Modify: `web/src/app/globals.css`
- Test: `web/src/components/watchtower/watchtower-experience.test.tsx`

- [ ] **Step 1: Write the failing persistence test**

```tsx
test("preserves typed doctrine across close and reopen in the same session", async () => {
  vi.useFakeTimers();
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

  render(<WatchtowerExperience />);

  await user.click(
    screen.getByRole("button", { name: /write your doctrine/i }),
  );
  await act(async () => {
    vi.advanceTimersByTime(250);
  });

  expect(screen.getByTestId("terminal-cursor")).toBeInTheDocument();

  const textbox = screen.getByRole("textbox", { name: /doctrine/i });
  await user.type(textbox, "Protect the southern road.");
  await user.keyboard("{Escape}");

  await user.click(
    screen.getByRole("button", { name: /write your doctrine/i }),
  );
  await act(async () => {
    vi.advanceTimersByTime(250);
  });

  expect(screen.getByRole("textbox", { name: /doctrine/i })).toHaveValue(
    "Protect the southern road.",
  );
});
```

- [ ] **Step 2: Run the persistence test and verify it fails**

Run:
```bash
cd web
npx vitest run src/components/watchtower/watchtower-experience.test.tsx -t "preserves typed doctrine"
```

Expected: FAIL because the terminal does not yet manage a persistent controlled draft.

- [ ] **Step 3: Implement the full terminal editing state**

```tsx
// web/src/components/watchtower/terminal-overlay.tsx
type TerminalOverlayProps = {
  doctrine: string;
  canClose: boolean;
  onChangeDoctrine: (value: string) => void;
  onClose: () => void;
  onDeploy: () => void;
};
```

Implementation requirements:
- render a full-screen `dialog` with label `WATCHTOWER COMMAND SYSTEM`
- keep the hero scene faintly visible behind a smoked-glass surface
- use a controlled `<textarea>` bound to `state.doctrine`
- keep a blinking terminal cursor visible during `terminalOpening` and `terminalEditing`
- close on `Escape` while in `terminalOpening` or `terminalEditing`
- keep the draft in reducer state so close/reopen preserves text during the session

- [ ] **Step 4: Run the updated component test and verify it passes**

Run:
```bash
cd web
npx vitest run src/components/watchtower/watchtower-experience.test.tsx
```

Expected: PASS for the draft persistence and close/reopen path.

- [ ] **Step 5: Commit the terminal-editing task**

```bash
git add web
git commit -m "feat: add doctrine terminal editing flow"
```

### Task 4: Add Deployment Paths, Boot Sequence Timing, And Standby Hold

**Files:**
- Create: `web/src/lib/watchtower/boot-sequence.ts`
- Create: `web/src/components/watchtower/deploy-sequence.tsx`
- Modify: `web/src/components/watchtower/terminal-overlay.tsx`
- Modify: `web/src/components/watchtower/watchtower-experience.tsx`
- Modify: `web/src/components/watchtower/watchtower-experience.test.tsx`
- Modify: `web/src/lib/watchtower/state-machine.ts`
- Test: `web/src/components/watchtower/watchtower-experience.test.tsx`

- [ ] **Step 1: Write the failing deployment tests**

```tsx
test("default deploy bypasses editing and reaches standby", async () => {
  vi.useFakeTimers();
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

  render(<WatchtowerExperience />);

  await user.click(
    screen.getByRole("button", { name: /deploy default agent/i }),
  );

  expect(
    screen.queryByRole("textbox", { name: /doctrine/i }),
  ).not.toBeInTheDocument();
  expect(screen.getByText(/initialising orchestrator/i)).toBeInTheDocument();

  await act(async () => {
    vi.runAllTimers();
  });

  expect(screen.getByText(/stand by\./i)).toBeInTheDocument();
  expect(screen.getByTestId("terminal-cursor")).toBeInTheDocument();
});

test("custom deploy allows an empty doctrine and locks the terminal while deploying", async () => {
  vi.useFakeTimers();
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

  render(<WatchtowerExperience />);

  await user.click(
    screen.getByRole("button", { name: /write your doctrine/i }),
  );
  await act(async () => {
    vi.advanceTimersByTime(250);
  });

  await user.click(screen.getByRole("button", { name: /deploy/i }));

  expect(screen.getByText(/initialising orchestrator/i)).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: /close terminal/i }),
  ).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the deployment tests and verify they fail**

Run:
```bash
cd web
npx vitest run src/components/watchtower/watchtower-experience.test.tsx -t "deploy"
```

Expected: FAIL because deployment rendering and standby completion do not exist yet.

- [ ] **Step 3: Implement the boot-sequence constants and renderer**

```ts
// web/src/lib/watchtower/boot-sequence.ts
export const BOOT_SEQUENCE_LINES = [
  "Initialising orchestrator...",
  "Fetching wind conditions... [London, 12mph NE]",
  "Spawning sub-agents... [2x HELICOPTER] [3x GROUND CREW]",
  "Fire ignition point set.",
  "Stand by.",
] as const;

export const BOOT_SEQUENCE_INTERVAL_MS = 650;
```

```tsx
// web/src/components/watchtower/deploy-sequence.tsx
type DeploySequenceProps = {
  onFinished: () => void;
};
```

Implementation requirements:
- render lines progressively using `BOOT_SEQUENCE_INTERVAL_MS`
- use the same terminal shell for both deploy paths
- disable editing and close affordances during deployment
- dispatch `DEPLOYMENT_FINISHED` after the final line reveals
- keep the terminal cursor visible and blinking in the final `Stand by.` hold state

- [ ] **Step 4: Run the deployment tests and verify they pass**

Run:
```bash
cd web
npx vitest run src/components/watchtower/watchtower-experience.test.tsx -t "deploy"
```

Expected: PASS for both deploy paths and the `Stand by.` hold.

- [ ] **Step 5: Commit the deployment task**

```bash
git add web
git commit -m "feat: add watchtower deploy sequence"
```

### Task 5: Add Ambience Controls And Reduced-Motion Fallbacks

**Files:**
- Create: `web/src/lib/watchtower/use-prefers-reduced-motion.ts`
- Create: `web/src/lib/watchtower/use-ambient-audio.ts`
- Create: `web/src/components/watchtower/audio-toggle.tsx`
- Modify: `web/src/components/watchtower/watchtower-experience.tsx`
- Modify: `web/src/components/watchtower/watchtower-experience.test.tsx`
- Modify: `web/src/app/globals.css`
- Test: `web/src/components/watchtower/watchtower-experience.test.tsx`

- [ ] **Step 1: Write the failing resilience tests**

```tsx
test("renders a subordinate sound toggle", () => {
  render(<WatchtowerExperience />);

  expect(
    screen.getByRole("button", { name: /sound/i }),
  ).toBeInTheDocument();
});

test("marks the experience as reduced motion when the media query matches", () => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query === "(prefers-reduced-motion: reduce)",
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as typeof window.matchMedia;

  render(<WatchtowerExperience />);

  expect(screen.getByTestId("watchtower-root")).toHaveAttribute(
    "data-reduced-motion",
    "true",
  );
});

test("still reaches standby when reduced motion is enabled", async () => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query === "(prefers-reduced-motion: reduce)",
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as typeof window.matchMedia;

  vi.useFakeTimers();
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

  render(<WatchtowerExperience />);

  await user.click(
    screen.getByRole("button", { name: /write your doctrine/i }),
  );
  await act(async () => {
    vi.runOnlyPendingTimers();
  });

  await user.click(screen.getByRole("button", { name: /deploy/i }));
  await act(async () => {
    vi.runAllTimers();
  });

  expect(screen.getByText(/stand by\./i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the resilience tests and verify they fail**

Run:
```bash
cd web
npx vitest run src/components/watchtower/watchtower-experience.test.tsx -t "sound|reduced motion"
```

Expected: FAIL because neither the sound toggle nor motion-preference hook exists yet.

- [ ] **Step 3: Implement the silent-safe audio hook and motion hook**

```ts
// web/src/lib/watchtower/use-prefers-reduced-motion.ts
export function usePrefersReducedMotion(): boolean {
  // subscribe to `(prefers-reduced-motion: reduce)` and default to false on the server
}
```

```ts
// web/src/lib/watchtower/use-ambient-audio.ts
export function useAmbientAudio() {
  // return { enabled, available, toggle }
  // attempt HTMLAudioElement playback only after user interaction
  // if playback or loading fails, remain silent without breaking the UI
}
```

Also add a visually subordinate `AudioToggle` component and expose `data-reduced-motion` on the root experience node.
When reduced motion is enabled, shorten or remove non-essential visual transitions but keep the same state progression so deploy still reaches `Stand by.`

- [ ] **Step 4: Run the resilience tests and verify they pass**

Run:
```bash
cd web
npx vitest run src/components/watchtower/watchtower-experience.test.tsx -t "sound|reduced motion"
```

Expected: PASS, with the page still fully usable in silent fallback mode.

- [ ] **Step 5: Commit the ambience/accessibility task**

```bash
git add web
git commit -m "feat: add ambience toggle and reduced motion support"
```

### Task 6: Add Browser-Level Coverage And Final Verification

**Files:**
- Create: `web/playwright.config.ts`
- Create: `web/tests/landing-page.spec.ts`
- Modify: `web/src/app/globals.css`
- Modify: `web/src/components/watchtower/watchtower-experience.tsx`
- Test: `web/tests/landing-page.spec.ts`

- [ ] **Step 1: Install Playwright and write the failing keyboard-flow test**

Run:
```bash
cd web
npm install -D @playwright/test
npx playwright install chromium
```

Expected: Playwright is available for local browser coverage.

```ts
// web/playwright.config.ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  use: {
    baseURL: "http://127.0.0.1:3000",
    headless: true,
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
  },
});
```

```ts
// web/tests/landing-page.spec.ts
import { expect, test } from "@playwright/test";

test("keyboard users can open, close, reopen, and deploy the terminal flow", async ({
  page,
}) => {
  await page.goto("/");

  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: /deploy default agent/i }),
  ).toBeFocused();

  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: /write your doctrine/i }),
  ).toBeFocused();

  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("dialog", { name: /watchtower command system/i }),
  ).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: /write your doctrine/i }),
  ).toBeVisible();

  await page.getByRole("button", { name: /deploy default agent/i }).click();
  await expect(page.getByText(/stand by\./i)).toBeVisible();
});

test("mobile layout keeps the terminal usable without horizontal scrolling", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await page.getByRole("button", { name: /write your doctrine/i }).click();
  await expect(
    page.getByRole("dialog", { name: /watchtower command system/i }),
  ).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });

  expect(hasHorizontalOverflow).toBe(false);
  await expect(page.getByRole("textbox", { name: /doctrine/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /deploy/i })).toBeVisible();
});
```

- [ ] **Step 2: Run the Playwright test and verify it fails**

Run:
```bash
cd web
npx playwright test tests/landing-page.spec.ts
```

Expected: FAIL until focus order, dialog semantics, or timing issues are corrected.

- [ ] **Step 3: Fix the accessibility and responsive gaps exposed by browser testing**

Likely adjustments:
- ensure focus order lands on the two primary CTAs first
- keep the sound toggle later in DOM/tab order so it does not interrupt the main CTA sequence
- give the terminal an accessible dialog label
- keep the terminal usable at mobile widths without horizontal scrolling
- make the close affordance discoverable before deployment and absent during deployment
- reduce or remove non-essential transitions when `prefers-reduced-motion: reduce` is active without skipping state changes

- [ ] **Step 4: Re-run the browser test and then the full verification suite**

Run:
```bash
cd web
npx playwright test tests/landing-page.spec.ts
npx vitest run
npm run lint
npm run build
```

Expected:
- Playwright PASS
- Vitest PASS
- ESLint exits 0
- Next.js production build exits 0

- [ ] **Step 5: Commit the final landing-page implementation**

```bash
git add web
git commit -m "feat: complete watchtower landing page"
```
