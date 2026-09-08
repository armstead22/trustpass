import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { ShieldCheck, Mail, ArrowRight } from "lucide-react";

export default function Signup() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"signup" | "verify">("signup");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await apiRequest("POST", "/api/auth/signup", { email, password, name });
      setStep("verify");
      toast({ title: "Verification code sent", description: `We sent a code to ${email}` });
    } catch (err: any) {
      toast({ title: "Sign up failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await apiRequest("POST", "/api/auth/verify-email", { email, code });
      await login(email, password);
      toast({ title: "Email verified", description: "Welcome to TrustPass" });
      navigate("/verify");
    } catch (err: any) {
      toast({ title: "Verification failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16">
      <Card className="w-full border-border/60">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-lg" style={{ background: "hsl(var(--gold)/0.12)", color: "hsl(var(--gold))" }}>
            <ShieldCheck className="h-5 w-5" />
          </div>
          <CardTitle>{step === "signup" ? "Create your account" : "Verify your email"}</CardTitle>
          <CardDescription>
            {step === "signup" ? "Start your TrustPass verification" : `Enter the code sent to ${email}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === "signup" ? (
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Full name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required data-testid="input-name" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required data-testid="input-email" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} data-testid="input-password" />
                <p className="text-xs text-muted-foreground">Minimum 8 characters</p>
              </div>
              <Button type="submit" className="w-full" disabled={loading} data-testid="button-submit-signup">
                {loading ? "Creating…" : "Create account"} <Mail className="ml-2 h-4 w-4" />
              </Button>
            </form>
          ) : (
            <form onSubmit={verifyCode} className="space-y-4">
              <div className="flex justify-center">
                <InputOTP maxLength={6} value={code} onChange={setCode} data-testid="input-otp">
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <p className="text-center text-xs text-muted-foreground">Demo: the code is also printed in the server logs.</p>
              <Button type="submit" className="w-full" disabled={loading || code.length < 6} data-testid="button-verify-code">
                {loading ? "Verifying…" : "Verify email"} <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button type="button" variant="ghost" size="sm" className="w-full" onClick={() => setStep("signup")}>Back</Button>
            </form>
          )}
          <div className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-foreground underline">Log in</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
