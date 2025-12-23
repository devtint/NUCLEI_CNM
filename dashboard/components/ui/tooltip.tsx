
"use client";

import * as React from "react"
import { cn } from "@/lib/utils"

const TooltipProvider = ({ children }: { children: React.ReactNode }) => <>{children}</>

const Tooltip = ({ children, delayDuration }: { children: React.ReactNode, delayDuration?: number }) => {
    const [open, setOpen] = React.useState(false);
    return (
        <div className="relative inline-block" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
            {React.Children.map(children, child => {
                if (React.isValidElement(child) && (child.type === TooltipTrigger || child.type === TooltipContent)) {
                    return React.cloneElement(child, { open } as any);
                }
                return child;
            })}
        </div>
    );
};

// Simplified Trigger that just renders children
const TooltipTrigger = React.forwardRef<HTMLElement, { asChild?: boolean, children: React.ReactNode, open?: boolean }>(
    ({ children, ...props }, ref) => {
        return <div className="inline-block cursor-help">{children}</div>;
    }
)
TooltipTrigger.displayName = "TooltipTrigger"

const TooltipContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { open?: boolean, sideOffset?: number }>(
    ({ className, sideOffset = 4, open, ...props }, ref) => {
        if (!open) return null;
        return (
            <div
                ref={ref}
                className={cn(
                    "z-50 overflow-hidden rounded-md border border-slate-100 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400",
                    "absolute top-full right-0 mt-2 w-max min-w-[150px]",
                    className
                )}
                {...props}
            />
        )
    }
)
TooltipContent.displayName = "TooltipContent"

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
