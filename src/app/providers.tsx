import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";

import { RoomProvider } from "../features/Room/model/RoomProvider";

const queryClient = new QueryClient();

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#38bdf8" }, // sky-400
    secondary: { main: "#a855f7" }, // violet-500
    background: {
      default: "#0f172a",
      paper: "#0b1224",
    },
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: '"Inter","Segoe UI","Noto Sans TC",sans-serif',
  },
});

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <QueryClientProvider client={queryClient}>
        <RoomProvider>{children}</RoomProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
