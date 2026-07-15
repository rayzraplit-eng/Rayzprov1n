import { useState, useEffect, useRef } from "react";

export type DerivTick = {
  ask: number;
  bid: number;
  epoch: number;
  id: string;
  pip_size: number;
  quote: number;
  symbol: string;
};

export function useDerivTicks(symbol: string) {
  const [ticks, setTicks] = useState<DerivTick[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!symbol) return;
    
    setTicks([]);
    const ws = new WebSocket("wss://ws.binaryws.com/websockets/v3?app_id=1089");
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      ws.send(JSON.stringify({ ticks: symbol, subscribe: 1 }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.tick) {
        setTicks(prev => [...prev, data.tick].slice(-100));
      }
    };

    ws.onclose = () => {
      setConnected(false);
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ forget_all: "ticks" }));
        ws.close();
      }
    };
  }, [symbol]);

  return { ticks, connected };
}
