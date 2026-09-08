import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Code2, Terminal, Webhook } from "lucide-react";

const curlExample = `curl -X POST https://api.trustpass.io/v1/verify \\
  -H "X-API-Key: tp_live_xxxxxxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{"email": "user@example.com", "accessType": "query", "purpose": "User verification"}'`;

const jsExample = `const res = await fetch("https://api.trustpass.io/v1/verify", {
  method: "POST",
  headers: {
    "X-API-Key": process.env.TRUSTPASS_API_KEY,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    email: "user@example.com",
    accessType: "query",
    purpose: "User verification",
  }),
});
const { passed, status, level } = await res.json();`;

export default function PartnerDocs() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-xl font-bold">API Reference</h1>
      <p className="mt-1 text-sm text-muted-foreground">Verify your users with a single API call. Full Swagger spec available at <code>/api/docs</code>.</p>

      <Card className="mt-6 border-border/60">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Terminal className="h-4 w-4" /> Authentication</CardTitle>
          <CardDescription>Pass your API key in the X-API-Key header on every request.</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-md bg-muted/40 p-3 text-xs leading-relaxed">{`X-API-Key: tp_live_xxxxxxxxxxxxx`}</pre>
        </CardContent>
      </Card>

      <Card className="mt-6 border-border/60">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Code2 className="h-4 w-4" /> Verify a user</CardTitle>
          <CardDescription><code>POST /api/v1/verify</code> — Look up a user's verification status.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <CodeBlock lang="bash" code={curlExample} />
          <CodeBlock lang="javascript" code={jsExample} />
        </CardContent>
      </Card>

      <Card className="mt-6 border-border/60">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Webhook className="h-4 w-4" /> Webhooks</CardTitle>
          <CardDescription><code>POST /api/v1/webhook/register</code> — Subscribe to status events.</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-md bg-muted/40 p-3 text-xs leading-relaxed">{`POST /api/v1/webhook/register
{ "webhookUrl": "https://yourapp.com/hooks/trustpass" }

# Events sent to your URL:
{ "event": "verified", "userId": 1, "level": "enhanced", "credentialId": "..." }
{ "event": "expired",  "userId": 1, "status": "expired" }
{ "event": "revoked",  "userId": 1 }`}</pre>
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Endpoint method="GET" path="/api/v1/status/:id" desc="Get status by user ID" />
        <Endpoint method="GET" path="/api/v1/usage" desc="Usage stats + limits" />
        <Endpoint method="POST" path="/api/v1/apikeys/rotate" desc="Rotate your API key" />
        <Endpoint method="DELETE" path="/api/v1/webhooks/:id" desc="Delete a webhook" />
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild><Link href="/partner/dashboard">Go to dashboard</Link></Button>
        <Button asChild variant="outline"><a href="/api/docs" target="_blank" rel="noreferrer">Open Swagger UI</a></Button>
      </div>
    </div>
  );
}

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  return (
    <div>
      <div className="mb-1 text-xs text-muted-foreground">{lang}</div>
      <pre className="overflow-x-auto rounded-md bg-muted/40 p-3 text-xs leading-relaxed">{code}</pre>
    </div>
  );
}

function Endpoint({ method, path, desc }: { method: string; path: string; desc: string }) {
  const color = method === "GET" ? "text-emerald-600" : method === "POST" ? "text-blue-600" : "text-red-600";
  return (
    <div className="rounded-lg border border-border/60 p-3">
      <div className="flex items-center gap-2">
        <span className={`text-xs font-bold ${color}`}>{method}</span>
        <code className="text-xs">{path}</code>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
    </div>
  );
}
