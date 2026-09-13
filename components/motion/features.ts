// Loaded on demand by MotionProvider after hydration, so the animation engine
// never sits in a route's first load. domMax is domAnimation plus layout
// animation and drag; the ledger and the step badge use `layout`. The measured
// size of this chunk is in docs/frontend/07_MOTION.md.
import { domMax } from "motion/react";

export default domMax;
