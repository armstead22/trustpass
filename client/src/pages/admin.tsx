import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Users, ShieldCheck, Building2, ScrollText, CheckCircle, XCircle, Ban } from "lucide-react";

export default function Admin() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const metrics = useQuery<any>({ queryKey: ["/api/admin/metrics"], refetchOnWindowFocus: false });
  const users = useQuery<any[]>({ queryKey: ["/api/admin/users"], refetchOnWindowFocus: false });
  const verifications = useQuery<any[]>({ queryKey: ["/api/admin/verifications"], refetchOnWindowFocus: false });
  const partners = useQuery<any[]>({ queryKey: ["/api/admin/partners"], refetchOnWindowFocus: false });
  const auditLogs = useQuery<any[]>({ queryKey: ["/api/admin/audit-logs"], refetchOnWindowFocus: false });

  const review = useMutation({
    mutationFn: ({ id, action }: { id: number; action: "approve" | "reject" }) => apiRequest("POST", `/api/admin/verifications/${id}`, { action, reason: action === "reject" ? "Manually rejected" : undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/verifications"] }); qc.invalidateQueries({ queryKey: ["/api/admin/metrics"] }); toast({ title: "Review submitted" }); },
  });

  const m = metrics.data;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-xl font-bold">Admin</h1>
      <p className="text-sm text-muted-foreground">Platform oversight</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Users} label="Total users" value={m?.totalUsers ?? 0} />
        <Stat icon={ShieldCheck} label="Verified users" value={m?.verifiedUsers ?? 0} />
        <Stat icon={Building2} label="Active partners" value={m?.activePartners ?? 0} />
        <Stat icon={ScrollText} label="API calls today" value={m?.apiCallsToday ?? 0} />
      </div>

      {/* Pending verifications */}
      <Card className="mt-6 border-border/60">
        <CardHeader>
          <CardTitle className="text-base">Verification queue</CardTitle>
          <CardDescription>Manually approve or reject verifications (institutional tier review)</CardDescription>
        </CardHeader>
        <CardContent>
          {verifications.data?.filter((v: any) => v.status === "pending_review").length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No verifications pending review.</p>
          ) : (
            <div className="divide-y divide-border/60">
              {verifications.data?.filter((v: any) => v.status === "pending_review").map((v: any) => (
                <div key={v.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium">{v.userEmail}</p>
                    <p className="text-xs text-muted-foreground">Level: {v.requestedLevel}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => review.mutate({ id: v.id, action: "approve" })}><CheckCircle className="mr-1 h-3 w-3" /> Approve</Button>
                    <Button size="sm" variant="outline" className="text-destructive" onClick={() => review.mutate({ id: v.id, action: "reject" })}><XCircle className="mr-1 h-3 w-3" /> Reject</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Users */}
      <Card className="mt-6 border-border/60">
        <CardHeader><CardTitle className="text-base">Users</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr><th className="pb-2">User</th><th className="pb-2">Status</th><th className="pb-2">Verified</th><th className="pb-2">Actions</th></tr>
              </thead>
              <tbody>
                {users.data?.slice(0, 10).map((u: any) => (
                  <tr key={u.id} className="border-t border-border/60">
                    <td className="py-2">
                      <p className="font-medium">{u.email}</p>
                      <p className="text-xs text-muted-foreground">{u.name}</p>
                    </td>
                    <td className="py-2"><Badge variant={u.status === "active" ? "default" : "secondary"} className="capitalize">{u.status}</Badge></td>
                    <td className="py-2"><Badge variant="outline" className="capitalize">{u.verificationStatus || "none"}</Badge></td>
                    <td className="py-2">
                      <Button size="sm" variant="ghost" onClick={() => apiRequest("POST", `/api/admin/users/${u.id}/status`, { status: u.status === "active" ? "suspended" : "active" }).then(() => { users.refetch(); toast({ title: `User ${u.status === "active" ? "suspended" : "activated"}` }); })}>
                        <Ban className="mr-1 h-3 w-3" /> {u.status === "active" ? "Suspend" : "Activate"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Audit log */}
      <Card className="mt-6 border-border/60">
        <CardHeader><CardTitle className="text-base">Audit log</CardTitle><CardDescription>Every sensitive action, immutably logged</CardDescription></CardHeader>
        <CardContent>
          <div className="max-h-80 overflow-y-auto divide-y divide-border/60">
            {auditLogs.data?.slice(0, 20).map((log: any) => (
              <div key={log.id} className="py-2 text-xs">
                <div className="flex justify-between">
                  <span className="font-mono text-muted-foreground">{log.action}</span>
                  <span className="text-muted-foreground">{new Date(log.timestamp).toLocaleString()}</span>
                </div>
                {log.details && <pre className="mt-0.5 text-muted-foreground/70 overflow-x-auto">{JSON.stringify(log.details, null, 0).slice(0, 200)}</pre>}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: number | string }) {
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
