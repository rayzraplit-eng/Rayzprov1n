import { useParams, useLocation } from "wouter";
import { useGetBot, useUpdateBot, useDeleteBot, getGetBotQueryKey, getListBotsQueryKey, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Play, Pause, Square, Download, Trash2, Edit2, Save, X, Bot as BotIcon, Activity, Tag, Clock, HardDrive, Code } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function BotDetail() {
  const params = useParams();
  const id = parseInt(params.id || "0");
  const [, setLocation] = useLocation();
  const { data: bot, isLoading } = useGetBot(id, { query: { enabled: !!id, queryKey: getGetBotQueryKey(id) } });
  const updateBot = useUpdateBot();
  const deleteBot = useDeleteBot();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    tags: ""
  });
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  useEffect(() => {
    if (bot && !isEditing) {
      setEditForm({
        name: bot.name,
        description: bot.description || "",
        tags: bot.tags.join(", ")
      });
    }
  }, [bot, isEditing]);

  const handleStatusChange = (status: "idle" | "running" | "paused") => {
    updateBot.mutate({ id, data: { status } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetBotQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getListBotsQueryKey() });
        toast({ title: `Bot status set to ${status}` });
      }
    });
  };

  const handleSaveEdit = () => {
    updateBot.mutate({ 
      id, 
      data: { 
        name: editForm.name, 
        description: editForm.description,
        tags: editForm.tags.split(",").map(t => t.trim()).filter(Boolean)
      } 
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetBotQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getListBotsQueryKey() });
        setIsEditing(false);
        toast({ title: "Bot updated" });
      }
    });
  };

  const handleDelete = () => {
    deleteBot.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListBotsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        toast({ title: "Bot deleted" });
        setIsDeleteDialogOpen(false);
        setLocation("/bots");
      }
    });
  };

  const handleDownloadXML = () => {
    if (!bot) return;
    const blob = new Blob([bot.xmlContent], { type: 'text/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${bot.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.xml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-[400px] w-full" />
          </div>
          <Skeleton className="h-[300px] w-full" />
        </div>
      </div>
    );
  }

  if (!bot) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <BotIcon className="h-16 w-16 text-muted-foreground/30 mb-4" />
        <h2 className="text-xl font-mono font-bold">Bot Not Found</h2>
        <p className="text-muted-foreground font-mono mt-2 mb-6">The bot you are looking for does not exist or has been deleted.</p>
        <Button onClick={() => setLocation("/bots")} className="font-mono rounded-none">Back to Bots</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Button variant="outline" size="icon" onClick={() => setLocation("/bots")} className="rounded-none h-10 w-10 shrink-0 mt-1">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          
          <div className="space-y-1">
            {isEditing ? (
              <Input 
                value={editForm.name} 
                onChange={e => setEditForm(prev => ({...prev, name: e.target.value}))} 
                className="font-mono text-xl font-bold h-10 w-full md:w-64 rounded-none bg-background border-primary"
                autoFocus
              />
            ) : (
              <h1 className="text-3xl font-mono font-bold tracking-tight text-foreground flex items-center gap-3">
                {bot.name}
                <Badge variant="outline" className={`font-mono text-xs rounded-none uppercase ${
                  bot.status === 'running' ? 'border-primary text-primary bg-primary/10' :
                  bot.status === 'paused' ? 'border-chart-3 text-chart-3 bg-chart-3/10' :
                  'border-muted-foreground/30'
                }`}>
                  <div className={`h-2 w-2 rounded-full mr-2 ${
                    bot.status === 'running' ? 'bg-primary shadow-[0_0_8px_rgba(var(--primary),0.8)] animate-pulse' :
                    bot.status === 'paused' ? 'bg-chart-3' : 'bg-muted-foreground'
                  }`} />
                  {bot.status}
                </Badge>
              </h1>
            )}
            
            {isEditing ? (
              <Input 
                value={editForm.description} 
                onChange={e => setEditForm(prev => ({...prev, description: e.target.value}))} 
                className="font-mono text-sm h-8 w-full rounded-none bg-background mt-2"
                placeholder="Description..."
              />
            ) : (
              bot.description && <p className="text-muted-foreground font-mono text-sm max-w-2xl">{bot.description}</p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {isEditing ? (
            <>
              <Button size="sm" variant="outline" onClick={() => setIsEditing(false)} className="rounded-none font-mono">
                <X className="h-4 w-4 mr-2" /> CANCEL
              </Button>
              <Button size="sm" onClick={handleSaveEdit} className="rounded-none font-mono" disabled={updateBot.isPending}>
                <Save className="h-4 w-4 mr-2" /> SAVE
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={() => setIsEditing(true)} className="rounded-none font-mono">
                <Edit2 className="h-4 w-4 mr-2" /> EDIT
              </Button>
              <Button size="sm" variant="outline" onClick={handleDownloadXML} className="rounded-none font-mono">
                <Download className="h-4 w-4 mr-2" /> XML
              </Button>
              <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="rounded-none font-mono text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30">
                    <Trash2 className="h-4 w-4 mr-2" /> DELETE
                  </Button>
                </DialogTrigger>
                <DialogContent className="border-destructive/30 bg-card/95 backdrop-blur-xl rounded-none border-l-4 border-l-destructive">
                  <DialogHeader>
                    <DialogTitle className="font-mono font-bold uppercase tracking-wider text-destructive">Delete Bot</DialogTitle>
                    <DialogDescription className="font-mono text-xs">
                      Are you sure you want to delete {bot.name}? This action cannot be undone.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter className="mt-4">
                    <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} className="rounded-none font-mono">CANCEL</Button>
                    <Button variant="destructive" onClick={handleDelete} disabled={deleteBot.isPending} className="rounded-none font-mono">
                      {deleteBot.isPending ? "DELETING..." : "CONFIRM DELETE"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-border shadow-md bg-card/50 backdrop-blur-sm rounded-none border-t-4 border-t-primary">
            <CardHeader className="pb-4">
              <CardTitle className="font-mono text-sm tracking-wider text-muted-foreground uppercase flex items-center gap-2">
                <Code className="h-4 w-4" />
                XML Source Preview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-background border border-border/50 p-4 overflow-x-auto max-h-[500px] overflow-y-auto">
                <pre className="text-xs font-mono text-muted-foreground leading-relaxed">
                  <code>{bot.xmlContent.substring(0, 5000)}{bot.xmlContent.length > 5000 ? '\n\n... [TRUNCATED FOR PREVIEW]' : ''}</code>
                </pre>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-border shadow-md bg-card/50 backdrop-blur-sm rounded-none">
            <CardHeader className="pb-2">
              <CardTitle className="font-mono text-sm tracking-wider text-muted-foreground uppercase">
                Control Panel
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                <Button 
                  variant={bot.status === 'running' ? 'default' : 'outline'} 
                  className={`rounded-none font-mono flex-col h-auto py-3 gap-1 ${bot.status === 'running' ? 'bg-primary/20 text-primary border-primary shadow-[0_0_10px_-2px_hsl(var(--primary)/0.3)] hover:bg-primary/30' : ''}`}
                  onClick={() => handleStatusChange('running')}
                  disabled={updateBot.isPending}
                >
                  <Play className={`h-6 w-6 ${bot.status === 'running' ? 'fill-primary text-primary' : ''}`} />
                  <span className="text-[10px]">RUN</span>
                </Button>
                <Button 
                  variant={bot.status === 'paused' ? 'default' : 'outline'} 
                  className={`rounded-none font-mono flex-col h-auto py-3 gap-1 ${bot.status === 'paused' ? 'bg-chart-3/20 text-chart-3 border-chart-3 shadow-[0_0_10px_-2px_hsl(var(--chart-3)/0.3)] hover:bg-chart-3/30' : ''}`}
                  onClick={() => handleStatusChange('paused')}
                  disabled={updateBot.isPending}
                >
                  <Pause className={`h-6 w-6 ${bot.status === 'paused' ? 'fill-chart-3 text-chart-3' : ''}`} />
                  <span className="text-[10px]">PAUSE</span>
                </Button>
                <Button 
                  variant={bot.status === 'idle' ? 'default' : 'outline'} 
                  className={`rounded-none font-mono flex-col h-auto py-3 gap-1 ${bot.status === 'idle' ? 'bg-muted text-foreground border-muted-foreground shadow-[0_0_10px_-2px_hsl(var(--muted-foreground)/0.3)] hover:bg-muted' : ''}`}
                  onClick={() => handleStatusChange('idle')}
                  disabled={updateBot.isPending}
                >
                  <Square className={`h-6 w-6 ${bot.status === 'idle' ? 'fill-foreground text-foreground' : ''}`} />
                  <span className="text-[10px]">STOP</span>
                </Button>
              </div>

              <div className="pt-4 space-y-3 border-t border-border/50">
                <div className="flex justify-between items-center text-sm font-mono">
                  <span className="text-muted-foreground flex items-center gap-2"><Clock className="h-4 w-4" /> Last Run</span>
                  <span className="font-bold">{bot.lastRunAt ? format(new Date(bot.lastRunAt), 'MMM dd, HH:mm:ss') : 'Never'}</span>
                </div>
                <div className="flex justify-between items-center text-sm font-mono">
                  <span className="text-muted-foreground flex items-center gap-2"><HardDrive className="h-4 w-4" /> Size</span>
                  <span className="font-bold">{(bot.sizeBytes / 1024).toFixed(2)} KB</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border shadow-md bg-card/50 backdrop-blur-sm rounded-none">
            <CardHeader className="pb-2">
              <CardTitle className="font-mono text-sm tracking-wider text-muted-foreground uppercase flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground font-mono uppercase">Strategy</Label>
                <div className="font-mono font-bold">{bot.strategy || "Unknown"}</div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground font-mono uppercase">Market</Label>
                <div className="font-mono font-bold">{bot.market || "Unknown"}</div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground font-mono uppercase">Tags</Label>
                {isEditing ? (
                  <Input 
                    value={editForm.tags} 
                    onChange={e => setEditForm(prev => ({...prev, tags: e.target.value}))} 
                    className="font-mono text-sm h-8 rounded-none bg-background"
                    placeholder="tag1, tag2..."
                  />
                ) : (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {bot.tags && bot.tags.length > 0 ? bot.tags.map(tag => (
                      <Badge key={tag} variant="outline" className="font-mono text-xs rounded-none border-border/50 text-muted-foreground bg-muted/20">
                        {tag}
                      </Badge>
                    )) : <span className="text-sm font-mono text-muted-foreground">No tags</span>}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
