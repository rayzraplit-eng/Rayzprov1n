import { useCalculateMartingale } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calculator, ArrowLeft, AlertTriangle } from "lucide-react";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const schema = z.object({
  baseStake: z.coerce.number().min(0.01, "Must be at least 0.01"),
  multiplier: z.coerce.number().min(1, "Must be at least 1"),
  steps: z.coerce.number().min(1).max(25, "Max 25 steps"),
  payoutPercent: z.coerce.number().min(1).max(2000, "Invalid payout"),
});

export default function MartingaleTool() {
  const calculate = useCalculateMartingale();
  
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      baseStake: 1,
      multiplier: 2,
      steps: 5,
      payoutPercent: 95,
    },
    mode: "onChange"
  });

  const values = form.watch();

  useEffect(() => {
    const subscription = form.watch((value, { name, type }) => {
      const parsed = schema.safeParse(value);
      if (parsed.success) {
        const timeoutId = setTimeout(() => {
          calculate.mutate({ data: parsed.data });
        }, 500);
        return () => clearTimeout(timeoutId);
      }
      return undefined;
    });
    return () => subscription.unsubscribe();
  }, [form.watch, calculate.mutate]);

  // Initial calc
  useEffect(() => {
    if (form.formState.isValid) {
      calculate.mutate({ data: form.getValues() });
    }
  }, []);

  const result = calculate.data;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild className="rounded-none h-10 w-10 shrink-0">
          <Link href="/tools"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div>
          <h1 className="text-3xl font-mono font-bold tracking-tight text-foreground flex items-center gap-2">
            <Calculator className="h-8 w-8 text-primary" />
            MARTINGALE CALCULATOR
          </h1>
          <p className="text-muted-foreground font-mono text-sm mt-1">Calculate stake progression to recover losses</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="col-span-1 border-border shadow-md bg-card/50 backdrop-blur-sm rounded-none border-l-4 border-l-primary h-fit">
          <CardHeader>
            <CardTitle className="font-mono text-sm tracking-wider text-muted-foreground uppercase">Parameters</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form className="space-y-4">
                <FormField
                  control={form.control}
                  name="baseStake"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-mono text-xs uppercase text-muted-foreground">Base Stake ($)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" className="font-mono rounded-none bg-background/50" {...field} />
                      </FormControl>
                      <FormMessage className="font-mono text-xs" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="multiplier"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-mono text-xs uppercase text-muted-foreground">Martingale Multiplier</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.1" className="font-mono rounded-none bg-background/50" {...field} />
                      </FormControl>
                      <FormMessage className="font-mono text-xs" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="steps"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-mono text-xs uppercase text-muted-foreground">Max Steps (Losses)</FormLabel>
                      <FormControl>
                        <Input type="number" className="font-mono rounded-none bg-background/50" {...field} />
                      </FormControl>
                      <FormMessage className="font-mono text-xs" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="payoutPercent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-mono text-xs uppercase text-muted-foreground">Payout Percentage (%)</FormLabel>
                      <FormControl>
                        <Input type="number" className="font-mono rounded-none bg-background/50" {...field} />
                      </FormControl>
                      <FormMessage className="font-mono text-xs" />
                    </FormItem>
                  )}
                />
              </form>
            </Form>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-6">
          <Card className="border-border shadow-md bg-card/50 backdrop-blur-sm rounded-none border-l-4 border-l-destructive">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <h3 className="font-mono text-sm tracking-wider text-muted-foreground uppercase flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  Total Risk Exposure
                </h3>
                <p className="font-mono text-xs text-muted-foreground mt-1 max-w-sm">
                  Amount needed to survive {values.steps || 0} consecutive losses
                </p>
              </div>
              <div className="text-4xl font-mono font-bold text-destructive tracking-tight">
                {calculate.isPending ? <Skeleton className="h-10 w-32" /> : `$${result?.totalRisk.toFixed(2) || '0.00'}`}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border shadow-md bg-card/50 backdrop-blur-sm rounded-none">
            <CardHeader>
              <CardTitle className="font-mono text-sm tracking-wider text-muted-foreground uppercase">Step Progression</CardTitle>
            </CardHeader>
            <CardContent>
              {calculate.isPending && !result ? (
                <div className="space-y-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : result?.steps ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/50">
                        <TableHead className="font-mono text-xs">Step</TableHead>
                        <TableHead className="text-right font-mono text-xs">Stake</TableHead>
                        <TableHead className="text-right font-mono text-xs">Cum. Loss</TableHead>
                        <TableHead className="text-right font-mono text-xs">Payout (Win)</TableHead>
                        <TableHead className="text-right font-mono text-xs">Net Profit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.steps.map((step) => (
                        <TableRow key={step.step} className="border-border/50 hover:bg-muted/30 transition-colors">
                          <TableCell className="font-mono font-medium">{step.step}</TableCell>
                          <TableCell className="text-right font-mono">${step.stake.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-mono text-destructive">${step.cumulativeLoss.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-mono text-primary">${step.payout.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-mono font-bold text-primary">${step.netIfWin.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}