import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Fingerprint, Link2, Zap, Lock, Globe, CheckCircle2, ArrowRight } from "lucide-react";

export default function Landing() {
  return (
    <div className="overflow-hidden">
      {/* Hero */}
      <section className="relative tp-hero-gradient text-white">
        <div className="absolute inset-0 tp-grid-bg opacity-40" />
        <div className="relative mx-auto max-w-6xl px-4 py-20 md:py-28">
          <Badge className="mb-6 bg-white/10 text-white border-white/20 backdrop-blur">
            <Shield className="mr-1.5 h-3 w-3" /> Built on Stellar
          </Badge>
          <h1 className="max-w-3xl text-4xl md:text-5xl font-bold leading-[1.1] tracking-tight">
            Verify once. <span className="text-[hsl(var(--gold))]">Access everywhere.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-white/70">
            TrustPass is a blockchain-based identity verification platform. Complete KYC once and
            reuse your verified credential across exchanges, fintechs, and DeFi — without re-uploading documents.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" data-testid="link-cta-verify">
              <Link href="/signup">Get Verified <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="bg-white/5 border-white/20 text-white hover:bg-white/10 hover:text-white" data-testid="link-cta-business">
              <Link href="/partner/dashboard">For Businesses</Link>
            </Button>
          </div>
          <p className="mt-4 text-xs text-white/50">Demo mode · Mock KYC & Stellar testnet-ready · No real PII collected</p>
        </div>
      </section>

      {/* Stats */}
      <section className="border-b border-border/60 bg-background">
        <div className="mx-auto grid max-w-6xl grid-cols-2 md:grid-cols-4 gap-px bg-border/40">
          {[
            { k: "1×", v: "KYC, reused everywhere" },
            { k: "AES-256", v: "PII encrypted at rest" },
            { k: "12 mo", v: "Credential validity" },
            { k: "GDPR", v: "Right to be forgotten" },
          ].map((s) => (
            <div key={s.k} className="bg-background px-4 py-6 text-center">
              <div className="text-2xl font-bold" style={{ color: "hsl(var(--gold))" }}>{s.k}</div>
              <div className="mt-1 text-xs text-muted-foreground">{s.v}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-4 py-16 md:py-24">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">How TrustPass works</h2>
          <p className="mt-2 text-muted-foreground">Three steps from sign-up to a reusable, on-chain credential.</p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {[
            { icon: Fingerprint, title: "1. Verify your identity", body: "Submit your ID and a selfie. Our KYC provider checks document authenticity and runs a biometric face match." },
            { icon: Link2, title: "2. Blockchain attestation", body: "On success, a tamper-proof attestation is written to the Stellar blockchain. The transaction hash becomes your Credential ID." },
            { icon: Zap, title: "3. Reuse everywhere", body: "Share your Credential ID with any TrustPass partner. They verify your status instantly — no documents, no PII shared." },
          ].map((step) => (
            <Card key={step.title} className="border-border/60">
              <CardHeader>
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: "hsl(var(--gold)/0.12)", color: "hsl(var(--gold))" }}>
                  <step.icon className="h-5 w-5" />
                </div>
                <CardTitle className="text-base">{step.title}</CardTitle>
                <CardDescription className="text-sm">{step.body}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      {/* Feature grid */}
      <section className="bg-muted/30 border-y border-border/60">
        <div className="mx-auto max-w-6xl px-4 py-16 md:py-24">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-center">Built for trust, by design</h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: Lock, title: "Privacy-first", body: "PII is AES-256 encrypted at rest. Partners only ever see verification status — never raw documents." },
              { icon: Shield, title: "Tamper-proof", body: "Credentials are anchored on the Stellar blockchain. Anyone can verify the attestation independently." },
              { icon: Globe, title: "GDPR compliant", body: "Export your data or delete your account at any time. We retain only an anonymized on-chain record." },
              { icon: CheckCircle2, title: "Real-time status", body: "Partners get instant lookup via API with webhooks for expiry, revocation, and status changes." },
              { icon: Fingerprint, title: "Biometric match", body: "Selfie-to-ID face match with liveness checks, with retry and lockout controls." },
              { icon: Zap, title: "Developer-ready", body: "Clean REST API with Swagger docs, API key rotation, and usage analytics out of the box." },
            ].map((f) => (
              <div key={f.title} className="rounded-lg border border-border/60 bg-background p-5">
                <f.icon className="h-5 w-5" style={{ color: "hsl(var(--gold))" }} />
                <h3 className="mt-3 font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing teaser */}
      <section className="mx-auto max-w-6xl px-4 py-16 md:py-24">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Simple, usage-based pricing</h2>
          <p className="mt-2 text-muted-foreground">For businesses verifying their users via TrustPass.</p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {[
            { name: "Starter", price: "$0", per: "/mo", features: ["100 verifications/mo", "API + webhooks", "Status lookup"], cta: "Start free" },
            { name: "Growth", price: "$199", per: "/mo", features: ["5,000 verifications/mo", "Usage analytics", "Priority support"], cta: "Choose Growth", featured: true },
            { name: "Enterprise", price: "Custom", per: "", features: ["Unlimited verifications", "Dedicated SLA", "Custom integrations"], cta: "Contact sales" },
          ].map((p) => (
            <Card key={p.name} className={p.featured ? "border-[hsl(var(--gold))] border-2" : "border-border/60"}>
              <CardHeader>
                <CardTitle className="text-base">{p.name}</CardTitle>
                <div className="mt-2"><span className="text-3xl font-bold">{p.price}</span><span className="text-sm text-muted-foreground">{p.per}</span></div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" style={{ color: "hsl(var(--gold))" }} /> {f}
                    </li>
                  ))}
                </ul>
                <Button asChild className="mt-6 w-full" variant={p.featured ? "default" : "outline"}>
                  <Link href="/partner/login">{p.cta}</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">Pricing shown is a UI placeholder for the demo.</p>
      </section>

      {/* Partner logos placeholder */}
      <section className="border-t border-border/60 bg-background">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <p className="text-center text-xs uppercase tracking-wider text-muted-foreground">Trusted by leading platforms</p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 opacity-50">
            {["NovaExchange", "Fintech NeoBank", "DeFi Onramp", "CryptoWallet", "Neobank+"].map((n) => (
              <span key={n} className="text-sm font-semibold text-foreground">{n}</span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 py-16 md:py-24">
        <div className="rounded-2xl tp-hero-gradient px-6 py-12 text-center text-white">
          <h2 className="text-2xl md:text-3xl font-bold">Ready to get verified?</h2>
          <p className="mt-2 text-white/70">Complete KYC once and reuse it everywhere.</p>
          <Button asChild size="lg" className="mt-6" data-testid="link-cta-verify-bottom">
            <Link href="/signup">Get Verified <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
