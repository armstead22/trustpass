import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { ShieldCheck, Clock, Link2, ExternalLink, RefreshCw, Lock, AlertCircle, CheckCircle2, Award } from "lucide-react";

const STATUS_STYLES: Record<string, string> = {
  verified: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  rejected: "bg-red-500/10 text-red-600 dark:text-red-400",
  expired: "bg-red-500/10 text-red-600 dark:text-red-400",
  not_started: "bg-muted text-muted-foreground",
};

export default function Dashboard() {
  const data = useQuery<any>({
    queryKey: ["/api/dashboard"],
    refetchOnWindowFocus: false,
  });

  const v = data.data?.verification;
  const user = data.data?.user;
  const platforms = data.data?.connectedPlatforms ?? [];

  if (data.isLoading) return <div className="py-20 text-center text-sm text-muted-foreground">Loading…</div>;

  const status = v?.status || "not_started";

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-xl font-bold">Dashboard</h1>
      <p className="text-sm text-muted-foreground">Welcome, {user?.name}</p>

      {/* Status card */}
      <Card className="mt-6 border-border/60">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Verification status</CardTitle>
            <Badge className={STATUS_STYLES[status]} data-testid="badge-status">
              {status === "verified" && <CheckCircle2 className="mr-1 h-3 w-3" />}
              {status === "not_started" ? "Not started" : status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {status !== "verified" ? (
            <div>
              <CardDescription className="mb-4">
                {status === "rejected" ? "Your last verification attempt was rejected. Please try again." : "Complete your identity verification to get a reusable TrustPass credential."}
              </CardDescription>
              <Button asChild data-testid="link-verify"><Link href="/verify"><ShieldCheck className="mr-2 h-4 w-4" /> {status === "rejected" ? "Try again" : "Get verified"}</Link></Button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <InfoRow icon={Link2} label="Credential ID">
                <a href={`https://stellar.expert/explorer/testnet/tx/${v.credentialId}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-xs text-primary underline" data-testid="link-credential">
                  {v.credentialId.slice(0, 16)}… <ExternalLink className="h-3 w-3" />
                </a>
              </InfoRow>
              <InfoRow icon={Award} label="Verification level">
                <Badge style={{ background: "hsl(var(--gold)/0.15)", color: "hsl(var(--gold))" }} className="capitalize">{v.level}</Badge>
              </InfoRow>
              <InfoRow icon={CheckCircle2} label="Verified on">
                <span className="text-sm">{new Date(v.verifiedAt).toLocaleDateString()}</span>
              </InfoRow>
              <InfoRow icon={Clock} label="Expires">
                <span className="text-sm">{new Date(v.expiresAt).toLocaleDateString()}</span>
              </InfoRow>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Connected platforms */}
      <Card className="mt-6 border-border/60">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Connected platforms</CardTitle>
            <Button asChild variant="ghost" size="sm"><Link href="/dashboard/privacy"><Lock className="mr-1 h-3 w-3" /> Manage</Link></Button>
          </div>
          <CardDescription>Businesses that have accessed your credential</CardDescription>
        </CardHeader>
        <CardContent>
          {platforms.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center text-sm text-muted-foreground">
              <Link2 className="h-8 w-8 mb-2 opacity-40" />
              No platforms have accessed your credential yet.
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {platforms.map((p: any) => (
                <div key={p.partnerId} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium">{p.company}</p>
                    <p className="text-xs text-muted-foreground">Accessed {new Date(p.accessedAt).toLocaleDateString()} · {p.accessType}</p>
                  </div>
                  <Badge variant="outline" className="capitalize text-xs">{p.accessType}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {status === "verified" && (
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild variant="outline"><Link href="/verify"><RefreshCw className="mr-2 h-4 w-4" /> Re-verify</Link></Button>
          <Button asChild variant="outline"><Link href="/dashboard/privacy"><Lock className="mr-2 h-4 w-4" /> Privacy controls</Link></Button>
        </div>
      )}

      <Card className="mt-6 border-border/60 bg-muted/30">
        <CardContent className="flex items-start gap-3 py-4 text-sm text-muted-foreground">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>Demo mode: KYC checks and Stellar attestation are mocked. PII is still genuinely AES-256 encrypted at rest.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function InfoRow({ icon: Icon, label, children }: { icon: any; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/60 p-3">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="mt-0.5">{children}</div>
      </div>
    </div>
  );
}
