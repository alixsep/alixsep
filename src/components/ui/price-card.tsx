import { card } from "@/lib/surface"
import { cn } from "@/lib/utils"

import type { ComponentProps, ReactNode } from "react"

interface PriceCardProps extends Omit<ComponentProps<"div">, "title"> {
  /** The amount, as plain text or a figure one em tall. */
  children: ReactNode
  /** The amount's font size, which the currency follows. */
  amountSize?: string | undefined
  currency?: string
  unit?: string
  title: ReactNode
  description?: ReactNode
  includes?: string[] | undefined
}

export function PriceCard({
  children,
  amountSize = "128px",
  currency,
  unit,
  title,
  description,
  includes,
  className,
  ...props
}: PriceCardProps) {
  return (
    <div
      className={cn(
        "@container flex min-h-80 flex-col gap-6 rounded-card p-6 text-right sm:p-8",
        card,
        className,
      )}
      {...props}
    >
      <div>
        <div
          className="flex items-start justify-end gap-[0.1em] leading-none lining-nums"
          style={{ fontSize: amountSize }}
        >
          {currency && (
            <span className="mt-[0.3em] font-mark text-[0.55em] text-muted-foreground">
              {currency}
            </span>
          )}
          <div className="tracking-tight">{children}</div>
        </div>
        {unit && <p className="mt-3 text-note text-muted-foreground">{unit}</p>}
      </div>
      <div className="ml-auto grid max-w-[40ch] gap-2">
        <h3 className="text-headline leading-tight">{title}</h3>
        {description && <p className="text-note text-muted-foreground">{description}</p>}
        {includes && (
          <ul className="mt-2 grid gap-1 text-note">
            {includes.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
