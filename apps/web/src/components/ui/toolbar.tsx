import * as React from 'react'
import { cn } from '@/lib/utils'
import { Separator } from '@/components/ui/separator'

export function Toolbar({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div role="toolbar" className={cn('flex items-center gap-0.5', className)} {...props}>
      {children}
    </div>
  )
}

export function ToolbarSeparator({ className }: { className?: string }) {
  return <Separator orientation="vertical" className={cn('h-5 mx-1', className)} />
}
