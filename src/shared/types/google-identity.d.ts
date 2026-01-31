export {};

declare global {
  interface GoogleCodeClient {
    requestCode: () => void;
  }

  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initCodeClient: (options: {
            client_id: string;
            scope: string;
            ux_mode: "popup" | "redirect";
            redirect_uri: string;
            access_type?: string;
            prompt?: string;
            callback: (response: { code?: string; error?: string }) => void;
          }) => GoogleCodeClient;
        };
      };
    };
  }
}
