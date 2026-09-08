import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, auth } from "@/lib/queryClient";
import { Search, KeyRound, Webhook, BarChart3, ShieldCheck, Copy } from "lucide-react";

export default function PartnerDashboard() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [lookupEmail, setLookupEmail] = useState("");
  const [lookupResult, setLookupResult] = useState<any>(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);

  const usage = useQuery<any>({ queryKey: ["/api/v1/usage"], refetchOnWindowFocus: false });

  const verify = useMutation({
    mutationFn: (email: string) => apiRequest("POST", "/api/v1/verify", { email, accessType: "query", purpose: "User verification" }),
    onSuccess: async (res) => setLookupResult(await res.json()),
    onError: async (e: any) => {
      try { setLookupResult({ passed: false, reason: e.message }); } catch { setLookupResult({ passed: false, reason: String(e) }); }
    },
  });

  const registerHook = useMutation({
    mutationFn: (url: string) => apiRequest("POST", "/api/v1/webhook/register", { webhookUrl: url }),
    onSuccess: async (res) => { const d = await res.json(); toast({ title: "Webhook registered" }); setNewKey(null); },
  });

  const rotate = useMutation({
    mutationFn: () => apiRequest("POST", "/api/v1/apikeys/rotate", {}),
    onSuccess: async (res) => { const d = await res.json(); setNewKey(d.apiKey); auth.setPartnerKey(d.apiKey); toast({ title: "API key rotated" }); },
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-xl font-bold">Business dashboard</h1>
      <p className="text-sm text-muted-foreground">Verify your customers and manage your API credentials.</p>

      <div className="mt-6 grid gap-6 md:grid-cols-3">
        <Stat icon={Search} label="Total verifications" value={String(usage.data?.totalVerifications ?? 0)} />
        <Stat icon={ShieldCheck} label="Successful" value={String(usage.data?.successfulVerifications ?? 0)} />
        <Stat icon={BarChart3} label="Success rate" value={usage.data?.totalVerifications ? `${Math.round((usage.data.successfulVerifications / usage.data.totalVerifications) * 100)}%` : "—"} />
      </div>

      {/* Credential lookup */}
      <Card className="mt-6 border-border/60">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Search className="h-4 w-4" /> Verify a user</CardTitle>
          <CardDescription>Look up a user's TrustPass status by email. No PII is returned.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={(e) => { e.preventDefault(); verify.mutate(lookupEmail); }} className="flex gap-2">
            <Input type="email" placeholder="user@example.com" value={lookupEmail} onChange={(e) => setLookupEmail(e.target.value)} required data-testid="input-lookup-email" />
            <Button type="submit" disabled={verify.isPending} data-testid="button-lookup">Verify</Button>
          </form>
          {lookupResult && (
            <div className="rounded-lg border border-border/60 p-4 text-sm" data-testid="div-lookup-result">
              {lookupResult.passed ? (
                <div className="space-y-2">
                  <Badge style={{ background: "hsl(var(--gold)/0.15)", color: "hsl(var(--gold))" }}>VERIFIED · {lookupResult.level}</Badge>
                  <p className="text-muted-foreground">User is verified. Credential valid until {lookupResult.expiresAt && new Date(lookupResult.expiresAt).toLocaleDateString()}.</p>
                  <div className="rounded-md bg-muted/30 p-2">
                    <p className="text-xs text-muted-foreground">Status / {lookupResult.status}</p>
                    <p className="text-xs font-mono break-all">{lookupResult.credentialId}</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2"><Badge variant="destructive">{lookupResult.status}</Badge> <span className="text-muted-foreground">{lookupResult.reason}</span></div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* API key */}
      <Card className="mt-6 border-border/60">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><KeyRound className="h-4 w-4" /> API key</CardTitle>
          <CardDescription>Rotate your key at any time. The new key is shown once.</CardDescription>
        </CardHeader>
        <CardContent>
          {newKey ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 p-3">
                <code className="flex-1 break-all text-xs">{newKey}</code>
                <Button size="sm" variant="ghost" onClick={() => navigator.clipboard.writeText(newKey)}><Copy className="h-3 w-3" /></Button>
              </div>
              <Button variant="outline" size="sm" onClick={() => setNewKey(null)}>Done</Button>
            </div>
          ) : (
            <Button variant="outline" onClick={() => rotate.mutate()} disabled={rotate.isPending} data-testid="button-rotate">Rotate API key</Button>
          )}
        </CardContent>
      </Card>

      {/* Webhooks */}
      <Card className="mt-6 border-border/60">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Webhook className="h-4 w-4" /> Webhooks</CardTitle>
          <CardDescription>Register a URL to receive status events (verified, expired, revoked).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={(e) => { e.preventDefault(); registerHook.mutate(webhookUrl); setWebhookUrl(""); }} className="flex gap-2">
            <Input type="url" placeholder="https://yourapp.com/webhooks/trustpass" value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} required data-testid="input-webhook-url" />
            <Button type="submit" variant="outline" disabled={registerHook.isPending}>Register</Button>
          </form>
        </CardContent>
      </Card>

      <div className="mt-6 flex justify-between">
        <Button asChild variant="ghost" size="sm"><Link href="/partner/docs">View API docs →</Link></Button>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <Card className="border-border/60">
      <CardContent className="flex items-center gap-3 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: "hsl(var(--gold)/0.12)", color: "hsl(var(--gold))" }}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
