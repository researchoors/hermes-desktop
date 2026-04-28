declare global {
  interface Window {
    electronAPI?: {
      isElectron: boolean;
      platform: string;
      terminal: {
        create: (id: string) => Promise<{ success: boolean }>;
        input: (id: string, data: string) => Promise<{ success: boolean }>;
        resize: (id: string, cols: number, rows: number) => Promise<{ success: boolean }>;
        close: (id: string) => Promise<{ success: boolean }>;
        onOutput: (callback: (data: { id: string; data: string }) => void) => void;
        onExit: (callback: (data: { id: string; exitCode: number }) => void) => void;
      };
      settings: {
        get: () => Promise<{
          gatewayUrl: string;
          gatewayApiKey: string;
          disableAuth: boolean;
        }>;
        save: (settings: {
          gatewayUrl?: string;
          gatewayApiKey?: string;
          disableAuth?: boolean;
        }) => Promise<{
          gatewayUrl: string;
          gatewayApiKey: string;
          disableAuth: boolean;
        }>;
        openWindow: () => Promise<void>;
      };
    };
  }
}

export {};
