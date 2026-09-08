import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiRequest, auth } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { ShieldOff, Download, Trash2, Link2 } from "lucide-react";

export default function Privacy() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const platforms = useQuery<any>({
    queryKey: ["/api/privacy/platforms"],
    refetchOnWindowFocus: false,
  });

  const revoke = useMutation({
    mutationFn: (partnerId: number) => apiRequest("POST", `/api/privacy/revoke/${partnerId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/privacy/platforms"] }); qc.invalidateQueries({ queryKey: ["/api/dashboard"] }); toast({ title: "Access revoked" }); },
  });

  const exportData = useMutation({
    mutationFn: () => apiRequest("POST", "/api/gdpr/export"),
    onSuccess: async (res) => {
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "trustpass-data-export.json"; a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Data exported" });
    },
  });

  const deleteAccount = useMutation({
    mutationFn: () => apiRequest("POST", "/api/gdpr/delete"),
    onSuccess: () => { auth.clear(); toast({ title: "Account deleted", description: "Your PII has been removed" }); navigate("/"); },
  });

  const list = platforms.data ?? [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-xl font-bold">Privacy controls</h1>
      <p className="text-sm text-muted-foreground">Manage which platforms can access your credential and your data rights.</p>

      <Card className="mt-6 border-border/60">
        <CardHeader>
          <CardTitle className="text-base">Connected platforms</CardTitle>
          <CardDescription>Revoke access for any platform at any time.</CardDescription>
        </CardHeader>
        <CardContent>
          {list.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center text-sm text-muted-foreground">
              <Link2 className="h-8 w-8 mb-2 opacity-40" /> No connected platforms.
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {list.map((p: any) => (
                <div key={p.partnerId} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium">{p.company}</p>
                    <p className="text-xs text-muted-foreground">Accessed {new Date(p.accessedAt).toLocaleDateString()}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => revoke.mutate(p.partnerId)} data-testid={`button-revoke-${p.partnerId}`}>
                    <ShieldOff className="mr-1 h-3 w-3" /> Revoke
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6 border-border/60">
        <CardHeader>
          <CardTitle className="text-base">Your data rights (GDPR)</CardTitle>
          <CardDescription>Export your data or exercise your right to be forgotten.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button variant="outline" className="w-full justify-start" onClick={() => exportData.mutate()} disabled={exportData.isPending} data-testid="button-export">
            <Download className="mr-2 h-4 w-4" /> {exportData.isPending ? "Exporting…" : "Download my data"}
          </Button>
          <Button variant="outline" className="w-full justify-start text-destructive hover:text-destructive border-destructive/30" onClick={() => { if (confirm("This permanently deletes your PII. An anonymized blockchain record is retained. Continue?")) deleteAccount.mutate(); }} disabled={deleteAccount.isPending} data-testid="button-delete">
            <Trash2 className="mr-2 h-4 w-4" /> {deleteAccount.isPending ? "Deleting…" : "Delete my account"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
