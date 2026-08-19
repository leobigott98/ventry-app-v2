"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, ShieldCheck, X } from "lucide-react";
import { useState, type ReactNode } from "react";

import { LogoutButton } from "@/components/auth/logout-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { SessionUser } from "@/lib/auth/session";
import { getNavigationForRole, type AppNavItem } from "@/lib/navigation";
import { cn } from "@/lib/utils";

type AppShellProps = {
  children: ReactNode;
  currentUser: SessionUser;
};

const roleLabels: Record<SessionUser["role"], string> = {
  admin: "Administrador",
  guard: "Guardia",
  resident: "Residente",
};

function itemIsActive(pathname: string, href: AppNavItem["href"]) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Brand({ inverse = false, compact = false }: { inverse?: boolean; compact?: boolean }) {
  return (
    <Link
      aria-label="Ventry, ir al inicio"
      className={cn("flex min-h-11 items-center gap-3 rounded-md", inverse ? "text-white focus-visible:outline-white" : "text-foreground")}
      href="/app/dashboard"
    >
      <span
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border",
          inverse ? "border-white/15 bg-white/10 text-white" : "border-primary/20 bg-secondary text-primary",
        )}
      >
        <ShieldCheck aria-hidden="true" className="h-5 w-5" />
      </span>
      <span className={cn("min-w-0", compact && "md:hidden xl:block")}>
        <span className="block text-base font-bold tracking-tight">Ventry</span>
        <span className={cn("block text-xs", inverse ? "text-white/80" : "text-muted-foreground")}>
          Control de acceso
        </span>
      </span>
    </Link>
  );
}

function UserInitials({ currentUser }: { currentUser: SessionUser }) {
  const initials = currentUser.fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-bold text-primary">
      {initials}
    </span>
  );
}

function SidebarNavigation({
  compact = false,
  navigation,
  pathname,
}: {
  compact?: boolean;
  navigation: AppNavItem[];
  pathname: string;
}) {
  return (
    <nav aria-label="Navegación principal" className="mt-7 flex-1 space-y-1.5">
      {navigation.map((item) => {
        const Icon = item.icon;
        const active = itemIsActive(pathname, item.href);

        return (
          <Link
            key={item.href}
            aria-label={compact ? item.label : undefined}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex min-h-12 items-center gap-3 rounded-md border border-transparent px-3 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-white",
              active
                ? "border-white/10 bg-white/15 text-white"
                : "text-sidebar-muted hover:bg-white/10 hover:text-white",
              compact && "md:justify-center md:px-2 xl:justify-start xl:px-3",
            )}
            href={item.href}
            title={compact ? item.label : undefined}
          >
            <Icon aria-hidden="true" className="h-5 w-5 shrink-0" />
            <span className={cn(compact && "md:hidden xl:inline")}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function MobileNavigation({
  navigation,
  onNavigate,
  pathname,
}: {
  navigation: AppNavItem[];
  onNavigate: () => void;
  pathname: string;
}) {
  return (
    <nav aria-label="Navegación móvil" className="grid gap-2">
      {navigation.map((item) => {
        const Icon = item.icon;
        const active = itemIsActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-12 items-center gap-3 rounded-md border px-4 py-3 text-sm font-semibold",
              active ? "border-primary/25 bg-secondary text-primary" : "border-border bg-surface text-foreground",
            )}
            href={item.href}
            onClick={onNavigate}
          >
            <Icon aria-hidden="true" className="h-5 w-5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function ResidentShell({
  activeItem,
  children,
  currentUser,
  navigation,
  pathname,
}: AppShellProps & {
  activeItem: AppNavItem;
  navigation: AppNavItem[];
  pathname: string;
}) {
  return (
    <div data-role-shell="resident" className="min-h-[100dvh] bg-background pb-24 lg:pb-0">
      <header className="bg-primary text-primary-foreground shadow-elevated">
        <div className="mx-auto max-w-6xl px-4 pb-5 pt-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-3">
            <Brand inverse />
            <div className="flex items-center gap-2">
              <div className="hidden text-right sm:block">
                <div className="text-sm font-semibold">{currentUser.fullName}</div>
                <div className="text-xs text-white/80">{roleLabels[currentUser.role]}</div>
              </div>
              <LogoutButton
                aria-label="Cerrar sesión"
                className="border-white/25 bg-white/10 px-3 text-white hover:bg-white/20"
                label="Salir"
                size="sm"
                variant="outline"
              />
            </div>
          </div>
          <div className="mt-5 lg:flex lg:items-end lg:justify-between lg:gap-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">Ventry residente</p>
              <h1 className="mt-1 text-xl font-bold sm:text-2xl">{activeItem.label}</h1>
            </div>
            <nav aria-label="Navegación de residente para escritorio" className="mt-5 hidden gap-2 lg:flex">
              {navigation.map((item) => {
                const Icon = item.icon;
                const active = itemIsActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-11 items-center gap-2 rounded-md px-4 text-sm font-semibold transition-colors focus-visible:outline-white",
                      active ? "bg-white text-primary" : "bg-white/10 text-white hover:bg-white/20",
                    )}
                    href={item.href}
                  >
                    <Icon aria-hidden="true" className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-4 sm:px-6 sm:py-7 lg:px-8">{children}</main>

      <nav
        aria-label="Navegación principal del residente"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 shadow-[0_-10px_30px_rgba(12,18,33,0.1)] backdrop-blur lg:hidden"
        data-testid="resident-bottom-navigation"
      >
        <div className="mx-auto grid max-w-xl grid-flow-col auto-cols-fr gap-1">
          {navigation.slice(0, 4).map((item) => {
            const Icon = item.icon;
            const active = itemIsActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs font-semibold",
                  active ? "bg-secondary text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
                href={item.href}
              >
                <Icon aria-hidden="true" className="h-5 w-5" />
                <span>{item.shortLabel}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function WorkspaceShell({
  activeItem,
  children,
  currentUser,
  mobileMenuOpen,
  navigation,
  onMobileMenuChange,
  pathname,
}: AppShellProps & {
  activeItem: AppNavItem;
  mobileMenuOpen: boolean;
  navigation: AppNavItem[];
  onMobileMenuChange: (open: boolean) => void;
  pathname: string;
}) {
  const admin = currentUser.role === "admin";

  return (
    <div
      data-role-shell={currentUser.role}
      className={cn(
        "min-h-[100dvh] bg-background md:grid",
        admin ? "md:grid-cols-[5.5rem_minmax(0,1fr)] xl:grid-cols-[17.5rem_minmax(0,1fr)]" : "md:grid-cols-[16rem_minmax(0,1fr)]",
      )}
    >
      <aside
        className={cn(
          "sticky top-0 hidden h-[100dvh] flex-col overflow-y-auto bg-sidebar p-4 text-sidebar-foreground md:flex",
          admin && "md:px-3 xl:px-4",
        )}
        data-testid="desktop-sidebar"
      >
        <Brand compact={admin} inverse />
        {!admin ? (
          <div className="mt-6 rounded-lg border border-white/10 bg-white/10 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              Turno operativo
            </div>
            <p className="mt-2 text-xs leading-5 text-sidebar-muted">Acciones de garita listas para validación.</p>
          </div>
        ) : null}
        <SidebarNavigation compact={admin} navigation={navigation} pathname={pathname} />
        <div className={cn("mt-5 border-t border-white/10 pt-4", admin && "md:flex md:justify-center xl:block")}>
          <div className={cn("mb-3 flex items-center gap-3", admin && "md:hidden xl:flex")}>
            <UserInitials currentUser={currentUser} />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-white">{currentUser.fullName}</div>
              <div className="truncate text-xs text-sidebar-muted">{roleLabels[currentUser.role]}</div>
            </div>
          </div>
          <LogoutButton
            aria-label="Cerrar sesión"
            className={cn(
              "w-full border-white/15 bg-white/10 text-white hover:bg-white/15",
              "focus-visible:ring-white/70 focus-visible:ring-offset-sidebar",
              admin && "md:w-12 md:px-0 xl:w-full xl:px-4",
            )}
            label={admin ? "Salir" : "Cerrar sesión"}
            labelClassName={admin ? "md:hidden xl:inline" : undefined}
            variant="outline"
          />
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-20 border-b border-border bg-surface/95 px-4 py-3 shadow-sm backdrop-blur sm:px-6 lg:px-8">
          <div className="mx-auto flex min-h-14 max-w-[100rem] items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <Button
                aria-controls="mobile-role-navigation"
                aria-expanded={mobileMenuOpen}
                aria-label={mobileMenuOpen ? "Cerrar navegación" : "Abrir navegación"}
                className="md:hidden"
                onClick={() => onMobileMenuChange(!mobileMenuOpen)}
                size="icon"
                variant="outline"
              >
                {mobileMenuOpen ? <X aria-hidden="true" className="h-5 w-5" /> : <Menu aria-hidden="true" className="h-5 w-5" />}
              </Button>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
                  {admin ? "Administración" : "Workspace de garita"}
                </p>
                <h1 className="truncate text-xl font-bold text-foreground sm:text-2xl">{activeItem.label}</h1>
              </div>
            </div>
            <div className="hidden items-center gap-3 sm:flex">
              {!admin ? <Badge variant="success">Operativo</Badge> : null}
              <div className="text-right">
                <div className="text-sm font-semibold text-foreground">{currentUser.fullName}</div>
                <div className="text-xs text-muted-foreground">{roleLabels[currentUser.role]}</div>
              </div>
              <UserInitials currentUser={currentUser} />
            </div>
          </div>

          {mobileMenuOpen ? (
            <div id="mobile-role-navigation" className="mx-auto max-w-[100rem] space-y-3 border-t border-border pb-2 pt-4 md:hidden">
              <MobileNavigation
                navigation={navigation}
                onNavigate={() => onMobileMenuChange(false)}
                pathname={pathname}
              />
              <LogoutButton
                className="w-full justify-start"
                onLoggedOut={() => onMobileMenuChange(false)}
                variant="outline"
              />
            </div>
          ) : null}
        </header>

        <main
          className={cn(
            "mx-auto w-full px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8",
            admin ? "max-w-[100rem]" : "max-w-[105rem]",
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

export function AppShell({ children, currentUser }: AppShellProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigation = getNavigationForRole(currentUser.role);
  const activeItem = navigation.find((item) => itemIsActive(pathname, item.href)) ?? navigation[0]!;

  if (currentUser.role === "resident") {
    return (
      <ResidentShell
        activeItem={activeItem}
        currentUser={currentUser}
        navigation={navigation}
        pathname={pathname}
      >
        {children}
      </ResidentShell>
    );
  }

  return (
    <WorkspaceShell
      activeItem={activeItem}
      currentUser={currentUser}
      mobileMenuOpen={mobileMenuOpen}
      navigation={navigation}
      onMobileMenuChange={setMobileMenuOpen}
      pathname={pathname}
    >
      {children}
    </WorkspaceShell>
  );
}
