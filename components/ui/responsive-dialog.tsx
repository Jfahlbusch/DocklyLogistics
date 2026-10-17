"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { MD_QUERY, useMediaQuery } from "@/hooks/use-media-query"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

/**
 * Dialog, der ab `md` (768 px) als zentrierter Dialog und darunter als Bottom-Sheet mit Griff erscheint.
 * API wie Radix-Dialog: Titel ist Pflicht (Barrierefreiheit), Escape und Fokusfalle kommen von Radix.
 * Vor der Hydration gilt der Dialog.
 *
 * Umstellung (mechanisch):
 * ```tsx
 * // vorher
 * <Dialog open={open} onOpenChange={setOpen}>
 *   <DialogContent className="sm:max-w-lg">
 *     <DialogHeader><DialogTitle>Titel</DialogTitle></DialogHeader>
 *     …Formular…
 *   </DialogContent>
 * </Dialog>
 * // nachher
 * <ResponsiveDialog open={open} onOpenChange={setOpen}>
 *   <ResponsiveDialogContent size="lg">
 *     <ResponsiveDialogHeader><ResponsiveDialogTitle>Titel</ResponsiveDialogTitle></ResponsiveDialogHeader>
 *     <ResponsiveDialogBody>…Formular…</ResponsiveDialogBody>
 *     <ResponsiveDialogFooter>…Knöpfe…</ResponsiveDialogFooter>
 *   </ResponsiveDialogContent>
 * </ResponsiveDialog>
 * ```
 * Soll die Fußzeile beim Scrollen sichtbar bleiben und ein `<form>` umschließen, steht das `<form>` zwischen
 * Content und Body/Footer mit `className="flex min-h-0 flex-1 flex-col"`.
 */
const ResponsiveDialogContext = React.createContext<boolean>(true)

type RootProps = React.ComponentProps<typeof Dialog>

function ResponsiveDialog(props: RootProps) {
  const isDesktop = useMediaQuery(MD_QUERY, true)
  return (
    <ResponsiveDialogContext.Provider value={isDesktop}>
      {isDesktop ? <Dialog {...props} /> : <Sheet {...props} />}
    </ResponsiveDialogContext.Provider>
  )
}

const SIZE_CLASS = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-4xl",
} as const

type ContentProps = Omit<React.ComponentProps<typeof DialogContent>, "size"> & {
  /** Desktop-Breite; mobil immer volle Breite. Standard `md`. */
  size?: keyof typeof SIZE_CLASS
}

function ResponsiveDialogContent({
  className,
  children,
  size = "md",
  showCloseButton = true,
  ...props
}: ContentProps) {
  const isDesktop = React.useContext(ResponsiveDialogContext)
  if (isDesktop) {
    return (
      <DialogContent
        showCloseButton={showCloseButton}
        className={cn(
          "flex flex-col gap-0 overflow-hidden p-0",
          SIZE_CLASS[size],
          className
        )}
        {...props}
      >
        {children}
      </DialogContent>
    )
  }
  return (
    <SheetContent
      side="bottom"
      showCloseButton={showCloseButton}
      className={cn("gap-0 overflow-hidden", className)}
      {...props}
    >
      <div
        data-slot="responsive-dialog-handle"
        aria-hidden="true"
        className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-muted-foreground/30"
      />
      {children}
    </SheetContent>
  )
}

function ResponsiveDialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  const isDesktop = React.useContext(ResponsiveDialogContext)
  // Rechts Platz für den Schließen-Knopf lassen (mobil 44 px).
  const cls = cn("shrink-0 gap-1 p-4 pr-14 md:pr-12", className)
  return isDesktop ? <DialogHeader className={cls} {...props} /> : <SheetHeader className={cls} {...props} />
}

function ResponsiveDialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogTitle>) {
  const isDesktop = React.useContext(ResponsiveDialogContext)
  return isDesktop ? (
    <DialogTitle className={className} {...props} />
  ) : (
    <SheetTitle className={className} {...props} />
  )
}

function ResponsiveDialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogDescription>) {
  const isDesktop = React.useContext(ResponsiveDialogContext)
  return isDesktop ? (
    <DialogDescription className={className} {...props} />
  ) : (
    <SheetDescription className={className} {...props} />
  )
}

/** Scrollbarer Inhaltsbereich zwischen Kopf und Fußzeile. */
function ResponsiveDialogBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="responsive-dialog-body"
      className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-2", className)}
      {...props}
    />
  )
}

/** Fußzeile klebt unten; mobil Knöpfe volle Breite gestapelt, ab `md` rechtsbündig nebeneinander. */
function ResponsiveDialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="responsive-dialog-footer"
      className={cn(
        "sticky bottom-0 z-10 flex shrink-0 gap-2 border-t bg-popover p-4 max-md:flex-col max-md:*:w-full md:flex-row md:justify-end",
        className
      )}
      {...props}
    />
  )
}

export {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
  ResponsiveDialogBody,
  ResponsiveDialogFooter,
}
