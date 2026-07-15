import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TabbedApp } from "@/components/layout/TabbedApp";
import { AppShell } from "@/components/layout/AppShell";
import NotFound from "@/pages/not-found";

import Accounts from "@/pages/accounts";
import OAuthCallback from "@/pages/oauth-callback";
import BotsList from "@/pages/bots";
import BotDetail from "@/pages/bots/[id]";
import ToolsList from "@/pages/tools";
import MartingaleTool from "@/pages/tools/martingale";
import RiskTool from "@/pages/tools/risk";
import CompoundTool from "@/pages/tools/compound";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      {/* Dedicated OAuth callback — matches the redirect_uri registered in Deriv.
          Deriv redirects here after the user authorises:
          /callback?acct1=CR123&token1=xxx&acct2=VRTC456&token2=yyy&state=<nonce> */}
      <Route path="/callback" component={OAuthCallback} />

      <Route path="/" component={TabbedApp} />
      <Route path="/accounts">
        <AppShell><Accounts /></AppShell>
      </Route>
      <Route path="/bots">
        <AppShell><BotsList /></AppShell>
      </Route>
      <Route path="/bots/:id">
        <AppShell><BotDetail /></AppShell>
      </Route>
      <Route path="/tools">
        <AppShell><ToolsList /></AppShell>
      </Route>
      <Route path="/tools/martingale">
        <AppShell><MartingaleTool /></AppShell>
      </Route>
      <Route path="/tools/risk">
        <AppShell><RiskTool /></AppShell>
      </Route>
      <Route path="/tools/compound">
        <AppShell><CompoundTool /></AppShell>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
