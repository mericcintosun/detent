"use client";

import * as m from "motion/react-m";
import { press } from "@/lib/motion";

/**
 * Press feedback for a Button: pass it as the Base UI `render` element,
 * `<Button render={pressable}>`. The button keeps every prop, class and state
 * from components/ui/button; Motion only adds the tap dip, which reduced motion
 * drops because it is a transform.
 */
export const pressable = (
  <m.button whileTap={press.whileTap} transition={press.transition} />
);
