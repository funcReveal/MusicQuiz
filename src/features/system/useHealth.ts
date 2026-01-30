import { useQuery } from "@tanstack/react-query";

export function useHealth() {
  const API_URL =
    import.meta.env.VITE_API_URL ||
    (typeof window !== "undefined" ? window.location.origin : "");

  return useQuery({
    queryKey: ["health"],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/health`);
      if (!res.ok) throw new Error("Health check failed");
      return res.json();
    },
  });
}
