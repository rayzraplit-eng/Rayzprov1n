import { useCalculateRisk } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calculator, ArrowLeft, ShieldAlert, DollarSign, Percent, ArrowDownUp } from "lucide-react";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const schema = z.object({
  accountBalance: z.coerce.number().min(0, "Balance must be positive"),
  riskPercent: z.coerce.number().min(0.1).max(100, "Risk must be between 0.1 and 100"),
  stopLossPips: z.coerce.number().min(1, "Must be at least 1 pip"),
  pipValue: z.coerce.number().min(0.01, "Pip value must be at least 0.01"),
});

export default function RiskTool() {
  const calculate = useCalculateRisk();
  
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      accountBalance: 1000,
      riskPercent: 1,
      stopLossPips: 20,
      pipValue: 10, // Standard lot default usually 10 for EURUSD
    },
    mode: "onChange"
  });

  const values = form.watch();

  useEffect(() => {
    const subscription = form.watch((value) => {
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
            <ShieldAlert className="h-8 w-8 text-primary" />
            POSITION SIZE CALCULATOR
          </h1>
          <p className="text-muted-foreground font-mono text-sm mt-1">Determine correct lot size based on risk parameters</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border shadow-md bg-card/50 backdrop-blur-sm rounded-none border-t-4 border-t-primary h-fit">
          <CardHeader>
            <CardTitle className="font-mono text-sm tracking-wider text-muted-foreground uppercase">Risk Parameters</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="accountBalance"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono text-xs uppercase text-muted-foreground flex items-center gap-1">
                          <DollarSign className="h-3 w-3" /> Account Balance
                        </FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" className="font-mono rounded-none bg-background/50 text-lg" {...field} />
                        </FormControl>
                        <FormMessage className="font-mono text-xs" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="riskPercent"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono text-xs uppercase text-muted-foreground flex items-center gap-1">
                          <Percent className="h-3 w-3" /> Risk Percentage
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input type="number" step="0.1" className="font-mono rounded-none bg-background/50 text-lg pr-8" {...field} />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono">%</span>
                          </div>
                        </FormControl>
                        <FormMessage className="font-mono text-xs" />
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="stopLossPips"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono text-xs uppercase text-muted-foreground flex items-center gap-1">
                          <ArrowDownUp className="h-3 w-3" /> Stop Loss (Pips)
                        </FormLabel>
                        <FormControl>
                          <Input type="number" className="font-mono rounded-none bg-background/50 text-lg" {...field} />
                        </FormControl>
                        <FormMessage className="font-mono text-xs" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="pipValue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono text-xs uppercase text-muted-foreground">Pip Value (Std Lot)</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono">$</span>
                            <Input type="number" step="0.01" className="font-mono rounded-none bg-background/50 text-lg pl-7" {...field} />
                          </div>
                        </FormControl>
                        <FormMessage className="font-mono text-xs" />
                      </FormItem>
                    )}
                  />
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-border shadow-md bg-card/50 backdrop-blur-sm rounded-none border-l-4 border-l-chart-2">
            <CardHeader className="pb-2">
              <CardTitle className="font-mono text-sm tracking-wider text-muted-foreground uppercase flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-chart-2" />
                Risk Amount (Money at Risk)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-mono font-bold text-chart-2 tracking-tight">
                {calculate.isPending ? <Skeleton className="h-10 w-32" /> : `$${result?.riskAmount.toFixed(2) || '0.00'}`}
              </div>
              <p className="font-mono text-xs text-muted-foreground mt-2">
                This is exactly {values.riskPercent || 0}% of your ${values.accountBalance || 0} balance.
              </p>
            </CardContent>
          </Card>

          <Card className="border-border shadow-md bg-card/50 backdrop-blur-sm rounded-none border-l-4 border-l-primary bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="font-mono text-sm tracking-wider text-muted-foreground uppercase flex items-center gap-2">
                <Calculator className="h-4 w-4 text-primary" />
                Recommended Position Size
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-5xl font-mono font-bold text-primary tracking-tight">
                {calculate.isPending ? <Skeleton className="h-12 w-40" /> : `${result?.positionSize.toFixed(2) || '0.00'} Lots`}
              </div>
              <div className="mt-4 p-3 bg-background/50 border border-border/50 text-sm font-mono text-muted-foreground">
                If trade hits stop loss of {values.stopLossPips || 0} pips with this size, you will lose exactly ${result?.riskAmount.toFixed(2) || '0.00'}.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}