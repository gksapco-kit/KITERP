import { useRef, useState, useEffect } from "react";
import { Camera, Trash2, Pencil, Plus, Star, Share2, Grid, List as ListIcon, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { Address, AccountUser, NotificationPrefs, WishlistItem } from "../types";
import { formatPrice } from "../mock";

/* ---------------- Profile Edit ---------------- */

export function ProfileEdit({ user, onSave }: { user: AccountUser; onSave?: (u: AccountUser) => void }) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState(user.phone ?? "");
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(user.name);
    setEmail(user.email);
    setPhone(user.phone ?? "");
    setAvatarUrl(user.avatarUrl);
  }, [user.id, user.name, user.email, user.phone, user.avatarUrl]);

  const onAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    setAvatarUrl(URL.createObjectURL(f));
  };

  return (
    <Card>
      <CardHeader><CardTitle>Edit profile</CardTitle></CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(e) => { e.preventDefault(); onSave?.({ ...user, name, email, phone, avatarUrl }); }}
        >
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={avatarUrl} alt={name} />
              <AvatarFallback>{name.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Camera /> Change avatar
            </Button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={onAvatar} />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div><Label htmlFor="pf-name">Full name</Label><Input id="pf-name" value={name} onChange={(e) => setName(e.target.value)} className="mt-1" /></div>
            <div><Label htmlFor="pf-email">Email</Label><Input id="pf-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1" /></div>
            <div className="sm:col-span-2"><Label htmlFor="pf-phone">Phone</Label><Input id="pf-phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1" /></div>
          </div>
          <Button type="submit">Save changes</Button>
        </form>
      </CardContent>
    </Card>
  );
}

/* ---------------- Change password ---------------- */

export function ChangePasswordForm({ onSubmit }: { onSubmit?: (data: { current: string; next: string }) => void }) {
  const [current, setCurrent] = useState(""); const [next, setNext] = useState(""); const [confirm, setConfirm] = useState("");
  const mismatch = next && confirm && next !== confirm;
  return (
    <Card>
      <CardHeader><CardTitle>Change password</CardTitle></CardHeader>
      <CardContent>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (!mismatch) onSubmit?.({ current, next }); }}>
          <div><Label>Current password</Label><Input type="password" required value={current} onChange={(e) => setCurrent(e.target.value)} className="mt-1" /></div>
          <div><Label>New password</Label><Input type="password" required minLength={8} value={next} onChange={(e) => setNext(e.target.value)} className="mt-1" /></div>
          <div>
            <Label>Confirm new password</Label>
            <Input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className="mt-1" />
            {mismatch && <p className="text-xs text-destructive mt-1">Passwords do not match.</p>}
          </div>
          <Button type="submit" disabled={!!mismatch}>Update password</Button>
        </form>
      </CardContent>
    </Card>
  );
}

/* ---------------- Address Book ---------------- */

export function AddressBook({ addresses: initial }: { addresses: Address[] }) {
  const [list, setList] = useState<Address[]>(initial);
  const [editing, setEditing] = useState<Address | null>(null);
  const [adding, setAdding] = useState(false);

  const setDefault = (id: string) => setList((l) => l.map((a) => ({ ...a, isDefault: a.id === id })));
  const remove = (id: string) => setList((l) => l.filter((a) => a.id !== id));
  const upsert = (a: Address) => {
    setList((l) => l.some((x) => x.id === a.id) ? l.map((x) => (x.id === a.id ? a : x)) : [...l, a]);
    setEditing(null); setAdding(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Saved addresses</CardTitle>
        <Button size="sm" onClick={() => setAdding(true)}><Plus /> Add address</Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {list.map((a) => (
          <div key={a.id} className="rounded-md border p-4 flex items-start gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{a.label ?? a.fullName}</span>
                {a.isDefault && <Badge variant="secondary">Default</Badge>}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                {a.fullName} · {a.line1}{a.line2 ? `, ${a.line2}` : ""}, {a.city}, {a.state} {a.postalCode}, {a.country}
              </div>
              {a.phone && <div className="text-sm text-muted-foreground">{a.phone}</div>}
            </div>
            <div className="flex flex-col gap-1">
              {!a.isDefault && <Button variant="ghost" size="sm" onClick={() => setDefault(a.id)}><Star className="h-4 w-4" />Default</Button>}
              <Button variant="ghost" size="sm" onClick={() => setEditing(a)}><Pencil className="h-4 w-4" />Edit</Button>
              <Button variant="ghost" size="sm" onClick={() => remove(a.id)}><Trash2 className="h-4 w-4" />Delete</Button>
            </div>
          </div>
        ))}
        {(adding || editing) && (
          <AddressForm
            initial={editing ?? undefined}
            onCancel={() => { setEditing(null); setAdding(false); }}
            onSave={upsert}
          />
        )}
      </CardContent>
    </Card>
  );
}

function AddressForm({ initial, onSave, onCancel }: { initial?: Address; onSave: (a: Address) => void; onCancel: () => void }) {
  const [a, setA] = useState<Address>(initial ?? {
    id: `a_${Date.now()}`, fullName: "", line1: "", city: "", postalCode: "", country: "India",
  });
  const set = <K extends keyof Address>(k: K, v: Address[K]) => setA((x) => ({ ...x, [k]: v }));
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(a); }} className="rounded-md border p-4 space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <div><Label>Label</Label><Input value={a.label ?? ""} onChange={(e) => set("label", e.target.value)} className="mt-1" /></div>
        <div><Label>Full name</Label><Input required value={a.fullName} onChange={(e) => set("fullName", e.target.value)} className="mt-1" /></div>
        <div className="sm:col-span-2"><Label>Address line 1</Label><Input required value={a.line1} onChange={(e) => set("line1", e.target.value)} className="mt-1" /></div>
        <div className="sm:col-span-2"><Label>Address line 2</Label><Input value={a.line2 ?? ""} onChange={(e) => set("line2", e.target.value)} className="mt-1" /></div>
        <div><Label>City</Label><Input required value={a.city} onChange={(e) => set("city", e.target.value)} className="mt-1" /></div>
        <div><Label>State</Label><Input value={a.state ?? ""} onChange={(e) => set("state", e.target.value)} className="mt-1" /></div>
        <div><Label>Postal code</Label><Input required value={a.postalCode} onChange={(e) => set("postalCode", e.target.value)} className="mt-1" /></div>
        <div><Label>Country</Label><Input required value={a.country} onChange={(e) => set("country", e.target.value)} className="mt-1" /></div>
        <div><Label>Phone</Label><Input value={a.phone ?? ""} onChange={(e) => set("phone", e.target.value)} className="mt-1" /></div>
      </div>
      <div className="flex gap-2"><Button type="submit">Save</Button><Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button></div>
    </form>
  );
}

/* ---------------- Notification preferences ---------------- */

export function NotificationPreferencesForm({ value, onChange }: { value?: Partial<NotificationPrefs>; onChange?: (p: NotificationPrefs) => void }) {
  const [prefs, setPrefs] = useState<NotificationPrefs>({
    orderUpdates: true, promotions: false, newsletters: true, bookingReminders: true, smsEnabled: true, ...value,
  });
  const set = <K extends keyof NotificationPrefs>(k: K, v: boolean) => {
    const next = { ...prefs, [k]: v }; setPrefs(next); onChange?.(next);
  };
  const items: { key: keyof NotificationPrefs; label: string; description: string }[] = [
    { key: "orderUpdates", label: "Order updates", description: "Shipping, delivery and refunds" },
    { key: "bookingReminders", label: "Booking reminders", description: "Before scheduled appointments" },
    { key: "promotions", label: "Promotions", description: "Sales, discounts and special offers" },
    { key: "newsletters", label: "Newsletters", description: "Monthly product updates" },
    { key: "smsEnabled", label: "SMS notifications", description: "Allow text messages on your phone" },
  ];
  return (
    <Card>
      <CardHeader><CardTitle>Notifications</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {items.map((it) => (
          <div key={it.key} className="flex items-center justify-between gap-4 rounded-md border p-3">
            <div>
              <div className="text-sm font-medium">{it.label}</div>
              <div className="text-xs text-muted-foreground">{it.description}</div>
            </div>
            <Switch checked={prefs[it.key]} onCheckedChange={(v) => set(it.key, v)} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/* ---------------- Wishlist ---------------- */

export function WishlistPage({ items: initial, onMoveToCart }: { items: WishlistItem[]; onMoveToCart?: (id: string) => void }) {
  const [items, setItems] = useState(initial);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [copied, setCopied] = useState(false);

  const remove = (id: string) => setItems((l) => l.filter((i) => i.id !== id));
  const share = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>My wishlist ({items.length})</CardTitle>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={share}><Share2 />{copied ? "Copied!" : "Share"}</Button>
          <div className="inline-flex border rounded-md">
            <Button size="icon" variant={view === "grid" ? "default" : "ghost"} onClick={() => setView("grid")}><Grid /></Button>
            <Button size="icon" variant={view === "list" ? "default" : "ghost"} onClick={() => setView("list")}><ListIcon /></Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-10">Your wishlist is empty.</p>
        ) : (
          <div className={cn(view === "grid" ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3" : "flex flex-col gap-3")}>
            {items.map((p) => (
              <div key={p.id} className={cn("rounded-md border overflow-hidden", view === "list" && "flex")}>
                <img src={p.image} alt={p.name} className={cn("object-cover", view === "list" ? "h-28 w-28 shrink-0" : "aspect-square w-full")} />
                <div className="p-3 flex-1 flex flex-col">
                  <div className="text-sm font-medium line-clamp-1">{p.name}</div>
                  <div className="text-sm font-semibold mt-1">{formatPrice(p.price)}</div>
                  <div className="text-xs text-muted-foreground mt-1">Saved on {p.savedAt}</div>
                  <div className="mt-auto flex gap-2 pt-3">
                    <Button size="sm" className="flex-1" onClick={() => onMoveToCart?.(p.id)}><ShoppingCart /> Move to cart</Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(p.id)} aria-label="Remove"><Trash2 /></Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
