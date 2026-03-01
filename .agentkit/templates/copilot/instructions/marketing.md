<!-- generated_by: {{lastAgent}} | last_model: {{lastModel}} | last_updated: {{syncDate}} -->
<!-- Format: Plain Markdown. Copilot domain-specific instructions. -->
<!-- Docs: https://docs.github.com/en/copilot/customizing-copilot/adding-repository-custom-instructions-for-github-copilot -->
# Copilot Instructions — Marketing / Frontend

Apply these rules when editing files in the marketing site, UI components,
or any Next.js / React code.

## Framework and Stack

- **Next.js** (App Router) with React Server Components by default.
- **CSS Modules** for component-scoped styles (`.module.css`).
- **TypeScript** in strict mode for all new files.

## Component Guidelines

- Prefer function components with hooks over class components.
- Export one component per file. Name the file after the component.
- Co-locate styles, tests, and stories next to the component file.
- Use `React.memo` only when profiling shows a measurable benefit.

## Styling

- Use CSS Modules; avoid inline styles and global CSS.
- Follow a mobile-first responsive approach.
- Use CSS custom properties (variables) for colors, spacing, and typography
  defined in the design system.
- Never use `!important` unless overriding third-party styles.

## Accessibility (a11y)

- All interactive elements must be keyboard-accessible.
- Images require meaningful `alt` text (or `alt=""` for decorative images).
- Use semantic HTML elements (`<nav>`, `<main>`, `<article>`, `<button>`).
- Color contrast must meet WCAG 2.1 AA (4.5:1 for normal text).
- Form inputs must have associated `<label>` elements.
- Test with a screen reader before shipping user-facing changes.

## Performance

- Lazy-load images and heavy components below the fold.
- Avoid importing entire icon or utility libraries; use tree-shakeable imports.
- Minimize client-side JavaScript; prefer Server Components where possible.
- Use `next/image` for all images to get automatic optimization.

## Testing

- Write unit tests with Vitest or Jest and React Testing Library.
- Test user-visible behavior, not implementation details.
- Include at least one accessibility assertion per interactive component.
