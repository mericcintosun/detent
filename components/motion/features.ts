// Loaded on demand by MotionProvider, so the animation engine never sits in the
// first load bundle. domAnimation covers animate, variants, exit, whileInView,
// hover, tap and focus; layout animation needs domMax, which nothing uses yet.
export { domAnimation as default } from "motion/react";
