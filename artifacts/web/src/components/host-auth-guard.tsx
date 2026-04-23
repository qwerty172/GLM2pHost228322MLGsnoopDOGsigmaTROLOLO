import { useAuth } from "@/hooks/use-auth";
import { useRegisterHost } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export function HostAuthGuard({ children }: { children: React.ReactNode }) {
  const { hostToken, setHostToken } = useAuth();
  const [displayName, setDisplayName] = useState("");
  
  const registerHost = useRegisterHost();

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;

    registerHost.mutate(
      { data: { displayName } },
      {
        onSuccess: (data) => {
          setHostToken(data.hostToken);
          toast.success("Registered successfully");
        },
        onError: () => {
          toast.error("Failed to register host");
        }
      }
    );
  };

  if (hostToken) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-background">
      <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_center,rgba(0,255,170,0.15),transparent_50%)]" />
      <Card className="w-full max-w-md relative z-10 border-primary/20 bg-background/80 backdrop-blur-sm">
        <CardHeader className="space-y-2 text-center">
          <CardTitle className="text-2xl font-bold tracking-tighter">Become a Host</CardTitle>
          <CardDescription className="text-muted-foreground">
            Register to start renting out your hardware and earning crypto.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                placeholder="e.g. RTX_4090_Beast"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="bg-background/50"
                autoFocus
              />
            </div>
            <Button 
              type="submit" 
              className="w-full font-bold uppercase tracking-wider" 
              disabled={registerHost.isPending || !displayName.trim()}
            >
              {registerHost.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Initialize Host Node
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
