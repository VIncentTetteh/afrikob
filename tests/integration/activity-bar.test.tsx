import { act, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { ActivityBar } from "@/components/layout/activity-bar";

vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard", useSearchParams: () => new URLSearchParams() }));

function Slow({ release }: { release: Promise<unknown> }) {
  useQuery({ queryKey: ["slow"], queryFn: () => release });
  return null;
}

describe("activity bar", () => {
  it("appears while a request is in flight and goes once it settles", async () => {
    let finish: (v: unknown) => void = () => {};
    const release = new Promise((resolve) => (finish = resolve));
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ActivityBar />
        <Slow release={release} />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Loading…"));
    await act(async () => {
      finish([]);
      await release;
    });
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/^$/));
  });
});
