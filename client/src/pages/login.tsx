import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Shield } from "lucide-react";

export default function Login() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await login(email, password);
      if (result?.role === "admin") navigate("/admin");
      else if (!result?.emailVerified) navigate("/verify");
      else navigate("/dashboard");
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
            <Shield className="h-5 w-5" />
          </div>
          <CardTitle>Welcome back</CardTitle>
          <CardDescription>Log in to your TrustPass account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required data-testid="input-email" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required data-testid="input-password" />
            </div>
            <Button type="submit" className="w-full" disabled={loading} data-testid="button-submit-login">
              {loading ? "Logging in…" : "Log in"}
            </Button>
          </form>
          <div className="mt-6 space-y-2 text-center text-sm text-muted-foreground">
            <div>
              New to TrustPass?{" "}
              <Link href="/signup" className="font-medium text-foreground underline">Create an account</Link>
            </div>
            <div>
              <Link href="/partner/login" className="text-muted-foreground underline">Business partner login →</Link>
            </div>
          </div>
          <div className="mt-6 rounded-md border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Demo accounts</p>
            <p className="mt-1">User: alex.rivera@example.com / password123</p>
            <p>Admin: admin@trustpass.io / admin123</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
