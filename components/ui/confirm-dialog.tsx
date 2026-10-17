"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog"

export type ConfirmOptions = {
  title: string
  description?: string
  /** Standard: `shell.confirm.confirm` („Bestätigen“). */
  confirmLabel?: string
  /** Standard: `shell.confirm.cancel` („Abbrechen“). */
  cancelLabel?: string
  /** Bestätigen-Knopf in Warnfarbe (Löschen, Widerrufen, Rotieren …). */
  destructive?: boolean
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>

type Pending = { options: ConfirmOptions; resolve: (ok: boolean) => void }

const ConfirmContext = React.createContext<ConfirmFn | null>(null)

/**
 * Ersatz für `window.confirm()`: `const confirm = useConfirm(); if (!(await confirm({ title, … }))) return;`
 * Darstellung über `ResponsiveDialog` (ab md Dialog, darunter Bottom-Sheet), Semantik `alertdialog`.
 * „Abbrechen“ hat beim Öffnen den Fokus (sichere Voreinstellung); Escape, Schließen und Klick daneben liefern `false`.
 *
 * Gleichzeitige Aufrufe: der zweite wartet. Anfragen laufen in einer Warteschlange und werden der Reihe nach
 * angezeigt; jeder Aufruf bekommt genau seine Antwort.
 */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const t = useTranslations("shell.confirm")
  const [current, setCurrent] = React.useState<Pending | null>(null)
  const queue = React.useRef<Pending[]>([])
  const cancelRef = React.useRef<HTMLButtonElement>(null)

  const confirm = React.useCallback<ConfirmFn>(
    (options) =>
      new Promise<boolean>((resolve) => {
        const entry = { options, resolve }
        setCurrent((cur) => {
          if (cur) {
            queue.current.push(entry)
            return cur
          }
          return entry
        })
      }),
    []
  )

  const settle = React.useCallback(
    (ok: boolean) => {
      if (!current) return
      current.resolve(ok)
      setCurrent(queue.current.shift() ?? null)
    },
    [current]
  )

  const o = current?.options
  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ResponsiveDialog open={current !== null} onOpenChange={(open) => !open && settle(false)}>
        <ResponsiveDialogContent
          // key: für eine nachrückende Anfrage Fokus und Inhalt neu aufbauen
          key={current ? `${o?.title}` : "closed"}
          size="sm"
          role="alertdialog"
          onOpenAutoFocus={(e) => {
            e.preventDefault()
            cancelRef.current?.focus()
          }}
        >
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>{o?.title}</ResponsiveDialogTitle>
            <ResponsiveDialogDescription className={o?.description ? undefined : "sr-only"}>
              {o?.description ?? o?.title}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <ResponsiveDialogFooter>
            <Button ref={cancelRef} type="button" variant="outline" onClick={() => settle(false)}>
              {o?.cancelLabel ?? t("cancel")}
            </Button>
            <Button
              type="button"
              variant={o?.destructive ? "destructive" : "default"}
              onClick={() => settle(true)}
            >
              {o?.confirmLabel ?? t("confirm")}
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </ConfirmContext.Provider>
  )
}

export function useConfirm(): ConfirmFn {
  const ctx = React.useContext(ConfirmContext)
  if (!ctx) throw new Error("useConfirm braucht einen ConfirmProvider (app/(app)/layout.tsx)")
  return ctx
}
