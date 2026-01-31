import { useQuery } from "@tanstack/react-query";

export function useCount() {
  const API_URL =
    import.meta.env.VITE_API_URL ||
    (typeof window !== "undefined" ? window.location.origin : "");

  return useQuery({
    queryKey: ["count"],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/count`);
      if (!res.ok) throw new Error("Count check failed");
      return res.json();
    },
  });
}
