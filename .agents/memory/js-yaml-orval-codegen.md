---
name: orval codegen breakage from pnpm hoisting / YAML descriptions
description: Two distinct failure modes seen when running orval codegen against openapi.yaml in this monorepo.
---

## js-yaml gets mis-hoisted to an ESM-only major version
pnpm can hoist a transitive `js-yaml` dependency to a newer major (e.g. v5, ESM-only) that breaks orval, which expects the CJS v4 API. Symptom: codegen fails, hangs, or produces broken/incomplete client output with no obvious error pointing at js-yaml. A loose override like `js-yaml: '>=4.2.0'` can silently resolve to v5.

**Why:** pnpm's hoisting picks the highest semver-compatible version across the tree unless pinned; orval's own dependency on js-yaml v4 doesn't stop a sibling package from pulling in v5, and orval imports js-yaml's default export using CJS-style interop that v5's ESM export shape breaks.
**How to apply:** pin `js-yaml` via `pnpm.overrides` (in `pnpm-workspace.yaml` or the root `package.json`) to `'>=4.2.0 <5.0.0'`, run `pnpm install`, then rerun codegen.

## Multi-line YAML block-scalar (`|`) descriptions with a blank line + `>` can break generated JSDoc
An openapi.yaml `description: |` block containing a blank line and a `>` character (e.g. "When > 0, ...") can produce a generated TS file where orval's JSDoc comment isn't properly terminated, causing esbuild/vite to fail with "Expected `*/` to terminate multi-line comment" in the generated api-client-react schemas file.

**Why:** orval's JSDoc emission doesn't reliably escape/handle blank lines plus certain punctuation inside block-scalar descriptions.
**How to apply:** if codegen output causes a downstream vite/esbuild parse error in `lib/api-client-react/src/generated/*`, check the openapi.yaml description for that field — collapse multi-line block-scalar (`|`) descriptions with blank lines into a single-line quoted string as a fix, then rerun codegen.
