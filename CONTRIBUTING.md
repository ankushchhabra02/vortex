# Contributing to Vortex

Thanks for your interest in contributing to Vortex! This guide will help you get started.

## Getting Started

1. **Fork** the repository and clone your fork
2. **Install dependencies**: `npm install`
3. **Set up environment**: Copy `.env.example` to `.env.local` and fill in your Supabase credentials
4. **Run the dev server**: `npm run dev`

## Development Workflow

1. Create a feature branch from `main`:
   ```bash
   git checkout -b feature/your-feature
   ```
2. Make your changes
3. Run the checks:
   ```bash
   npm run lint      # ESLint
   npm test          # Vitest
   npm run build     # Production build
   ```
4. Commit your changes with a clear, descriptive message
5. Push and open a pull request against `main`

## Code Guidelines

- **TypeScript** — All new code should be written in TypeScript with proper types. Avoid `any` where possible.
- **No console.log in client code** — Use the toast system for user-facing messages. Server-side `console.error` for API routes is fine.
- **Error handling** — API routes should return standardized error responses using error codes (`INTERNAL_ERROR`, `PROVIDER_ERROR`, etc.). Never expose raw error messages to clients.
- **Tailwind CSS v4** — Use Tailwind utility classes. The project uses the `@import "tailwindcss"` syntax (no tailwind.config file).
- **Dark theme** — All UI should use the zinc-based dark theme consistently.

## Project Structure

```
src/
├── app/           # Next.js App Router (pages + API routes)
├── components/    # React components
└── lib/           # Utilities, services, and providers
```

- **API routes** go in `src/app/api/`
- **Client components** go in `src/components/`
- **Shared utilities** go in `src/lib/`
- **Tests** go next to source files in `__tests__/` directories

## Testing

We use [Vitest](https://vitest.dev) for unit tests.

```bash
npm test           # Run all tests once
npm run test:watch # Run tests in watch mode
```

When adding new utilities or services, please include tests. Test files should be named `*.test.ts` and placed in a `__tests__/` directory next to the source.

## Pull Request Guidelines

- Keep PRs focused — one feature or fix per PR
- Include a clear description of what changed and why
- Make sure all CI checks pass (lint, test, build)
- Update the README if your change adds new features or environment variables

## Reporting Issues

Use [GitHub Issues](https://github.com/ankushchhabra02/vortex/issues) to report bugs or request features. Please include:

- Steps to reproduce (for bugs)
- Expected vs actual behavior
- Node.js version and OS
- Relevant error messages or screenshots

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
