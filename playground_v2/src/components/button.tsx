import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader } from "lucide-react"; // Importing the Loader icon from lucide-react
import * as React from "react";
import jetBrainsMono from "src/app/fonts/jetBrainsMono";

import { cn } from "src/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-[13px] leading-[15.6px] tracking-[-0.02em] font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-[#303030] text-primary-foreground hover:bg-[#303030]/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-[#303030] underline-offset-4 hover:underline",
        disabled:
          "cursor-not-allowed border border-[#D7E2DE] hover:bg-accent hover:text-accent-foreground text-[#D7E2DE]",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-10 px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  tooltip?: string;
  tooltipDirection?: "top" | "bottom" | "left" | "right";
  loading?: boolean; // Added loading prop to show loading indicator
  loadingText?: string;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      tooltip,
      tooltipDirection = "top",
      loading = false,
      loadingText = "Sending",
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : "button";

    const tooltipPositionClasses = {
      top: "bottom-full left-1/2 transform -translate-x-1/2 mb-2",
      bottom: "top-full left-1/2 transform -translate-x-1/2 mt-2",
      left: "right-full top-1/2 transform -translate-y-1/2 mr-2",
      right: "left-full top-1/2 transform -translate-y-1/2 ml-2",
    };

    return (
      <Comp
        className={cn(
          "relative group cursor-pointer",
          jetBrainsMono.className,
          buttonVariants({ variant, size, className }),
          {
            "bg-black bg-opacity-40": loading,
            "cursor-not-allowed": props?.disabled,
          }
        )}
        ref={ref}
        {...props}
      >
        {loading ? (
          <div className="flex items-center justify-center gap-2">
            <span>{loadingText}</span>
            <Loader className="animate-spin" />
          </div>
        ) : (
          props.children
        )}
        {tooltip && (
          <div
            className={`absolute ${tooltipPositionClasses[tooltipDirection]} hidden group-hover:block z-500`}
          >
            <div className="bg-black text-white text-xs py-1 px-2 relative">
              {tooltip}
            </div>
          </div>
        )}
      </Comp>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
