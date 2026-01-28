"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function QueryProvider({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        // Data is considered fresh for 60 seconds
                        staleTime: 60 * 1000,
                        // Keep unused data in cache for 5 minutes
                        gcTime: 5 * 60 * 1000,
                        // Retry failed requests up to 2 times
                        retry: 2,
                        // Refetch on window focus (when user tabs back)
                        refetchOnWindowFocus: true,
                    },
                },
            })
    );

    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
}
