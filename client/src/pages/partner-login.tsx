import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, auth } from "@/lib/queryClient";
import { Building2 } from "lucide-react";

export default function PartnerLogin() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/v1/partner/auth", { email, apiKey });
      const data = await res.json();
      auth.set(data.accessToken);
      auth.setPartnerKey(apiKey);
      toast({ title: "Welcome back", description: data.partner.companyName });
      navigate("/partner/dashboard");
    } catch (err: any) {
      toast({ title: "Login failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16">
      <Card className="w-full border-border/60">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-lg" style={{ background: "hsl(var(--gold)/0.12)", color: "hsl(var(--gold))" }}>
            <Building2 className="h-5 w-5" />
          </div>
          <CardTitle>Business partner login</CardTitle>
          <CardDescription>Access your API dashboard</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Company email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required data-testid="input-partner-email" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="apiKey">API key</Label>
              <Input id="apiKey" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} required data-testid="input-partner-apikey" />
            </div>
            <Button type="submit" className="w-full" disabled={loading} data-testid="button-partner-login">
              {loading ? "Logging in…" : "Log in"}
            </Button>
          </form>
          <div className="mt-6 rounded-md border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Demo partner</p>
            <p className="mt-1">api@novaexchange.io</p>
            <p className="break-all">Run <code>npm run seed</code> and check console output for the API key.</p>
          </div>
          <div className="mt-4 text-center text-sm">
            <Link href="/login" className="text-muted-foreground underline">Individual user? Log in here →</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
