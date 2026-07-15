import { useListBots, useToggleBotFavorite, useImportBot, getListBotsQueryKey, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { FreeBotsSection } from "@/components/free-bots-section";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Bot as BotIcon, Upload, Search, Star, Clock, Zap, Activity, Filter, HardDrive } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";

const importSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  strategy: z.string().optional(),
  market: z.string().optional(),
  tags: z.string().optional(),
  xmlContent: z.string().min(1, "XML content is required")
});

export default function BotsList() {
  const [search, setSearch] = useState("");
  const { data: bots, isLoading } = useListBots({ q: search || undefined });
  const toggleFavorite = useToggleBotFavorite();
  const importBot = useImportBot();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [fileError, setFileError] = useState("");

  const form = useForm<z.infer<typeof importSchema>>({
    resolver: zodResolver(importSchema),
    defaultValues: {
      name: "",
      description: "",
      strategy: "",
      market: "",
      tags: "",
      xmlContent: ""
    }
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError("");
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.xml')) {
      setFileError("Please select a valid XML file");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      form.setValue("xmlContent", content);
      if (!form.getValues("name")) {
        form.setValue("name", file.name.replace('.xml', ''));
      }
    };
    reader.readAsText(file);
  };

  const onSubmit = (data: z.infer<typeof importSchema>) => {
    importBot.mutate({
      data: {
        ...data,
        tags: data.tags ? data.tags.split(',').map(t => t.trim()).filter(Boolean) : []
      }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListBotsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        toast({ title: "Bot imported successfully" });
        setIsImportOpen(false);
        form.reset();
      },
      onError: (error: any) => {
        toast({ title: "Failed to import bot", description: error.message || "Unknown error", variant: "destructive" });
      }
    });
  };

  const handleToggleFavorite = (e: React.MouseEvent, id: number) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListBotsQueryKey() });
      }
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-3xl font-mono font-bold tracking-tight text-foreground flex items-center gap-2">
          <BotIcon className="h-8 w-8 text-primary" />
          BOTS LIBRARY
        </h1>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search bots..." 
              className="pl-8 font-mono rounded-none bg-background/50 border-border"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
            <DialogTrigger asChild>
              <Button className="font-mono gap-2 rounded-none shadow-[2px_2px_0px_0px_hsl(var(--primary-border))] border border-primary shrink-0">
                <Upload className="h-4 w-4" />
                IMPORT
              </Button>
            </DialogTrigger>
            <DialogContent className="border-border bg-card/95 backdrop-blur-xl rounded-none border-l-4 border-l-primary sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle className="font-mono font-bold uppercase tracking-wider">Import Bot XML</DialogTitle>
                <DialogDescription className="font-mono text-xs">
                  Upload a Deriv DBot XML file to add it to your library.
                </DialogDescription>
              </DialogHeader>
              
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="border-2 border-dashed border-border/50 bg-background/30 p-6 flex flex-col items-center justify-center relative cursor-pointer hover:bg-muted/30 transition-colors">
                    <input 
                      type="file" 
                      accept=".xml" 
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      onChange={handleFileChange}
                    />
                    <Upload className="h-8 w-8 text-muted-foreground/50 mb-2" />
                    <div className="text-sm font-mono font-bold">Drag & drop or click to upload</div>
                    <div className="text-xs text-muted-foreground font-mono mt-1">.xml files only</div>
                    {form.watch("xmlContent") && (
                      <div className="mt-4 px-3 py-1 bg-primary/10 border border-primary/30 text-primary text-xs font-mono font-bold rounded">
                        XML Loaded ({Math.round(form.watch("xmlContent").length / 1024)} KB)
                      </div>
                    )}
                    {fileError && (
                      <div className="mt-2 text-xs font-mono text-destructive">{fileError}</div>
                    )}
                  </div>

                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono text-xs uppercase text-muted-foreground">Bot Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Martingale V1" className="font-mono rounded-none" {...field} />
                        </FormControl>
                        <FormMessage className="font-mono text-xs" />
                      </FormItem>
                    )}
                  />
                  
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="strategy"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-mono text-xs uppercase text-muted-foreground">Strategy</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Martingale" className="font-mono rounded-none" {...field} />
                          </FormControl>
                          <FormMessage className="font-mono text-xs" />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="market"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-mono text-xs uppercase text-muted-foreground">Market</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Volatility 75" className="font-mono rounded-none" {...field} />
                          </FormControl>
                          <FormMessage className="font-mono text-xs" />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="tags"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono text-xs uppercase text-muted-foreground">Tags (comma separated)</FormLabel>
                        <FormControl>
                          <Input placeholder="trend, safe, fast" className="font-mono rounded-none" {...field} />
                        </FormControl>
                        <FormMessage className="font-mono text-xs" />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono text-xs uppercase text-muted-foreground">Description (optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="Brief description of the bot..." className="font-mono rounded-none" {...field} />
                        </FormControl>
                        <FormMessage className="font-mono text-xs" />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" disabled={importBot.isPending || !form.watch("xmlContent")} className="w-full font-mono rounded-none mt-4">
                    {importBot.isPending ? "IMPORTING..." : "IMPORT BOT"}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {isLoading ? (
          <>
            <Skeleton className="h-[200px] w-full bg-muted/50 rounded-none border-l-4 border-l-muted" />
            <Skeleton className="h-[200px] w-full bg-muted/50 rounded-none border-l-4 border-l-muted" />
            <Skeleton className="h-[200px] w-full bg-muted/50 rounded-none border-l-4 border-l-muted" />
          </>
        ) : bots && bots.length > 0 ? (
          bots.map((bot) => (
            <Link key={bot.id} href={`/bots/${bot.id}`}>
              <Card className="rounded-none cursor-pointer group border-border/50 bg-card/50 hover:bg-muted/10 border-l-4 border-l-muted hover:border-l-primary transition-all overflow-hidden h-full flex flex-col">
                <CardHeader className="pb-3 flex-row items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="font-mono text-lg font-bold group-hover:text-primary transition-colors flex items-center gap-2">
                      {bot.name}
                    </CardTitle>
                    {bot.description && (
                      <CardDescription className="font-mono text-xs line-clamp-1">{bot.description}</CardDescription>
                    )}
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className={`h-8 w-8 shrink-0 rounded-none ${bot.favorite ? 'text-chart-3' : 'text-muted-foreground hover:text-foreground'}`}
                    onClick={(e) => handleToggleFavorite(e, bot.id)}
                  >
                    <Star className={bot.favorite ? "fill-chart-3" : ""} size={16} />
                  </Button>
                </CardHeader>
                <CardContent className="flex-1 pb-3">
                  <div className="flex flex-wrap gap-2 mb-4">
                    {bot.strategy && (
                      <Badge variant="secondary" className="font-mono text-[10px] rounded-none bg-secondary/50">
                        <Activity className="h-3 w-3 mr-1" />
                        {bot.strategy}
                      </Badge>
                    )}
                    {bot.market && (
                      <Badge variant="secondary" className="font-mono text-[10px] rounded-none bg-secondary/50">
                        <Activity className="h-3 w-3 mr-1" />
                        {bot.market}
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {bot.tags.map(tag => (
                      <Badge key={tag} variant="outline" className="font-mono text-[9px] rounded-none border-border/50 text-muted-foreground px-1.5 py-0 h-4">
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
                <CardFooter className="pt-3 border-t border-border/30 bg-background/20 flex justify-between items-center text-xs text-muted-foreground font-mono">
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className={`font-mono text-[10px] rounded-none py-0 h-5 px-1.5 ${
                      bot.status === 'running' ? 'border-primary text-primary bg-primary/10' :
                      bot.status === 'paused' ? 'border-chart-3 text-chart-3 bg-chart-3/10' :
                      'border-muted-foreground/30'
                    }`}>
                      <div className={`h-1.5 w-1.5 rounded-full mr-1.5 ${
                        bot.status === 'running' ? 'bg-primary animate-pulse' :
                        bot.status === 'paused' ? 'bg-chart-3' : 'bg-muted-foreground'
                      }`} />
                      {bot.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1" title="File size">
                      <HardDrive className="h-3 w-3" />
                      {Math.round(bot.sizeBytes / 1024)}KB
                    </span>
                    <span className="flex items-center gap-1" title="Last run">
                      <Clock className="h-3 w-3" />
                      {bot.lastRunAt ? formatDistanceToNow(new Date(bot.lastRunAt), { addSuffix: true }) : 'Never'}
                    </span>
                  </div>
                </CardFooter>
              </Card>
            </Link>
          ))
        ) : (
          <div className="col-span-full py-16 flex flex-col items-center justify-center text-center border border-dashed border-border/50 rounded-none bg-card/30">
            <BotIcon className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="font-mono text-lg font-bold text-muted-foreground">No bots found</h3>
            <p className="font-mono text-xs text-muted-foreground/70 mt-1 max-w-sm">
              {search ? "No bots match your search criteria." : "Import a Deriv DBot XML file to get started."}
            </p>
            {search && (
              <Button variant="link" onClick={() => setSearch("")} className="font-mono text-xs mt-4">
                Clear search
              </Button>
            )}
          </div>
        )}
      </div>

      <FreeBotsSection />
    </div>
  );
}