"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[14px] font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:translate-y-px",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-r from-primary to-cyan-400 text-[#0A0E1A] shadow-[0_10px_24px_rgba(0,212,255,0.22)] hover:brightness-105",
        secondary:
          "border border-border bg-secondary text-secondary-foreground hover:border-primary/35 hover:text-foreground",
        outline:
          "border border-primary/40 bg-primary/10 text-primary hover:bg-primary/16",
        ghost:
          "text-muted-foreground hover:bg-secondary hover:text-foreground",
      },
      size: {
        default: "h-11 px-4 py-2 text-sm",
        sm: "h-9 rounded-xl px-3 text-sm",
        lg: "h-12 rounded-[16px] px-5 text-sm",
        icon: "h-11 w-11 rounded-[14px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
