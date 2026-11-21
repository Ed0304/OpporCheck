// Tailwind CSS v4 PostCSS plugin.
//
// This config serves webpack builds only (`npm run build` ->
// `next build --webpack`), which ignore the `turbopack` section of
// next.config.ts. `next dev` keeps using @tailwindcss/turbopack via
// next.config.ts. The two pipelines are independent and do not conflict.
//
// Without this file, `@import "tailwindcss"` in globals.css is never
// processed under webpack and the production site ships unstyled.

export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
