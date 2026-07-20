import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Teal — primary actions
        primary: "bg-teal-600 text-white shadow-sm hover:bg-teal-700 active:bg-teal-700",
        // Navy — secondary actions
        secondary: "bg-navy-700 text-white shadow-sm hover:bg-navy-600 active:bg-navy-600",
        // Orange — energetic accent
        accent: "bg-orange-500 text-white shadow-sm hover:bg-orange-600 active:bg-orange-600",
        outline:
          "border border-input bg-white text-navy-700 shadow-sm hover:bg-muted hover:text-navy-700",
        ghost: "text-navy-700 hover:bg-muted",
        subtle: "bg-muted text-navy-700 hover:bg-mist",
        success: "bg-teal-600 text-white shadow-sm hover:bg-teal-700",
        recovery: "bg-recovery text-white shadow-sm hover:bg-recovery/90",
        danger: "bg-danger text-white shadow-sm hover:bg-danger/90",
        link: "text-teal-700 underline-offset-4 hover:underline",
      },
      size: {
        default: "h-12 px-5 py-2",
        sm: "h-10 rounded-lg px-3.5 text-sm",
        lg: "h-14 rounded-xl px-6 text-base",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
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
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
