// The one Motion function NumberTicker needs, in its own module so a dynamic
// import of it pulls `animate` and nothing else. It loads on the first change
// of an amount, never on page load.
export { animate } from "motion/react";
