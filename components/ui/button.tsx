"use client";

import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { buttonVariants, type ButtonVariantsProps } from "./button-variants";

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & Omit<ButtonVariantsProps, "className">) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={(state) =>
        buttonVariants({
          variant,
          size,
          className:
            typeof className === "function" ? className(state) : className,
        })
      }
      {...props}
    />
  );
}

export { Button, buttonVariants };
