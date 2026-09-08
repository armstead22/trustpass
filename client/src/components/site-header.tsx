import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { LogoWordmark } from "./logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { Bell, Sun, Moon, Shield, LogOut, Menu } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export function useTheme() {
  const [dark, setDark] = useState<boolean>(() =>
    typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches
  );
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);
  return { dark, toggle: () => setDark((d) => !d) };
}

export function SiteHeader() {
  const { user, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const notifs = useQuery<{ id: number; message: string; read: boolean; type: string }[]>({
    queryKey: ["/api/notifications"],
    enabled: !!user,
  });
  const unread = notifs.data?.filter((n) => !n.read).length ?? 0;

  const markRead = useCallback(async (id: number) => {
    await apiRequest("POST", `/api/notifications/${id}/read`);
    notifs.refetch();
  }, [notifs]);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center" data-testid="link-home">
          <LogoWordmark />
        </Link>

        <nav className="hidden md:flex items-center gap-1 text-sm">
          <Button asChild variant="ghost" size="sm"><Link href="/">Home</Link></Button>
          {user ? (
            <>
              <Button asChild variant="ghost" size="sm"><Link href="/dashboard">Dashboard</Link></Button>
              {user.role === "admin" && <Button asChild variant="ghost" size="sm"><Link href="/admin">Admin</Link></Button>}
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm"><Link href="/partner/dashboard">For Businesses</Link></Button>
              <Button asChild variant="ghost" size="sm"><Link href="/login">Log in</Link></Button>
              <Button asChild size="sm"><Link href="/signup">Get Verified</Link></Button>
            </>
          )}
        </nav>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme" data-testid="button-theme">
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Notifications" data-testid="button-notifications">
                  <Bell className="h-4 w-4" />
                  {unread > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-accent" />}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Notifications</div>
                <DropdownMenuSeparator />
                {(notifs.data ?? []).slice(0, 10).map((n) => (
                  <DropdownMenuItem key={n.id} onClick={() => markRead(n.id)} className="flex-col items-start gap-0.5 py-2">
                    <span className="text-xs font-medium">{n.type}</span>
                    <span className="text-xs text-muted-foreground line-clamp-2">{n.message}</span>
                  </DropdownMenuItem>
                ))}
                {(notifs.data ?? []).length === 0 && (
                  <div className="px-2 py-4 text-center text-xs text-muted-foreground">No notifications</div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" data-testid="button-account">
                  <Shield className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium truncate">{user.email}</p>
                  <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild><Link href="/dashboard">Dashboard</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link href="/dashboard/privacy">Privacy</Link></DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} data-testid="button-logout"><LogOut className="mr-2 h-4 w-4" />Log out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen(!open)}>
              <Menu className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      {open && !user && (
        <div className="md:hidden border-t border-border bg-background px-4 py-2 text-sm">
          <Link href="/login" className="block py-1" onClick={() => setOpen(false)}>Log in</Link>
          <Link href="/signup" className="block py-1" onClick={() => setOpen(false)}>Get Verified</Link>
          <Link href="/partner/dashboard" className="block py-1" onClick={() => setOpen(false)}>For Businesses</Link>
        </div>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 mt-12">
      <div className="mx-auto max-w-6xl px-4 py-8 flex flex-col md:flex-row justify-between gap-4 text-sm text-muted-foreground">
        <div>
          <LogoWordmark className="h-6 w-6" />
          <p className="mt-2 max-w-xs">Verify once. Access everywhere. Blockchain-backed identity verification.</p>
        </div>
        <div className="flex gap-6">
          <Link href="/partner/dashboard">Businesses</Link>
          <Link href="/partner/docs">API Docs</Link>
          <a href="https://stellar.expert/explorer/testnet" target="_blank" rel="noreferrer">Stellar Explorer</a>
        </div>
      </div>
    </footer>
  );
}
