import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "../../lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl text-sm font-semibold ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 hover:scale-105 transform",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-r from-blue-600 to-indigo-600 text-primary-foreground shadow-lg hover:shadow-xl hover:from-blue-700 hover:to-indigo-700 backdrop-blur-sm border border-white/10",
        destructive:
          "bg-gradient-to-r from-red-500 to-red-600 text-destructive-foreground shadow-lg hover:shadow-xl hover:from-red-600 hover:to-red-700 backdrop-blur-sm border border-white/10",
        outline:
          "border border-input bg-white/10 backdrop-blur-xl shadow-lg hover:bg-white/20 hover:text-accent-foreground hover:shadow-xl",
        secondary:
          "bg-white/20 backdrop-blur-xl text-secondary-foreground shadow-lg hover:bg-white/30 hover:shadow-xl border border-white/20",
        ghost: "hover:bg-white/10 hover:text-accent-foreground backdrop-blur-sm hover:shadow-md",
        link: "text-primary underline-offset-4 hover:underline",
        glass: "bg-white/10 backdrop-blur-xl border border-white/20 text-foreground shadow-xl hover:bg-white/20 hover:shadow-2xl",
        premium: "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg hover:shadow-xl hover:from-purple-700 hover:to-pink-700 backdrop-blur-sm border border-white/10"
      },
      size: {
        default: "h-12 px-6 py-3",
        sm: "h-10 rounded-xl px-4",
        lg: "h-14 rounded-2xl px-8",
        xl: "h-16 rounded-3xl px-10 text-base",
        icon: "h-12 w-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants } 