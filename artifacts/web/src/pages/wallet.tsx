import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useGetWallet, useRequestWithdrawal, getGetWalletQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Copy, Wallet, ArrowUpRight, ArrowDownLeft, DollarSign, Loader2, CheckCircle2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export default function WalletPage() {
  const { hostToken } = useAuth();
  const { data: wallet, isLoading, refetch } = useGetWallet(hostToken || "", { query: { enabled: !!hostToken, queryKey: getGetWalletQueryKey(hostToken || "") } });
  
  const [withdrawCurrency, setWithdrawCurrency] = useState("USDT_TRC20");
  const [withdrawAddress, setWithdrawAddress] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");

  const requestWithdrawal = useRequestWithdrawal();

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const handleWithdraw = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hostToken || !withdrawAddress || !withdrawAmount) return;

    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Invalid amount");
      return;
    }

    if (wallet && amount > wallet.creditBalance) {
      toast.error("Insufficient funds");
      return;
    }

    requestWithdrawal.mutate(
      {
        hostToken,
        data: {
          currency: withdrawCurrency,
          address: withdrawAddress,
          amount
        }
      },
      {
        onSuccess: () => {
          toast.success("Withdrawal requested successfully");
          setWithdrawAddress("");
          setWithdrawAmount("");
          refetch();
        },
        onError: () => {
          toast.error("Failed to request withdrawal");
        }
      }
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Wallet</h1>
        <p className="text-muted-foreground">Manage your earnings, deposits, and withdrawals.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="bg-card/50 backdrop-blur border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available Balance</CardTitle>
            <Wallet className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-primary">
              {isLoading ? <Skeleton className="h-10 w-32" /> : `$${(wallet?.creditBalance || 0).toFixed(2)}`}
            </div>
            <p className="text-xs text-muted-foreground mt-1">USD equivalent</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 backdrop-blur">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Withdrawals</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">
              {isLoading ? <Skeleton className="h-10 w-24" /> : `$${(wallet?.pendingWithdrawals || 0).toFixed(2)}`}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Currently processing</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="bg-card/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowDownLeft className="h-5 w-5 text-primary" />
              Deposit Addresses
            </CardTitle>
            <CardDescription>Send funds here to top up your host credits.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
              </div>
            ) : (
              wallet?.depositAddresses.map((addr) => (
                <div key={addr.currency} className="flex items-center gap-4 p-4 rounded-lg border border-border/50 bg-background/50">
                  <div className="p-2 bg-white rounded flex-shrink-0">
                    <QRCodeSVG value={addr.address} size={64} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="font-bold text-sm">{addr.label}</div>
                      <Badge variant="outline" className="text-[10px] font-mono">{addr.network}</Badge>
                    </div>
                    <div className="text-xs font-mono text-muted-foreground truncate mb-2 select-all">
                      {addr.address}
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-[10px] text-muted-foreground">Min: {addr.minDeposit} {addr.currency.split('_')[0]}</div>
                      <Button variant="secondary" size="sm" className="h-7 text-xs" onClick={() => handleCopy(addr.address, `${addr.label} Address`)}>
                        <Copy className="h-3 w-3 mr-1" /> Copy
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowUpRight className="h-5 w-5 text-primary" />
              Request Withdrawal
            </CardTitle>
            <CardDescription>Withdraw your host earnings to your crypto wallet.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleWithdraw} className="space-y-6">
              <div className="space-y-3">
                <Label>Select Network</Label>
                <RadioGroup value={withdrawCurrency} onValueChange={setWithdrawCurrency} className="grid grid-cols-3 gap-2">
                  {[
                    { id: "USDT_TRC20", label: "USDT", net: "TRC20" },
                    { id: "SOL", label: "SOL", net: "Solana" },
                    { id: "NANO", label: "XNO", net: "Nano" },
                  ].map((c) => (
                    <div key={c.id}>
                      <RadioGroupItem value={c.id} id={`withdraw-${c.id}`} className="peer sr-only" />
                      <Label
                        htmlFor={`withdraw-${c.id}`}
                        className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer transition-all text-center"
                      >
                        <span className="font-bold text-sm">{c.label}</span>
                        <span className="text-[10px] text-muted-foreground">{c.net}</span>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label htmlFor="withdrawAddress">Destination Address</Label>
                <Input
                  id="withdrawAddress"
                  placeholder="Paste your wallet address here"
                  value={withdrawAddress}
                  onChange={(e) => setWithdrawAddress(e.target.value)}
                  className="font-mono text-sm bg-background/50"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="withdrawAmount">Amount (USD Equivalent)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="withdrawAmount"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    className="pl-9 font-mono bg-background/50"
                  />
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm" 
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 text-xs text-primary"
                    onClick={() => setWithdrawAmount(wallet?.creditBalance.toString() || "0")}
                  >
                    MAX
                  </Button>
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full font-bold tracking-wider" 
                disabled={requestWithdrawal.isPending || !withdrawAddress || !withdrawAmount || (wallet && parseFloat(withdrawAmount) > wallet.creditBalance)}
              >
                {requestWithdrawal.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm Withdrawal
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card/50 backdrop-blur">
        <CardHeader>
          <CardTitle>Recent Withdrawals</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : wallet?.recentWithdrawals.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">No recent withdrawals.</div>
          ) : (
            <div className="rounded-md border border-border/50">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Network</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {wallet?.recentWithdrawals.map((w) => (
                    <TableRow key={w.id}>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(w.requestedAt))} ago
                      </TableCell>
                      <TableCell className="font-mono text-xs">{w.currency}</TableCell>
                      <TableCell className="font-mono text-xs truncate max-w-[100px] md:max-w-[200px]" title={w.address}>
                        {w.address.substring(0, 8)}...{w.address.substring(w.address.length - 8)}
                      </TableCell>
                      <TableCell className="font-bold font-mono">${w.amount.toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={
                          w.status === 'completed' ? 'default' : 
                          w.status === 'failed' ? 'destructive' : 'secondary'
                        } className="text-[10px] uppercase">
                          {w.status === 'completed' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                          {w.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
