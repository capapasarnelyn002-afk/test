import { useMemo, useRef, useState, useEffect } from "react";
import { fileToDataUrl, formatPHP, uid, useStore } from "../store";
import type { Booking, Room, RoomType } from "../types";
import { IconCheck, IconEdit, IconImage, IconPlus, IconTrash, IconX } from "./Icons";
import { Labelled, Modal } from "./Rooms";

type Tab = "dashboard" | "rooms" | "bookings" | "records" | "site" | "users";

// Base URL configuration for your Express Node.js API server
const API_URL = "http://localhost:5000/api";

export function AdminPanel() {
  const { session } = useStore();
  const [tab, setTab] = useState<Tab>("dashboard");

  if (!session || (session.role !== "admin" && session.role !== "staff")) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <h2 className="text-2xl font-bold text-slate-900">Access denied</h2>
        <p className="text-slate-600 mt-2">
          You need to log in as admin or staff to view this page.
        </p>
      </div>
    );
  }

  const isAdmin = session.role === "admin";
  const tabs: { id: Tab; label: string; show: boolean }[] = [
    { id: "dashboard", label: "Dashboard", show: true },
    { id: "rooms", label: "Manage Rooms", show: isAdmin },
    { id: "bookings", label: "Bookings", show: true },
    { id: "records", label: "Booked Records", show: true },
    { id: "site", label: "Site Settings", show: isAdmin },
    { id: "users", label: "Users", show: isAdmin },
  ];

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">
            {isAdmin ? "Admin" : "Staff"} Panel
          </h2>
          <p className="text-slate-600">
            Welcome back, <span className="font-semibold">{session.name}</span>.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-200 mb-6">
        {tabs
          .filter((t) => t.show)
          .map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-sm font-semibold rounded-t-lg border-b-2 -mb-px ${
                tab === t.id
                  ? "border-teal-600 text-teal-700 bg-teal-50"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              {t.label}
            </button>
          ))}
      </div>

      {tab === "dashboard" && <Dashboard />}
      {tab === "rooms" && isAdmin && <ManageRooms />}
      {tab === "bookings" && <ManageBookings />}
      {tab === "records" && <BookedRecords />}
      {tab === "site" && isAdmin && <SiteSettingsForm />}
      {tab === "users" && isAdmin && <ManageUsers />}
    </section>
  );
}

function Dashboard() {
  const [stats, setStats] = useState({
    totalRooms: 0,
    pendingBookings: 0,
    confirmedBookings: 0,
    totalCustomers: 0,
    revenue: 0,
  });

  useEffect(() => {
    // Dynamically request calculated counts from the database metrics endpoint
    fetch(`${API_URL}/users`)
      .then((res) => res.json())
      .then((users: any[]) => {
        const customersCount = users.filter((u) => u.role === "customer").length;
        setStats((prev) => ({ ...prev, totalCustomers: customersCount }));
      })
      .catch((err) => console.error("Dashboard calculation error:", err));
    
    // In a full implementation, you can make similar fetch loops for your rooms and total bookings counters
  }, []);

  const { rooms, bookings, users } = useStore();
  const pending = bookings.filter((b) => b.status === "Pending").length;
  const confirmed = bookings.filter((b) => b.status === "Confirmed").length;
  const revenue = bookings
    .filter((b) => b.status === "Confirmed")
    .reduce((s, b) => s + b.total, 0);

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Stat label="Total Rooms" value={rooms.length} color="teal" />
      <Stat label="Pending Bookings" value={pending} color="amber" />
      <Stat label="Confirmed Bookings" value={confirmed} color="emerald" />
      <Stat label="Total Customers" value={stats.totalCustomers || users.filter((u) => u.role === "customer").length} color="slate" />
      <Stat label="Revenue (Confirmed)" value={formatPHP(revenue)} color="teal" wide />
    </div>
  );
}

function Stat({
  label,
  value,
  color,
  wide,
}: {
  label: string;
  value: string | number;
  color: "teal" | "amber" | "emerald" | "slate";
  wide?: boolean;
}) {
  const styles = {
    teal: "from-teal-500 to-emerald-600",
    amber: "from-amber-500 to-orange-600",
    emerald: "from-emerald-500 to-green-600",
    slate: "from-slate-600 to-slate-800",
  }[color];
  return (
    <div
      className={`${
        wide ? "sm:col-span-2" : ""
      } bg-gradient-to-br ${styles} text-white rounded-2xl p-5 shadow-lg`}
    >
      <div className="text-xs uppercase tracking-wider opacity-80 font-semibold">{label}</div>
      <div className="text-3xl font-bold mt-2">{value}</div>
    </div>
  );
}

function ManageRooms() {
  const { rooms, setRooms } = useStore();
  const [editing, setEditing] = useState<Room | null>(null);
  const [adding, setAdding] = useState(false);

  const remove = (id: string) => {
    if (confirm("Delete this room?")) setRooms(rooms.filter((r) => r.id !== id));
  };

  const save = (room: Room) => {
    if (rooms.some((r) => r.id === room.id)) {
      setRooms(rooms.map((r) => (r.id === room.id ? room : r)));
    } else {
      setRooms([...rooms, room]);
    }
    setEditing(null);
    setAdding(false);
  };

  return (
    <div className="animate-fadeIn">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-xl text-slate-900">Lodges & Cottages</h3>
        <button
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold px-4 py-2 rounded-lg"
        >
          <IconPlus /> Add Room
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {rooms.map((r) => (
          <AdminRoomCard
            key={r.id}
            room={r}
            onEdit={() => setEditing(r)}
            onDelete={() => remove(r.id)}
            onImageChange={(img) => setRooms(rooms.map((x) => (x.id === r.id ? { ...x, image: img } : x)))}
            onToggleAvailable={() =>
              setRooms(rooms.map((x) => (x.id === r.id ? { ...x, available: !x.available } : x)))
            }
          />
        ))}
      </div>

      {(editing || adding) && (
        <RoomForm
          room={
            editing || {
              id: uid("r"),
              name: "",
              type: "Lodge",
              capacity: 2,
              price: 1500,
              description: "",
              image: "",
              available: true,
            }
          }
          onCancel={() => {
            setEditing(null);
            setAdding(false);
          }}
          onSave={save}
        />
      )}
    </div>
  );
}

function AdminRoomCard({
  room,
  onEdit,
  onDelete,
  onImageChange,
  onToggleAvailable,
}: {
  room: Room;
  onEdit: () => void;
  onDelete: () => void;
  onImageChange: (img: string) => void;
  onToggleAvailable: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    const url = await fileToDataUrl(file);
    onImageChange(url);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="relative aspect-video bg-slate-100 group">
        {room.image ? (
          <img src={room.image} alt={room.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-400">
            <IconImage width={32} height={32} />
          </div>
        )}
        <button
          onClick={() => fileRef.current?.click()}
          className="absolute inset-0 bg-slate-900/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white font-semibold gap-2"
        >
          <IconImage /> Change Image
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="font-bold text-slate-900">{room.name}</div>
            <div className="text-xs text-slate-500">
              {room.type} • {room.capacity} guests
            </div>
          </div>
          <div className="text-right">
            <div className="font-bold text-teal-700">{formatPHP(room.price)}</div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500">
              per night
            </div>
          </div>
        </div>
        <p className="text-sm text-slate-600 mt-2 line-clamp-2">{room.description}</p>
        <div className="flex gap-2 mt-3">
          <button
            onClick={onToggleAvailable}
            className={`flex-1 text-xs font-semibold py-2 rounded-lg ${
              room.available
                ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                : "bg-rose-50 text-rose-700 hover:bg-rose-100"
            }`}
          >
            {room.available ? "Available" : "Unavailable"}
          </button>
          <button
            onClick={onEdit}
            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
            title="Edit"
          >
            <IconEdit width={16} height={16} />
          </button>
          <button
            onClick={onDelete}
            className="p-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600"
            title="Delete"
          >
            <IconTrash width={16} height={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

function RoomForm({
  room,
  onSave,
  onCancel,
}: {
  room: Room;
  onSave: (r: Room) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<Room>(room);
  const fileRef = useRef<HTMLInputElement>(null);
  const handleFile = async (file: File) => {
    const url = await fileToDataUrl(file);
    setDraft({ ...draft, image: url });
  };

  return (
    <Modal title={room.name ? `Edit ${room.name}` : "Add new room"} onClose={onCancel} size="lg">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <div
            className="aspect-video bg-slate-100 rounded-xl overflow-hidden flex items-center justify-center cursor-pointer relative group"
            onClick={() => fileRef.current?.click()}
          >
            {draft.image ? (
              <img src={draft.image} alt="preview" className="w-full h-full object-cover" />
            ) : (
              <div className="text-slate-400 text-sm">Click to upload image</div>
            )}
            <div className="absolute inset-0 bg-slate-900/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white font-semibold gap-2">
              <IconImage /> Upload Image
            </div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          <Labelled label="Or paste image URL">
            <input
              value={draft.image.startsWith("data:") ? "" : draft.image}
              onChange={(e) => setDraft({ ...draft, image: e.target.value })}
              placeholder="https://..."
              className="input"
            />
          </Labelled>
        </div>
        <div className="space-y-3">
          <Labelled label="Name">
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              className="input"
            />
          </Labelled>
          <div className="grid grid-cols-2 gap-3">
            <Labelled label="Type">
              <select
                value={draft.type}
                onChange={(e) =>
                  setDraft({ ...draft, type: e.target.value as RoomType })
                }
                className="input"
              >
                <option value="Lodge">Lodge</option>
                <option value="Cottage">Cottage</option>
              </select>
            </Labelled>
            <Labelled label="Capacity">
              <input
                type="number"
                min={1}
                value={draft.capacity}
                onChange={(e) => setDraft({ ...draft, capacity: +e.target.value })}
                className="input"
              />
            </Labelled>
          </div>
          <Labelled label="Price (₱ per night)">
            <input
              type="number"
              min={0}
              value={draft.price}
              onChange={(e) => setDraft({ ...draft, price: +e.target.value })}
              className="input"
            />
          </Labelled>
          <Labelled label="Description">
            <textarea
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              className="input min-h-24"
            />
          </Labelled>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.available}
              onChange={(e) => setDraft({ ...draft, available: e.target.checked })}
              className="accent-teal-600 w-4 h-4"
            />
            Available for booking
          </label>
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => onSave(draft)}
              disabled={!draft.name.trim()}
              className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white font-semibold py-2.5 rounded-lg"
            >
              Save
            </button>
            <button
              onClick={onCancel}
              className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold py-2.5 rounded-lg"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function ManageBookings() {
  const { bookings, rooms, setBookings } = useStore();
  const [filter, setFilter] = useState<Booking["status"] | "All">("All");
  const [viewing, setViewing] = useState<Booking | null>(null);

  const list = filter === "All" ? bookings : bookings.filter((b) => b.status === filter);

  const update = (id: string, status: Booking["status"]) =>
    setBookings(bookings.map((b) => (b.id === id ? { ...b, status } : b)));

  const markPaid = (id: string) =>
    setBookings(
      bookings.map((b) =>
        b.id === id ? { ...b, paymentStatus: "Paid", status: "Confirmed" } : b
      )
    );

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        {(["All", "Pending", "Confirmed", "Cancelled"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium ${
              filter === s
                ? "bg-teal-600 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-3">Customer</th>
                <th className="text-left px-4 py-3">Room</th>
                <th className="text-left px-4 py-3">Dates</th>
                <th className="text-left px-4 py-3">Guests</th>
                <th className="text-right px-4 py-3">Down / Total</th>
                <th className="text-center px-4 py-3">Payment</th>
                <th className="text-center px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center text-slate-500 py-10">
                    No bookings yet.
                  </td>
                </tr>
              )}
              {list.map((b) => {
                const room = rooms.find((r) => r.id === b.roomId);
                return (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{b.customerName}</div>
                      <div className="text-xs text-slate-500">{b.customerEmail}</div>
                      {b.customerPhone && (
                        <div className="text-xs text-slate-500">{b.customerPhone}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">{room?.name || "—"}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {b.checkIn}
                      <span className="text-slate-400"> → </span>
                      {b.checkOut}
                    </td>
                    <td className="px-4 py-3">{b.guests}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="font-semibold text-amber-700">
                        {formatPHP(b.downpayment)}
                      </div>
                      <div className="text-xs text-slate-500">
                        of {formatPHP(b.total)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <PaymentBadge status={b.paymentStatus} />
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {b.paymentMethod}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={b.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 justify-end">
                        <button
                          onClick={() => setViewing(b)}
                          className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
                          title="View details"
                        >
                          View
                        </button>
                        {b.paymentStatus === "Awaiting Verification" && (
                          <button
                            onClick={() => markPaid(b.id)}
                            className="px-2 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold"
                            title="Mark paid & confirm"
                          >
                            Mark Paid
                          </button>
                        )}
                        {b.status !== "Confirmed" && (
                          <button
                            onClick={() => update(b.id, "Confirmed")}
                            className="p-1.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700"
                            title="Confirm"
                          >
                            <IconCheck width={16} height={16} />
                          </button>
                        )}
                        {b.status !== "Cancelled" && (
                          <button
                            onClick={() => update(b.id, "Cancelled")}
                            className="p-1.5 rounded bg-rose-50 hover:bg-rose-100 text-rose-700"
                            title="Cancel"
                          >
                            <IconX width={16} height={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {viewing && (
        <Modal
          title={`Booking ${viewing.id}`}
          onClose={() => setViewing(null)}
          size="lg"
        >
          <BookingDetails
            booking={viewing}
            room={rooms.find((r) => r.id === viewing.roomId)}
          />
        </Modal>
      )}
    </div>
  );
}

function PaymentBadge({ status }: { status: Booking["paymentStatus"] }) {
  const styles: Record<Booking["paymentStatus"], string> = {
    Paid: "bg-emerald-100 text-emerald-700",
    "Awaiting Verification": "bg-amber-100 text-amber-700",
    Unpaid: "bg-slate-100 text-slate-700",
    Refunded: "bg-blue-100 text-blue-700",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${styles[status]}`}>
      {status}
    </span>
  );
}

function BookingDetails({
  booking,
  room,
}: {
  booking: Booking;
  room?: { name: string; image: string };
}) {
  return (
    <div className="grid sm:grid-cols-2 gap-5">
      <div className="space-y-2 text-sm">
        <div className="font-bold text-slate-900 text-base">
          {room?.name || "Room"}
        </div>
        <DRow k="Customer" v={booking.customerName} />
        <DRow k="Email" v={booking.customerEmail} />
        {booking.customerPhone && <DRow k="Phone" v={booking.customerPhone} />}
        <DRow k="Check-in" v={booking.checkIn} />
        <DRow k="Check-out" v={booking.checkOut} />
        <DRow k="Guests" v={String(booking.guests)} />
        <DRow k="Total" v={formatPHP(booking.total)} />
        <DRow k="Downpayment" v={formatPHP(booking.downpayment)} />
        <DRow k="Balance" v={formatPHP(booking.balance)} />
        <DRow k="Payment Method" v={booking.paymentMethod} />
        <DRow k="Payment Status" v={booking.paymentStatus} />
        {booking.paymentReference && (
          <DRow k="Reference #" v={booking.paymentReference} />
        )}
        <DRow k="Booked On" v={new Date(booking.createdAt).toLocaleString()} />
      </div>
      <div>
        <div className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-2">
          Proof of Payment
        </div>
        {booking.paymentProof ? (
          <img
            src={booking.paymentProof}
            alt="proof"
            className="w-full rounded-xl border border-slate-200"
          />
        ) : (
          <div className="border border-dashed border-slate-300 rounded-xl p-8 text-center text-sm text-slate-500">
            No proof uploaded
          </div>
        )}
      </div>
    </div>
  );
}

function DRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-slate-100 py-1.5">
      <span className="text-slate-500">{k}</span>
      <span className="font-semibold text-slate-800 text-right break-all">{v}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: Booking["status"] }) {
  const styles = {
    Pending: "bg-amber-100 text-amber-700",
    Confirmed: "bg-emerald-100 text-emerald-700",
    Cancelled: "bg-rose-100 text-rose-700",
  }[status];
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${styles}`}>
      {status}
    </span>
  );
}

function SiteSettingsForm() {
  const { settings, setSettings } = useStore();
  const [draft, setDraft] = useState(settings);
  const fileRef = useRef<HTMLInputElement>(null);
  const [saved, setSaved] = useState(false);

  const handleHero = async (file: File) => {
    const url = await fileToDataUrl(file);
    setDraft({ ...draft, heroImage: url });
  };

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <h3 className="font-bold text-lg text-slate-900 mb-4">Hero Background</h3>
        <div
          className="aspect-video rounded-xl overflow-hidden bg-slate-100 relative group cursor-pointer"
          onClick={() => fileRef.current?.click()}
        >
          <img src={draft.heroImage} alt="hero" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-slate-900/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white font-semibold gap-2">
            <IconImage /> Change Background Image
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleHero(e.target.files[0])}
        />
        <Labelled label="Or paste image URL">
          <input
            value={draft.heroImage.startsWith("data:") ? "" : draft.heroImage}
            onChange={(e) => setDraft({ ...draft, heroImage: e.target.value })}
            placeholder="https://..."
            className="input"
          />
        </Labelled>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
        <h3 className="font-bold text-lg text-slate-900 mb-2">Site Content</h3>
        <Labelled label="Hero Title">
          <input
            value={draft.heroTitle}
            onChange={(e) => setDraft({ ...draft, heroTitle: e.target.value })}
            className="input"
          />
        </Labelled>
        <Labelled label="Hero Subtitle">
          <textarea
            value={draft.heroSubtitle}
            onChange={(e) => setDraft({ ...draft, heroSubtitle: e.target.value })}
            className="input min-h-24"
          />
        </Labelled>
        <Labelled label="Contact Phone">
          <input
            value={draft.contactPhone}
            onChange={(e) => setDraft({ ...draft, contactPhone: e.target.value })}
            className="input"
          />
        </Labelled>
        <Labelled label="Contact Email">
          <input
            value={draft.contactEmail}
            onChange={(e) => setDraft({ ...draft, contactEmail: e.target.value })}
            className="input"
          />
        </Labelled>
        <Labelled label="Location">
          <input
            value={draft.contactLocation}
            onChange={(e) => setDraft({ ...draft, contactLocation: e.target.value })}
            className="input"
          />
        </Labelled>

        <div className="pt-3 border-t border-slate-200">
          <div className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-2">
            Payment Settings
          </div>
          <Labelled label="Required downpayment %">
            <input
              type="number"
              min={0}
              max={100}
              value={draft.downpaymentPercent}
              onChange={(e) =>
                setDraft({ ...draft, downpaymentPercent: +e.target.value })
              }
              className="input"
            />
          </Labelled>
          <div className="grid grid-cols-2 gap-3 mt-2">
            <Labelled label="GCash / Maya Number">
              <input
                value={draft.gcashNumber}
                onChange={(e) => setDraft({ ...draft, gcashNumber: e.target.value })}
                className="input"
              />
            </Labelled>
            <Labelled label="Account Name">
              <input
                value={draft.gcashName}
                onChange={(e) => setDraft({ ...draft, gcashName: e.target.value })}
                className="input"
              />
            </Labelled>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-2">
            <Labelled label="Bank">
              <input
                value={draft.bankName}
                onChange={(e) => setDraft({ ...draft, bankName: e.target.value })}
                className="input"
              />
            </Labelled>
            <Labelled label="Bank Account #">
              <input
                value={draft.bankAccountNumber}
                onChange={(e) =>
                  setDraft({ ...draft, bankAccountNumber: e.target.value })
                }
                className="input"
              />
            </Labelled>
            <Labelled label="Bank Account Name">
              <input
                value={draft.bankAccountName}
                onChange={(e) =>
                  setDraft({ ...draft, bankAccountName: e.target.value })
                }
                className="input"
              />
            </Labelled>
          </div>
        </div>

        <button
          onClick={() => {
            setSettings(draft);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
          }}
          className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 rounded-lg"
        >
          {saved ? "✓ Saved!" : "Save Settings"}
        </button>
      </div>
    </div>
  );
}

function ManageUsers() {
  const [dbUsers, setDbUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Hook into our live Express bridge server endpoint
  useEffect(() => {
    fetch(`${API_URL}/users`)
      .then((res) => res.json())
      .then((data) => {
        setDbUsers(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error pulling database profiles:", err);
        setLoading(false);
      });
  }, []);

  const remove = (id: string) => {
    if (confirm("Delete this user?")) {
      // Optimistic state updates before firing deletion tracking actions
      setDbUsers(dbUsers.filter((u) => u.id !== id));
    }
  };

  if (loading) {
    return <div className="p-10 text-center text-slate-500 text-sm">Loading database records...</div>;
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm animate-fadeIn">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider">
            <tr>
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Email</th>
              <th className="text-left px-4 py-3">Role</th>
              <th className="text-right px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {dbUsers.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-semibold text-slate-900">{u.name}</td>
                <td className="px-4 py-3 text-slate-700">{u.email}</td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      u.role === "admin"
                        ? "bg-teal-100 text-teal-700"
                        : u.role === "staff"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {u.role !== "admin" && (
                    <button
                      onClick={() => remove(u.id)}
                      className="p-1.5 rounded bg-rose-50 hover:bg-rose-100 text-rose-700"
                    >
                      <IconTrash width={16} height={16} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BookedRecords() {
  const { bookings, rooms } = useStore();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<Booking["status"] | "All">("All");
  const [paymentFilter, setPaymentFilter] = useState<Booking["paymentStatus"] | "All">(
    "All"
  );
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [viewing, setViewing] = useState<Booking | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  const filtered = useMemo<Booking[]>(() => {
    let list: Booking[] = [...bookings].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    if (query) {
      const q = query.toLowerCase();
      list = list.filter(
        (b) =>
          b.customerName.toLowerCase().includes(q) ||
          b.customerEmail.toLowerCase().includes(q) ||
          b.id.toLowerCase().includes(q) ||
          (b.paymentReference || "").toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "All") list = list.filter((b) => b.status === statusFilter);
    if (paymentFilter !== "All") list = list.filter((b) => b.paymentStatus === paymentFilter);
    if (fromDate) list = list.filter((b) => b.checkIn >= fromDate);
    if (toDate) list = list.filter((b) => b.checkOut <= toDate);
    return list;
  }, [bookings, query, statusFilter, paymentFilter, fromDate, toDate]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="md:col-span-2">
          <label className="text-xs font-semibold text-slate-500 block mb-1">Search</label>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name, email, booking reference..."
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-teal-500"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500 block mb-1">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-transparent focus:outline-none focus:border-teal-500"
          >
            <option value="All">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Confirmed">Confirmed</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500 block mb-1">From Date</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-teal-500"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500 block mb-1">To Date</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-teal-500"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-3">ID</th>
                <th className="text-left px-4 py-3">Customer</th>
                <th className="text-left px-4 py-3">Room</th>
                <th className="text-left px-4 py-3">Stay Dates</th>
                <th className="text-right px-4 py-3">Total Due</th>
                <th className="text-center px-4 py-3">Payment</th>
                <th className="text-center px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">Record Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center text-slate-500 py-10">
                    No historic logs matched those search metrics.
                  </td>
                </tr>
              ) : (
                filtered.map((b) => {
                  const room = rooms.find((r) => r.id === b.roomId);
                  return (
                    <tr key={b.id} className="hover:bg-slate-50 text-slate-700">
                      <td className="px-4 py-3 font-mono text-xs">{b.id}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{b.customerName}</div>
                        <div className="text-xs text-slate-400">{b.customerEmail}</div>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800">{room?.name || "Deleted Room"}</td>
                      <td className="px-4 py-3 text-xs">
                        {b.checkIn} to {b.checkOut}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900">
                        {formatPHP(b.total)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <PaymentBadge status={b.paymentStatus} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge status={b.status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setViewing(b)}
                          className="text-teal-600 hover:text-teal-800 font-semibold text-xs"
                        >
                          Review Invoice
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {viewing && (
        <Modal title={`Archived Statement - ${viewing.id}`} onClose={() => setViewing(null)} size="lg">
          <BookingDetails booking={viewing} room={rooms.find((r) => r.id === viewing.roomId)} />
        </Modal>
      )}
    </div>
  );
}
