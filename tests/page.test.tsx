// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import Page from "../app/page";

const slots = [
  { id: "a", provider: "Dr Ada", start: "2035-01-01T09:00:00Z", end: "2035-01-01T09:30:00Z", available: true },
  { id: "b", provider: "Dr Bisi", start: "2035-01-02T10:00:00Z", end: "2035-01-02T10:30:00Z", available: true },
];
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("patient booking page", () => {
  it("explains that a time is required without trapping the user behind a disabled button", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => reply({ slots })));
    render(<Page />);
    await screen.findByRole("button", { name: /Dr Ada/ });
    const action = screen.getByRole("button", { name: "Choose an appointment time" }) as HTMLButtonElement;
    expect(action.disabled).toBe(false);
    expect(action.type).toBe("button");
  });

  it("explains Netlify visitor access failures beside the appointment list", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => reply({}, 401)));
    render(<Page />);
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/Netlify project must be public/));
    expect(screen.getByRole("button", { name: "Retry loading times" })).not.toBeNull();
  });

  it("shows a loading state and keeps provider choices available after filtering", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => reply({ slots })));
    render(<Page />);
    expect(screen.getByRole("status").textContent).toMatch(/Finding available/);
    await screen.findByRole("button", { name: /Dr Ada/ });
    fireEvent.change(screen.getByLabelText("Provider"), { target: { value: "Dr Ada" } });
    expect(screen.queryByRole("button", { name: /Dr Bisi/ })).toBeNull();
    expect(screen.getByRole("option", { name: "Dr Bisi" })).not.toBeNull();
  });

  it("marks available calendar dates and shows only times for the chosen day", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => reply({ slots })));
    render(<Page />);
    await screen.findByRole("button", { name: /Dr Ada/ });
    const secondDate = screen.getByRole("button", { name: /^Tuesday, 2 January 2035$/ });
    expect((secondDate as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(secondDate);
    expect(screen.queryByRole("button", { name: /Dr Ada/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Dr Bisi/ })).not.toBeNull();
  });

  it("books a selected time and displays its confirmation", async () => {
    const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
      void options;
      return url.includes("/slots")
        ? reply({ slots })
        : reply({ id: "d9ad4051-bfa0-4ae9-ad2b-22d08278e93a", name: "Ada Obi", email: "ada@example.com" }, 201);
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("crypto", { randomUUID: () => "retry-key" });
    render(<Page />);
    fireEvent.click(await screen.findByRole("button", { name: /Dr Ada/ }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("heading", { name: "Your details" })).not.toBeNull();
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Ada Obi" } });
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "ada@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm appointment" }));
    await screen.findByText("You're all set.");
    expect(screen.getByText("d9ad4051-bfa0-4ae9-ad2b-22d08278e93a")).not.toBeNull();
    const request = fetchMock.mock.calls.find(([url]) => url === "/api/web/bookings");
    expect(request?.[1]?.headers).toMatchObject({ "Idempotency-Key": "retry-key" });
  });

  it("explains a slot conflict and refreshes availability", async () => {
    let slotLoads = 0;
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("/slots")) return reply({ slots: ++slotLoads === 1 ? slots : [{ ...slots[0], available: false }, slots[1]] });
      return reply({ error: "Slot is already booked" }, 409);
    }));
    vi.stubGlobal("crypto", { randomUUID: () => "retry-key" });
    render(<Page />);
    fireEvent.click(await screen.findByRole("button", { name: /Dr Ada/ }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Ada Obi" } });
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "ada@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm appointment" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/just booked/));
    await waitFor(() => expect(screen.queryByRole("button", { name: /Dr Ada/ })).toBeNull());
  });
});
