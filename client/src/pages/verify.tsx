import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Check, Upload, Camera, Loader2, ShieldCheck, AlertCircle, ExternalLink } from "lucide-react";

const STEPS = ["Profile", "Documents", "Selfie", "Review"] as const;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function Verify() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [step, setStep] = useState(0);

  const [legalName, setLegalName] = useState(user?.name || "");
  const [dob, setDob] = useState("");
  const [country, setCountry] = useState(user?.country || "");
  const [docType, setDocType] = useState("passport");
  const [docFront, setDocFront] = useState<string>("");
  const [docBack, setDocBack] = useState<string>("");
  const [selfie, setSelfie] = useState<string>("");

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const status = useQuery<any>({ queryKey: ["/api/verify/status"], refetchOnWindowFocus: false });

  // If already verified, show result
  if (status.data?.status === "verified" && !result && !loading) {
    return <VerifiedView credentialId={status.data.credentialId} expiresAt={status.data.expiresAt} level={status.data.level} onReverify={() => { apiRequest("POST", "/api/verify/reverify"); status.refetch(); navigate("/verify"); }} />;
  }

  async function submit() {
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/verify/submit", {
        legalName, dob, country, docType, docFront, docBack, selfie,
      });
      const data = await res.json();
      setResult(data);
      if (data.passed) toast({ title: "Identity verified", description: "Your TrustPass credential is live" });
    } catch (err: any) {
      const msg = err.message || "";
      if (msg.includes("422")) {
        try {
          const body = JSON.parse(msg.split(":").slice(2).join(":").trim());
          setResult(body);
        } catch {
          toast({ title: "Verification failed", description: msg, variant: "destructive" });
        }
      } else {
        toast({ title: "Error", description: msg, variant: "destructive" });
      }
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return <ResultView result={result} onRetry={() => { setResult(null); setStep(0); }} onDone={() => navigate("/dashboard")} />;
  }

  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <div className="text-center">
        <h1 className="text-xl font-bold">Verify your identity</h1>
        <p className="mt-1 text-sm text-muted-foreground">Step {step + 1} of {STEPS.length} · {STEPS[step]}</p>
      </div>
      <Progress value={progress} className="mt-4" />

      <Card className="mt-6 border-border/60">
        <CardHeader><CardTitle className="text-base">{STEPS[step]}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {step === 0 && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="legalName">Full legal name</Label>
                <Input id="legalName" value={legalName} onChange={(e) => setLegalName(e.target.value)} required data-testid="input-legalname" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dob">Date of birth</Label>
                <Input id="dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} required data-testid="input-dob" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="country">Country of residence</Label>
                <Input id="country" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="e.g. United States" required data-testid="input-country" />
              </div>
              <Button className="w-full" onClick={() => setStep(1)} disabled={!legalName || !dob || !country} data-testid="button-next-1">Continue</Button>
            </>
          )}

          {step === 1 && (
            <>
              <div className="space-y-1.5">
                <Label>Document type</Label>
                <Select value={docType} onValueChange={setDocType}>
                  <SelectTrigger data-testid="select-doctype"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="passport">Passport</SelectItem>
                    <SelectItem value="drivers_license">Driver's license</SelectItem>
                    <SelectItem value="national_id">National ID</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <UploadField label="Front of ID" value={docFront} onChange={setDocFront} testId="upload-front" />
              <UploadField label="Back of ID (optional)" value={docBack} onChange={setDocBack} testId="upload-back" />
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(0)}>Back</Button>
                <Button className="flex-1" onClick={() => setStep(2)} disabled={!docFront} data-testid="button-next-2">Continue</Button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <UploadField label="Take a selfie" value={selfie} onChange={setSelfie} capture="user" testId="upload-selfie" icon={<Camera className="h-4 w-4" />} />
              <p className="text-xs text-muted-foreground">We'll run a biometric face match and liveness check against your ID photo.</p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
                <Button className="flex-1" onClick={() => setStep(3)} disabled={!selfie} data-testid="button-next-3">Continue</Button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="space-y-2 text-sm">
                <Row label="Name" value={legalName} />
                <Row label="Date of birth" value={dob} />
                <Row label="Country" value={country} />
                <Row label="Document" value={docType.replace("_", " ")} />
                <Row label="Selfie" value={selfie ? "Captured" : "Missing"} />
              </div>
              <Button className="w-full" onClick={submit} disabled={loading} data-testid="button-submit-verify">
                {loading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying…</>) : (<><ShieldCheck className="mr-2 h-4 w-4" /> Submit for verification</>)}
              </Button>
              <p className="text-center text-xs text-muted-foreground">By submitting, you consent to identity verification. PII is AES-256 encrypted.</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function UploadField({ label, value, onChange, capture, testId, icon }: { label: string; value: string; onChange: (v: string) => void; capture?: string; testId: string; icon?: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {value ? (
        <div className="relative rounded-lg border border-border overflow-hidden">
          <img src={value} alt={label} className="h-40 w-full object-cover" />
          <Button size="sm" variant="secondary" className="absolute right-2 top-2" onClick={() => onChange("")}>Remove</Button>
        </div>
      ) : (
        <label className="flex h-40 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 hover:bg-muted/50" data-testid={testId}>
          <input type="file" accept="image/*" capture={capture as any} className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) onChange(await fileToDataUrl(f)); }} />
          {icon || <Upload className="h-5 w-5 text-muted-foreground" />}
          <span className="mt-2 text-xs text-muted-foreground">Tap to upload</span>
        </label>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-border/60 pb-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium capitalize">{value}</span>
    </div>
  );
}

function ResultView({ result, onRetry, onDone }: { result: any; onRetry: () => void; onDone: () => void }) {
  const passed = result.passed;
  const pending = result.status === "pending";
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full" style={{ background: pending ? "hsl(var(--gold)/0.12)" : passed ? "hsl(var(--gold)/0.12)" : "hsl(var(--destructive)/0.12)", color: pending ? "hsl(var(--gold))" : passed ? "hsl(var(--gold))" : "hsl(var(--destructive))" }}>
        {pending ? <Loader2 className="h-7 w-7 animate-spin" /> : passed ? <Check className="h-7 w-7" /> : <AlertCircle className="h-7 w-7" />}
      </div>
      <h1 className="text-xl font-bold">{pending ? "Awaiting blockchain confirmation" : passed ? "Verification complete" : "Verification failed"}</h1>
      {passed && !pending ? (
        <>
          <p className="mt-2 text-sm text-muted-foreground">Your TrustPass credential is now live on the Stellar blockchain.</p>
          <div className="mt-6 rounded-lg border border-border/60 bg-muted/30 p-4 text-left text-sm">
            <div className="flex justify-between py-1"><span className="text-muted-foreground">Level</span><Badge style={{ background: "hsl(var(--gold)/0.15)", color: "hsl(var(--gold))" }}>{result.level}</Badge></div>
            <div className="flex justify-between py-1"><span className="text-muted-foreground">Stellar mode</span><span className="capitalize">{result.stellarMode}</span></div>
            <div className="py-1"><span className="text-muted-foreground">Credential ID</span><p className="break-all font-mono text-xs">{result.credentialId}</p></div>
          </div>
          <Button asChild className="mt-6 w-full" onClick={onDone}><span>Go to dashboard</span></Button>
        </>
      ) : pending ? (
        <>
          <p className="mt-2 text-sm text-muted-foreground">Your KYC passed. We're writing your credential to the Stellar blockchain — this can take a moment. You'll be notified once it's confirmed.</p>
          {result.error && <p className="mt-2 text-xs text-muted-foreground">{result.error}</p>}
          <Button className="mt-6 w-full" onClick={onDone}>Back to dashboard</Button>
        </>
      ) : (
        <>
          <p className="mt-2 text-sm text-muted-foreground">{result.reason}</p>
          <p className="mt-1 text-xs text-muted-foreground">Attempts remaining: {result.remaining}{result.lockedUntil && " · locked for 24h"}</p>
          <div className="mt-6 space-y-2">
            <Button className="w-full" onClick={onRetry} disabled={result.remaining === 0}>Try again</Button>
            <Button variant="outline" className="w-full" onClick={onDone}>Back to dashboard</Button>
          </div>
        </>
      )}
    </div>
  );
}

function VerifiedView({ credentialId, expiresAt, level, onReverify }: { credentialId: string; expiresAt: string; level: string; onReverify: () => void }) {
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full" style={{ background: "hsl(var(--gold)/0.12)", color: "hsl(var(--gold))" }}>
        <Check className="h-7 w-7" />
      </div>
      <h1 className="text-xl font-bold">You're already verified</h1>
      <p className="mt-2 text-sm text-muted-foreground">Your credential is active until {new Date(expiresAt).toLocaleDateString()}.</p>
      <div className="mt-6 rounded-lg border border-border/60 bg-muted/30 p-4 text-left text-sm space-y-1">
        <div className="flex justify-between"><span className="text-muted-foreground">Level</span><Badge style={{ background: "hsl(var(--gold)/0.15)", color: "hsl(var(--gold))" }}>{level}</Badge></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Credential ID</span><a href={`https://stellar.expert/explorer/testnet/tx/${credentialId}`} target="_blank" rel="noreferrer" className="text-xs font-mono text-primary underline inline-flex items-center gap-1">{credentialId.slice(0, 10)}… <ExternalLink className="h-3 w-3" /></a></div>
      </div>
      <Button variant="outline" className="mt-6 w-full" onClick={onReverify}>Re-verify</Button>
    </div>
  );
}
