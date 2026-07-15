import { useCalculateCompound } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TrendingUp, ArrowLeft, DollarSign, Percent, Calendar } from "lucide-react";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const schema = z.object({
  startingBalance: z.coerce.number().min(0, "Must be positive"),
  dailyReturnPercent: z.coerce.number().min(-100, "Must be > -100"),
  days: z.coerce.number().min(1).max(365, "Max 365 days"),
});

export default function CompoundTool() {
  const calculate = useCalculateCompound();
  
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      startingBalance: 100,
      dailyReturnPercent: 1,
      days: 30,
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
            <TrendingUp className="h-8 w-8 text-primary" />
            COMPOUND PROJECTION
          </h1>
          <p className="text-muted-foreground font-mono text-sm mt-1">Project account growth over time</p>
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
                  name="startingBalance"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-mono text-xs uppercase text-muted-foreground flex items-center gap-1">
                        <DollarSign className="h-3 w-3" /> Starting Balance
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
                  name="dailyReturnPercent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-mono text-xs uppercase text-muted-foreground flex items-center gap-1">
                        <Percent className="h-3 w-3" /> Daily Target Return
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
                <FormField
                  control={form.control}
                  name="days"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-mono text-xs uppercase text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> Days
                      </FormLabel>
                      <FormControl>
                        <Input type="number" className="font-mono rounded-none bg-background/50 text-lg" {...field} />
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-border shadow-md bg-card/50 backdrop-blur-sm rounded-none border-l-4 border-l-primary bg-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="font-mono text-sm tracking-wider text-primary uppercase">
                  Final Balance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-mono font-bold text-foreground tracking-tight">
                  {calculate.isPending ? <Skeleton className="h-10 w-32" /> : `$${result?.finalBalance.toFixed(2) || '0.00'}`}
                </div>
              </CardContent>
            </Card>
            <Card className="border-border shadow-md bg-card/50 backdrop-blur-sm rounded-none border-l-4 border-l-chart-2 bg-chart-2/5">
              <CardHeader className="pb-2">
                <CardTitle className="font-mono text-sm tracking-wider text-chart-2 uppercase">
                  Total Profit
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-mono font-bold text-foreground tracking-tight">
                  {calculate.isPending ? <Skeleton className="h-10 w-32" /> : `$${result?.totalProfit.toFixed(2) || '0.00'}`}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-border shadow-md bg-card/50 backdrop-blur-sm rounded-none">
            <CardHeader>
              <CardTitle className="font-mono text-sm tracking-wider text-muted-foreground uppercase">Growth Chart</CardTitle>
            </CardHeader>
            <CardContent>
              {calculate.isPending && !result ? (
                <Skeleton className="h-[300px] w-full" />
              ) : result?.points ? (
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={result.points} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis 
                        dataKey="day" 
                        stroke="hsl(var(--muted-foreground))" 
                        fontSize={12}
                        tickFormatter={(val) => `Day ${val}`}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis 
                        stroke="hsl(var(--muted-foreground))" 
                        fontSize={12} 
                        tickFormatter={(val) => `$${val}`}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: '0px', fontFamily: 'monospace' }}
                        itemStyle={{ color: 'hsl(var(--primary))' }}
                        labelStyle={{ color: 'hsl(var(--muted-foreground))', marginBottom: '4px' }}
                        labelFormatter={(label) => `Day ${label}`}
                        formatter={(value: number) => [`$${value.toFixed(2)}`, 'Balance']}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="balance" 
                        stroke="hsl(var(--primary))" 
                        strokeWidth={2} 
                        dot={false}
                        activeDot={{ r: 4, fill: 'hsl(var(--primary))', stroke: 'hsl(var(--background))', strokeWidth: 2 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}