"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, ShieldCheck } from "lucide-react";
import { useState, type ReactNode } from "react";

import { LogoutButton } from "@/components/auth/logout-button";
import type { SessionUser } from "@/lib/auth/session";
import { appNavigation, getNavigationForRole } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";

type AppShellProps = {
  children: ReactNode;
  currentUser: SessionUser;
};

export function AppShell({ children, currentUser }: AppShellProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigation = getNavigationForRole(currentUser.role);

  const activeItem =
    appNavigation.find((item) => pathname.startsWith(item.href)) ?? navigation[0] ?? appNavigation[0];

  return (
    <div className="min-h-[100dvh] bg-[radial-gradient(circle_at_top_left,_rgba(0,212,255,0.14),_transparent_24%),linear-gradient(180deg,_#111827,_#0A0E1A)] pb-24 md:pb-0">
      <div className="mx-auto flex min-h-[100dvh] max-w-7xl gap-4 px-4 py-4 md:px-6 lg:px-8">
        <aside className="hidden w-72 shrink-0 md:block">
          <div className="sticky top-4 flex h-[calc(100dvh-2rem)] flex-col rounded-[28px] border border-border bg-surface/95 p-5 shadow-panel backdrop-blur">
            <Logo />
            <div className="mt-8 rounded-2xl border border-border bg-secondary/85 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-semibold text-foreground">{currentUser.fullName}</div>
                  <div className="text-sm text-muted-foreground">{currentUser.email}</div>
                </div>
              </div>
              <Badge variant="outline" className="mt-4 w-fit capitalize">
                Rol: {currentUser.role}
              </Badge>
            </div>
            <nav className="mt-6 flex-1 space-y-2">
              {navigation.map((item) => {
                const Icon = item.icon;
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl border border-transparent px-4 py-3 text-sm transition-colors",
                      isActive
                        ? "border-primary/30 bg-primary/12 text-primary shadow-[0_0_0_1px_rgba(0,212,255,0.08)]"
                        : "text-muted-foreground hover:border-border hover:bg-secondary hover:text-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <div>
                      <div className={cn("font-semibold", isActive && "text-foreground")}>{item.label}</div>
                      <div
                        className={cn(
                          "text-xs",
                          isActive ? "text-primary" : "text-muted-foreground",
                        )}
                      >
                        {item.description}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </nav>
            <LogoutButton variant="outline" className="w-full justify-start" />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <header className="sticky top-4 z-20 rounded-[24px] border border-border bg-[#111827]/90 p-4 shadow-panel backdrop-blur md:p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="eyebrow">Operacion del acceso</div>
                <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-foreground">
                  {activeItem.label}
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  {activeItem.description}
                </p>
              </div>
              <div className="flex items-center gap-2 md:hidden">
                <LogoutButton
                  className="h-10 rounded-xl px-3"
                  label="Salir"
                  size="sm"
                  variant="outline"
                />
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Abrir menu"
                  onClick={() => setMobileMenuOpen((value) => !value)}
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </div>
            </div>
            {mobileMenuOpen ? (
              <div className="mt-4 space-y-3 md:hidden">
                <div className="rounded-2xl border border-border bg-secondary/85 p-4">
                  <div className="font-semibold text-foreground">{currentUser.fullName}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{currentUser.email}</div>
                  <Badge variant="outline" className="mt-3 w-fit capitalize">
                    Rol: {currentUser.role}
                  </Badge>
                </div>
                <nav className="grid gap-2">
                  {navigation.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname.startsWith(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm",
                          isActive
                            ? "border-primary/30 bg-primary/12 text-primary"
                            : "border-border bg-secondary/70 text-foreground",
                        )}
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <Icon className="h-4 w-4" />
                        {item.label}
                      </Link>
                    );
                  })}
                </nav>
                <LogoutButton
                  className="w-full justify-start"
                  onLoggedOut={() => setMobileMenuOpen(false)}
                  variant="outline"
                />
              </div>
            ) : null}
          </header>

          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-[#111827]/96 px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 shadow-[0_-16px_36px_rgba(0,0,0,0.32)] backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-xl grid-cols-5 gap-1">
          {navigation.slice(0, 5).map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-medium",
                  isActive ? "bg-primary/12 text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{item.shortLabel}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
