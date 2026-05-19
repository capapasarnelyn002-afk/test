import { useEffect, useState, useCallback } from "react";
import type { Booking, Room, SiteSettings, User } from "./types";

// Base URL configuration for your API backend
const API_BASE = "http://localhost:5000/api"; 

// Simple cross-component subscription to trigger state updates
const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((l) => l());
}

export function useStore() {
  const [users, setUsersState] = useState<User[]>([]);
  const [rooms, setRoomsState] = useState<Room[]>([]);
  const [bookings, setBookingsState] = useState<Booking[]>([]);
  const [settings, setSettingsState] = useState<SiteSettings | null>(null);
  const [session, setSessionState] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Synchronize cross-component state updates
  useEffect(() => {
    const l = () => fetchData();
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);

  const fetchData = async () => {
    try {
      const [uRes, rRes, bRes, sRes] = await Promise.all([
        fetch(`${API_BASE}/users`).then(r => r.ok ? r.json() : []),
        fetch(`${API_BASE}/rooms`).then(r => r.ok ? r.json() : []),
        fetch(`${API_BASE}/bookings`).then(r => r.ok ? r.json() : []),
        fetch(`${API_BASE}/settings`).then(r => r.ok ? r.json() : null),
      ]);

      // Normalize MySQL snake_case database schema maps safely back to Frontend camelCase
      const mappedRooms = rRes.map((r: any) => ({
        id: r.id,
        name: r.name,
        type: r.type,
        capacity: Number(r.capacity),
        price: Number(r.price),
        description: r.description,
        image: r.image_url || r.image,
        available: Boolean(r.available)
      }));

      const mappedSettings: SiteSettings | null = sRes ? {
        heroImage: sRes.hero_image || sRes.heroImage || "",
        heroTitle: sRes.hero_title || sRes.heroTitle || "",
        heroSubtitle: sRes.hero_subtitle || sRes.heroSubtitle || "",
        contactPhone: sRes.contact_phone || sRes.contactPhone || "",
        contactEmail: sRes.contact_email || sRes.contactEmail || "",
        contactLocation: sRes.contact_location || sRes.contactLocation || "",
        downpaymentPercent: Number(sRes.downpayment_percent || sRes.downpaymentPercent || 50),
        gcashNumber: sRes.gcash_number || sRes.gcashNumber || "",
        gcashName: sRes.gcash_name || sRes.gcashName || "",
        bankName: sRes.bank_name || sRes.bankName || "",
        bankAccountNumber: sRes.bank_account_number || sRes.bankAccountNumber || "",
        bankAccountName: sRes.bank_account_name || sRes.bankAccountName || "",
      } : null;

      const mappedBookings = bRes.map((b: any) => ({
        id: String(b.id),
        roomId: b.room_id || b.roomId,
        customerId: b.customer_id || b.customerId,
        customerName: b.customer_name || b.customerName,
        customerEmail: b.customer_email || b.customerEmail,
        customerPhone: b.customer_phone || b.customerPhone,
        checkIn: b.check_in || b.checkIn,
        checkOut: b.check_out || b.checkOut,
        guests: Number(b.guests),
        roomsQty: Number(b.rooms_qty || b.roomsQty || 1),
        total: Number(b.total),
        downpayment: Number(b.downpayment),
        balance: Number(b.balance),
        paymentMethod: b.payment_method || b.paymentMethod,
        paymentStatus: b.payment_status || b.paymentStatus,
        paymentReference: b.payment_reference || b.paymentReference,
        paymentProof: b.payment_proof || b.paymentProof,
        status: b.status
      }));

      setUsersState(uRes);
      setRoomsState(mappedRooms);
      setBookingsState(mappedBookings);
      setSettingsState(mappedSettings);
      
      const savedSession = localStorage.getItem("brealls_session");
      if (savedSession) setSessionState(JSON.parse(savedSession));

    } catch (error) {
      console.error("❌ API Fetch Error inside useStore:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const setUsers = useCallback(async (u: User[]) => {
    try {
      await fetch(`${API_BASE}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ users: u }),
      });
      notify();
    } catch (e) { console.error(e); }
  }, []);

  const setRooms = useCallback(async (r: Room[]) => {
    try {
      await fetch(`${API_BASE}/rooms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rooms: r }),
      });
      notify();
    } catch (e) { console.error(e); }
  }, []);

  const setBookings = useCallback(async (b: Booking[]) => {
    try {
      await fetch(`${API_BASE}/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookings: b }),
      });
      notify();
    } catch (e) { console.error(e); }
  }, []);

  const setSettings = useCallback(async (s: SiteSettings) => {
    try {
      await fetch(`${API_BASE}/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(s),
      });
      notify();
    } catch (e) { console.error(e); }
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

// --- UTILITY LOGIC (Preserved perfectly from original file) ---

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
  return "₱" + (n || 0).toLocaleString("en-PH");
}

export function roomBlockingBookings(bookings: Booking[], roomId: string) {
  if (!Array.isArray(bookings)) return [];
  return bookings.filter((b) => b && b.roomId === roomId && b.status !== "Cancelled");
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
