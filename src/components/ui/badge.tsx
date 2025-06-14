import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "../../lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 backdrop-blur-sm",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary/20 text-primary-foreground backdrop-blur-xl border-white/20 shadow-lg",
        secondary:
          "border-transparent bg-secondary/20 text-secondary-foreground backdrop-blur-xl border-white/20 shadow-lg",
        destructive:
          "border-transparent bg-destructive/20 text-destructive-foreground backdrop-blur-xl border-red-200/30 shadow-lg",
        outline: "text-foreground bg-white/10 backdrop-blur-xl border-white/20 shadow-lg",
        success: "border-transparent bg-green-500/20 text-green-700 backdrop-blur-xl border-green-200/30 shadow-lg",
        warning: "border-transparent bg-yellow-500/20 text-yellow-700 backdrop-blur-xl border-yellow-200/30 shadow-lg",
        info: "border-transparent bg-blue-500/20 text-blue-700 backdrop-blur-xl border-blue-200/30 shadow-lg",
        premium: "border-transparent bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-700 backdrop-blur-xl border-purple-200/30 shadow-lg",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants } 