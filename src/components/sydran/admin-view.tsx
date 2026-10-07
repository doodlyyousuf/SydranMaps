'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { StatusBadge } from './status-badge';
import { PixelArt } from './pixel-art';
import { useRouter } from './router';
import { useToast } from '@/hooks/use-toast';
import {
  CATEGORIES,
  categoryLabel,
  formatPrice,
  parsePrice,
  sizeLabel,
  type OrderView,
  type ProductView,
} from '@/lib/sydran';
import {
  Package,
  ShoppingCart,
  Layers,
  CheckCircle2,
  Pencil,
  Trash2,
  Loader2,
} from 'lucide-react';

export function AdminView() {
  const { navigate } = useRouter();
  const { toast } = useToast();
  const [orders, setOrders] = useState<OrderView[]>([]);
  const [products, setProducts] = useState<ProductView[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ProductView | null>(null);
  const [deleting, setDeleting] = useState<ProductView | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch('/api/orders').then((r) => r.json()),
      fetch('/api/products').then((r) => r.json()),
    ])
      .then(([o, p]) => {
        setOrders(o.orders ?? []);
        setProducts(p.products ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async (updated: {
    id: string;
    name: string;
    description: string;
    price: string;
    category: string;
  }) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/products/${updated.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: updated.name,
          description: updated.description,
          price: updated.price,
          category: updated.category,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Update failed');
      toast({ title: 'Product updated', description: data.product.name });
      setEditing(null);
      load();
    } catch (e) {
      toast({
        title: 'Update failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (product: ProductView) => {
    try {
      const res = await fetch(`/api/products/${product.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Delete failed');
      toast({
        title: 'Product deleted',
        description: `${product.name} (${product.code}) removed.`,
      });
      setDeleting(null);
      load();
    } catch (e) {
      toast({
        title: 'Delete failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
      setDeleting(null);
    }
  };

  const totalMaps = products.reduce((s, p) => s + p.totalMaps, 0);
  const deliveredCount = orders.filter(
    (o) => o.status === 'delivered'
  ).length;
  const activeCount = orders.filter(
    (o) => o.status === 'paid' || o.status === 'claimed'
  ).length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div>
        <h1 className="font-pixel text-2xl font-bold sm:text-3xl">
          Admin overview
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage all products and orders.
        </p>
      </div>

      {/* Stats tiles */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          icon={Package}
          label="Products"
          value={products.length}
          color="text-primary"
        />
        <Stat
          icon={Layers}
          label="Total tiles"
          value={totalMaps}
          color="text-violet-300"
        />
        <Stat
          icon={ShoppingCart}
          label="Active orders"
          value={activeCount}
          color="text-amber-300"
        />
        <Stat
          icon={CheckCircle2}
          label="Delivered"
          value={deliveredCount}
          color="text-emerald-300"
        />
      </div>

      {loading ? (
        <div className="mt-6 space-y-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {/* Orders table */}
          <section className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-3 font-pixel text-sm font-bold uppercase tracking-wider">
              Orders
            </h2>
            {orders.length === 0 ? (
              <p className="text-sm text-muted-foreground">No orders yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {orders.slice(0, 12).map((o) => (
                  <li key={o.id}>
                    <button
                      onClick={() =>
                        navigate({ name: 'order', code: o.code })
                      }
                      className="flex w-full items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-left hover:border-border hover:bg-muted/40"
                    >
                      <code className="w-20 shrink-0 font-mono text-xs">
                        {o.code}
                      </code>
                      <span className="w-28 truncate text-sm">
                        {o.player}
                      </span>
                      <span className="flex-1 text-xs text-muted-foreground">
                        {o.items.length} item{o.items.length !== 1 ? 's' : ''}
                      </span>
                      <StatusBadge status={o.status} pulse={false} />
                      <span className="ml-auto w-16 text-right text-xs font-medium text-accent">
                        {formatPrice(o.totalAmount)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Products — full management grid */}
          <section className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-3 font-pixel text-sm font-bold uppercase tracking-wider">
              Products ({products.length})
            </h2>
            {products.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No products yet.
              </p>
            ) : (
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {products.map((p) => (
                  <li
                    key={p.id}
                    className="flex gap-2.5 rounded-md border border-border bg-muted/20 p-2"
                  >
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md">
                      <PixelArt
                        svg={p.previewSvg}
                        alt={p.name}
                        aspect="square"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {p.name}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        <code className="font-mono">{p.code}</code> ·{' '}
                        {sizeLabel(p.width, p.height)}
                      </div>
                      <div className="text-xs font-medium text-accent">
                        {formatPrice(p.price)}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => setEditing(p)}
                        className="grid h-7 w-7 place-items-center rounded-md border border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                        aria-label="Edit"
                        title="Edit"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => setDeleting(p)}
                        className="grid h-7 w-7 place-items-center rounded-md border border-border text-muted-foreground transition-colors hover:border-rose-500 hover:text-rose-500"
                        aria-label="Delete"
                        title="Delete"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {/* ── Edit dialog ──────────────────────────────────────────── */}
      {editing && (
        <EditProductDialog
          product={editing}
          onSave={handleSave}
          onClose={() => setEditing(null)}
          saving={saving}
        />
      )}

      {/* ── Delete confirmation ──────────────────────────────────── */}
      <Dialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {deleting?.name}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete{' '}
            <strong>{deleting?.code}</strong> ({deleting?.width}×
            {deleting?.height}, {deleting?.totalMaps} tiles) from the
            store. This cannot be undone.
          </p>
          {deleting && (
            <p className="rounded-md bg-amber-500/10 p-2 text-xs text-amber-700">
              Note: if this product is part of any active order, the
              delete will be blocked.
            </p>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              onClick={() => deleting && handleDelete(deleting)}
              className="gap-1.5 bg-rose-600 text-white hover:bg-rose-500"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete product
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Edit dialog ────────────────────────────────────────────────────

function EditProductDialog({
  product,
  onSave,
  onClose,
  saving,
}: {
  product: ProductView;
  onSave: (updated: {
    id: string;
    name: string;
    description: string;
    price: string;
    category: string;
  }) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [name, setName] = useState(product.name);
  const [description, setDescription] = useState(product.description ?? '');
  const [price, setPrice] = useState(String(product.price));
  const [category, setCategory] = useState(product.category);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit {product.code}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="edit-name" className="text-xs uppercase tracking-wider">
              Name
            </Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="edit-price" className="text-xs uppercase tracking-wider">
              Price (DonutSMP dollars, or shorthand like 1.5m)
            </Label>
            <Input
              id="edit-price"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="mt-1.5 font-mono"
              placeholder="150000 or 1.5m"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Current: {formatPrice(product.price)} ({product.price.toLocaleString()} DonutSMP dollars)
            </p>
          </div>
          <div>
            <Label htmlFor="edit-category" className="text-xs uppercase tracking-wider">
              Category
            </Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="edit-category" className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {categoryLabel(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="edit-desc" className="text-xs uppercase tracking-wider">
              Description
            </Label>
            <Textarea
              id="edit-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1.5 min-h-[80px]"
              placeholder="Optional product description"
            />
          </div>
          <div className="rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
            <strong className="text-foreground">Size:</strong>{' '}
            {sizeLabel(product.width, product.height)} ·{' '}
            <strong className="text-foreground">Tiles:</strong>{' '}
            {product.totalMaps}
            <br />
            <span>
              Map dimensions and tile count cannot be edited after
              creation.
            </span>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            onClick={() =>
              onSave({
                id: product.id,
                name,
                description,
                price,
                category,
              })
            }
            disabled={saving || name.trim().length < 3}
            className="gap-1.5"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className={`h-3.5 w-3.5 ${color ?? ''}`} />
        {label}
      </div>
      <div className="mt-1 font-pixel text-2xl font-bold">{value}</div>
    </div>
  );
}
