// apps/web/src/components/AppLayout.tsx
import React from 'react'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { Drawer, DrawerContent } from '@/components/ui/drawer'

interface Props {
  sidebar: React.ReactNode
  children: React.ReactNode
  linksPanel?: React.ReactNode
  showLinks: boolean
  isDrawerOpen: boolean
  onCloseDrawer: () => void
}

export default function AppLayout({
  sidebar, children, linksPanel,
  showLinks, isDrawerOpen, onCloseDrawer,
}: Props) {
  const { isMobile, isTablet, isPortrait } = useBreakpoint()
  const useDrawer = isMobile || (isTablet && isPortrait)

  return (
    <div className="flex flex-1 overflow-hidden">
      {useDrawer ? (
        <Drawer open={isDrawerOpen} onOpenChange={open => { if (!open) onCloseDrawer() }}>
          <DrawerContent>
            {sidebar}
          </DrawerContent>
        </Drawer>
      ) : (
        <div className="flex flex-col w-60 shrink-0 border-r border-border bg-background overflow-hidden">
          {sidebar}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {children}
      </div>

      {linksPanel && (
        <div
          className="overflow-hidden shrink-0 transition-[width] duration-200"
          style={{ width: showLinks ? 260 : 0 }}
        >
          {linksPanel}
        </div>
      )}
    </div>
  )
}
