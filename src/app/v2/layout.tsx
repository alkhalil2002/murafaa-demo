import "./v2.css";

/**
 * v2 design-layer route group. Exists only to load `v2.css` alongside the
 * existing globals, so v1 screens keep rendering exactly as before and the
 * two generations can be compared side by side in the same session.
 */
export default function V2Layout({ children }: { children: React.ReactNode }) {
  return children;
}
