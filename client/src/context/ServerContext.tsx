import { createContext, useContext, useState, useEffect, useMemo } from "react";
import type { ReactNode } from "react";
import { createApi, pingServer } from "../api";

interface ServerContextType {
  api: ReturnType<typeof createApi>;
  serverStatus: { ok: boolean; ms: number };
}

const ServerContext = createContext<ServerContextType>(null!);

export function ServerProvider({ children }: { children: ReactNode }) {
  const [serverStatus, setServerStatus] = useState({ ok: false, ms: 0 });
  const api = useMemo(() => createApi(), []);

  useEffect(() => {
    const check = async () => {
      const status = await pingServer();
      setServerStatus(status);
    };
    check();
    const interval = setInterval(check, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <ServerContext.Provider value={{ api, serverStatus }}>
      {children}
    </ServerContext.Provider>
  );
}

export function useServer() {
  return useContext(ServerContext);
}

