import { useEffect, useState, useCallback } from "react";
import type { Booking, Room, SiteSettings, User } from "./types";

// Base URL for your backend API server (leave blank if using Next.js internal API routes)
const API_BASE = "/api"; 

// Simple cross-component subscription to trigger manual cache refreshes
const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((l) => l());
}

export function useStore() {
  // Global states synced with the API
  const [users, setUsersState] = useState<User[]>([]);
  const [rooms, setRoomsState] = useState<Room[]>([]);
  const [bookings, setBookingsState] = useState<Booking[]>([]);
  const [settings, setSettingsState] = useState<SiteSettings | null>(null);
  const [session, setSessionState] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Synchronize component rerenders
  useEffect(() => {
    const l = () => fetchData();
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);

  // Fetch all core data from Aiven via our API
  const fetchData = async () => {
    try {
      const [uRes, rRes, bRes, sRes] = await Promise.all([
        fetch(`${API_BASE}/users`),
        fetch(`${API_BASE}/rooms`),
        fetch(`${API_BASE}/bookings`),
        fetch(`${API_BASE}/settings`),
      ]);

      if (uRes.ok) setUsersState(await uRes.json());
      if (rRes.ok) setRoomsState(await rRes.json());
      if (bRes.ok) setBookingsState(await bRes.json());
      if (sRes.ok) setSettingsState(await sRes.json());
      
      // Keep session local or look up HTTP-only session cookie
      const savedSession = localStorage.getItem("brealls_session");
      if (savedSession) setSessionState(JSON.parse(savedSession));

    } catch (error) {
      console.error("Failed to load backend Aiven data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // API Setters
  const setUsers = useCallback(async (u: User[]) => {
    await fetch(`${API_BASE}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ users: u }),
    });
    notify();
  }, []);

  const setRooms = useCallback(async (r: Room[]) => {
    await fetch(`${API_BASE}/rooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rooms: r }),
    });
    notify();
  }, []);

  const setBookings = useCallback(async (b: Booking[]) => {
    await fetch(`${API_BASE}/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookings: b }),
    });
    notify();
  }, []);

  const setSettings = useCallback(async (s: SiteSettings) => {
    await fetch(`${API_BASE}/settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(s),
    });
    notify();
  }, []);

  const setSession = useCallback((u: User | null) => {
    if (u) {
      localStorage.setItem("brealls_session", JSON.stringify(u));
      setSessionState(u);
    } else {
      localStorage.removeItem("brealls_session");
      setSessionState(null);
    }
    notify();
  }, []);

  return {
    users,
    rooms,
    bookings,
    settings,
    session,
    loading,
    setUsers,
    setRooms,
    setBookings,
    setSettings,
    setSession,
    refresh: fetchData
  };
}

// Utility features preserved 
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function uid(prefix = "id") {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  const a = new Date(checkIn).getTime();
  const b = new Date(checkOut).getTime();
  const diff = Math.ceil((b - a) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 1;
}

export function formatPHP(n: number) {
  return "₱" + n.toLocaleString("en-PH");
}

export function roomBlockingBookings(bookings: Booking[], roomId: string) {
  return bookings.filter((b) => b.roomId === roomId && b.status !== "Cancelled");
}

export function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart < bEnd && bStart < aEnd;
}

export function findConflicts(bookings: Booking[], roomId: string, checkIn: string, checkOut: string) {
  return roomBlockingBookings(bookings, roomId).filter((b) =>
    rangesOverlap(checkIn, checkOut, b.checkIn, b.checkOut)
  );
}

export function nextAvailableFrom(bookings: Booking[], roomId: string, fromDate: string) {
  const blocks = roomBlockingBookings(bookings, roomId)
    .filter((b) => b.checkOut > fromDate)
    .sort((a, b) => a.checkIn.localeCompare(b.checkIn));
  if (blocks.length === 0) return fromDate;
  let cursor = fromDate;
  for (const b of blocks) {
    if (b.checkIn > cursor) return cursor;
    if (b.checkOut > cursor) cursor = b.checkOut;
  }
  return cursor;
}
