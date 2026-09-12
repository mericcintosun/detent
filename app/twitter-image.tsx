// Twitter reuses the same generated image as opengraph-image.tsx. A summary
// large image card and an Open Graph preview want the same 1200x630 picture,
// so this file only re-exports the other one rather than rendering a second
// copy of the same layout.

export { default, alt, size, contentType } from "./opengraph-image";
