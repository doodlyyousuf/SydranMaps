'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  CATEGORIES,
  categoryLabel,
  formatPrice,
  parsePrice,
  parseSize,
  sizeLabel,
  type ModConfigView,
} from '@/lib/sydran';
import {
  Terminal,
  Wifi,
  Tag,
  Ruler,
  Coins,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Upload,
  Copy,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModStatusResponse {
  text: string;
  config: ModConfigView;
}

export function ModPanel() {
  const { toast } = useToast();
  const [status, setStatus] = useState<ModStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // Editable form fields mirroring current config
  const [priceInput, setPriceInput] = useState('');
  const [category, setCategory] = useState('general');
  const [sizeInput, setSizeInput] = useState('1x1');
  const [duplicateCheck, setDuplicateCheck] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  // Simulated /sydran add form
  const [uploadName, setUploadName] = useState('');
  const [uploadResult, setUploadResult] = useState<
    | { ok: true; product: Record<string, unknown>; message: string }
    | { ok: false; error: string; existing?: Record<string, unknown> }
    | null
  >(null);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/mod/status')
      .then((r) => r.json())
      .then((data: ModStatusResponse) => {
        setStatus(data);
        setPriceInput(formatPrice(data.config.price));
        setCategory(data.config.category);
        setSizeInput(`${data.config.mapWidth}x${data.config.mapHeight}`);
        setDuplicateCheck(data.config.duplicateCheck);
      })
      .catch(() => setStatus(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const update = async (patch: Record<string, unknown>, key: string, friendly: string) => {
    setSavingKey(key);
    try {
      const res = await fetch('/api/mod/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Update failed');
      setStatus({ text: status?.text ?? '', config: data.config });
      toast({
        title: 'Mod config updated',
        description: friendly,
      });
    } catch (e) {
      toast({
        title: 'Update failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSavingKey(null);
    }
  };

  const handleSetPrice = () => {
    const parsed = parsePrice(priceInput);
    if (parsed === null) {
      toast({
        title: 'Invalid price',
        description: 'Examples: 150000, 150k, 1.5m',
        variant: 'destructive',
      });
      return;
    }
    update({ price: parsed }, 'price', `Price set to ${formatPrice(parsed)} (${parsed} coins)`);
  };

  const handleSetSize = () => {
    const size = parseSize(sizeInput);
    if (!size) {
      toast({
        title: 'Invalid size',
        description: 'Use the WxH format, e.g. 10x6',
        variant: 'destructive',
      });
      return;
    }
    update(
      { size: `${size.width}x${size.height}` },
      'size',
      `Map size set to ${sizeLabel(size.width, size.height)} (${size.width * size.height} tiles)`
    );
  };

  const handleSetCategory = (c: string) => {
    setCategory(c);
    update({ category: c }, 'category', `Category set to ${categoryLabel(c)}`);
  };

  const handleToggleDuplicate = (on: boolean) => {
    setDuplicateCheck(on);
    update({ duplicateCheck: on }, 'duplicate', `Duplicate detection ${on ? 'enabled' : 'disabled'}`);
  };

  // ── /sydran add simulation (Phase 3 + Phase 5) ──────────────────────
  const handleAdd = async () => {
    if (uploadName.trim().length < 3) {
      toast({
        title: 'Name required',
        description: 'Product name must be ≥3 characters.',
        variant: 'destructive',
      });
      return;
    }
    setUploading(true);
    setUploadResult(null);
    try {
      const size = parseSize(sizeInput) ?? { width: 1, height: 1 };
      const res = await fetch('/api/mod/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: uploadName.trim(),
          // Send tiles so the server validates the count against width*height.
          tiles: Array.from({ length: size.width * size.height }, (_, k) => ({
            posX: k % size.width,
            posY: Math.floor(k / size.width),
            tileHash: 'mod-computed-' + k,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setUploadResult({ ok: false, error: data.error ?? 'Upload failed', existing: data.existingProduct });
        toast({
          title: 'Duplicate map detected',
          description: data.message ?? data.error,
          variant: 'destructive',
        });
      } else {
        setUploadResult({ ok: true, product: data.product, message: data.message });
        toast({
          title: 'Map uploaded',
          description: data.message,
        });
      }
    } catch (e) {
      setUploadResult({
        ok: false,
        error: e instanceof Error ? e.message : 'Network error',
      });
    } finally {
      setUploading(false);
    }
  };

  if (loading || !status) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="mt-4 h-32 w-full" />
        <Skeleton className="mt-4 h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <div className="flex items-center gap-2">
        <Terminal className="h-5 w-5 text-primary" />
        <h1 className="font-pixel text-2xl font-bold sm:text-3xl">Fabric mod panel</h1>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Equivalent of the in-game <code className="font-mono">/sydran</code>{' '}
        commands — but exposed through the web for testing and review.
      </p>

      {/* ── /sydran status terminal ─────────────────────────────────── */}
      <section className="mt-5 rounded-xl border border-border bg-black/60 p-4 font-mono text-sm shadow-inner">
        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            /sydran status
          </span>
          <button
            onClick={() => {
              navigator.clipboard.writeText(status.text);
              toast({ title: 'Copied' });
            }}
            className="inline-flex items-center gap-1 text-xs hover:text-foreground"
          >
            <Copy className="h-3 w-3" />
            Copy
          </button>
        </div>
        <pre className="whitespace-pre-wrap leading-relaxed text-emerald-300">
{status.text}
        </pre>
      </section>

      {/* ── Config grid ─────────────────────────────────────────────── */}
      <section className="mt-5 grid gap-4 md:grid-cols-2">
        {/* /sydran setprice */}
        <ConfigCard
          icon={Coins}
          title="/sydran setprice"
          description="Set the price used by the next /sydran add upload. Accepts k / m shorthand."
        >
          <div className="flex gap-2">
            <Input
              value={priceInput}
              onChange={(e) => setPriceInput(e.target.value)}
              placeholder="e.g. 1.5m"
              className="font-mono"
              onKeyDown={(e) => e.key === 'Enter' && handleSetPrice()}
            />
            <Button onClick={handleSetPrice} disabled={savingKey === 'price'} size="sm">
              {savingKey === 'price' ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Set'}
            </Button>
          </div>
          <Hint>Examples: 150000, 150k, 1m, 1.5m, 2m</Hint>
        </ConfigCard>

        {/* /sydran setsize */}
        <ConfigCard
          icon={Ruler}
          title="/sydran setsize"
          description="Set the map dimensions. A 10×6 product = 60 individual Minecraft map tiles."
        >
          <div className="flex gap-2">
            <Input
              value={sizeInput}
              onChange={(e) => setSizeInput(e.target.value)}
              placeholder="10x6"
              className="font-mono"
              onKeyDown={(e) => e.key === 'Enter' && handleSetSize()}
            />
            <Button onClick={handleSetSize} disabled={savingKey === 'size'} size="sm">
              {savingKey === 'size' ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Set'}
            </Button>
          </div>
          <Hint>Examples: 1x1, 2x2, 5x3, 10x6</Hint>
        </ConfigCard>

        {/* /sydran setcategory */}
        <ConfigCard
          icon={Tag}
          title="/sydran setcategory"
          description="Set the category attached to the next upload. The store uses this for filtering."
        >
          <Select value={category} onValueChange={handleSetCategory}>
            <SelectTrigger size="sm">
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
          {savingKey === 'category' && (
            <div className="mt-1 text-xs text-muted-foreground">
              <Loader2 className="inline h-3 w-3 animate-spin" /> Updating…
            </div>
          )}
        </ConfigCard>

        {/* /sydran setduplicate */}
        <ConfigCard
          icon={Shield}
          title="/sydran setduplicate"
          description="Toggle server-side duplicate detection. When ON, the server rejects duplicate uploads even if the mod's local setting is off."
        >
          <div className="flex items-center justify-between">
            <Label htmlFor="dup-switch" className="text-sm">
              Duplicate detection: <strong>{duplicateCheck ? 'ON' : 'OFF'}</strong>
            </Label>
            <Switch
              id="dup-switch"
              checked={duplicateCheck}
              onCheckedChange={handleToggleDuplicate}
              disabled={savingKey === 'duplicate'}
            />
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs">
            {status.config.apiConnected ? (
              <>
                <Wifi className="h-3 w-3 text-emerald-400" />
                <span className="text-emerald-300">API connected</span>
              </>
            ) : (
              <>
                <Wifi className="h-3 w-3 text-rose-400" />
                <span className="text-rose-300">API disconnected</span>
              </>
            )}
            <span className="text-muted-foreground">
              · Last sync:{' '}
              {status.config.lastSyncAt
                ? new Date(status.config.lastSyncAt).toLocaleString()
                : 'never'}
            </span>
          </div>
        </ConfigCard>
      </section>

      {/* ── /sydran add simulation ────────────────────────────────── */}
      <section className="mt-5 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <Upload className="h-4 w-4 text-primary" />
          <h2 className="font-pixel text-sm font-bold uppercase tracking-wider">
            /sydran add
          </h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Simulates the Fabric mod's <code className="font-mono">/sydran add</code>{' '}
          upload. The server validates tile count, computes the SHA-256
          fingerprint, checks for duplicates, and inserts the product +
          tiles in a single transaction.
        </p>

        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
          <div>
            <Label htmlFor="upload-name" className="text-xs uppercase tracking-wider">
              Product name
            </Label>
            <Input
              id="upload-name"
              value={uploadName}
              onChange={(e) => setUploadName(e.target.value)}
              placeholder="e.g. Anime Castle"
              className="mt-1.5"
              autoComplete="off"
            />
          </div>
          <div className="flex items-end">
            <Button
              onClick={handleAdd}
              disabled={uploading || uploadName.trim().length < 3}
              className="gap-1.5"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {uploading ? 'Uploading…' : 'Upload'}
            </Button>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="font-mono">
            size: {sizeInput}
          </Badge>
          <Badge variant="outline" className="font-mono">
            price: {priceInput}
          </Badge>
          <Badge variant="outline" className="font-mono capitalize">
            {category}
          </Badge>
          <Badge variant="outline" className="font-mono">
            duplicate: {duplicateCheck ? 'ON' : 'OFF'}
          </Badge>
        </div>

        {/* Upload result */}
        {uploadResult && (
          <div
            className={cn(
              'mt-3 rounded-lg border p-3 text-sm',
              uploadResult.ok
                ? 'border-emerald-500/40 bg-emerald-500/10'
                : 'border-rose-500/40 bg-rose-500/10'
            )}
          >
            {uploadResult.ok ? (
              <>
                <div className="flex items-center gap-2 font-medium text-emerald-300">
                  <CheckCircle2 className="h-4 w-4" />
                  Upload successful
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{uploadResult.message}</p>
                <pre className="mt-2 overflow-auto rounded bg-black/40 p-2 text-[11px] text-emerald-200">
{JSON.stringify(uploadResult.product, null, 2)}
                </pre>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 font-medium text-rose-300">
                  <AlertTriangle className="h-4 w-4" />
                  Duplicate map detected
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  This map already exists in Sydran Maps.
                </p>
                {uploadResult.existing && (
                  <pre className="mt-2 overflow-auto rounded bg-black/40 p-2 text-[11px] text-rose-200">
{JSON.stringify(uploadResult.existing, null, 2)}
                  </pre>
                )}
              </>
            )}
          </div>
        )}
      </section>

      <div className="mt-6 flex items-center justify-end">
        <Button variant="outline" size="sm" onClick={load} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" />
          Reload from server
        </Button>
      </div>
    </div>
  );
}

function ConfigCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h3 className="font-pixel text-sm font-bold uppercase tracking-wider">
          {title}
        </h3>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-1.5 text-[11px] text-muted-foreground">
      <span className="opacity-70">Hint:</span> {children}
    </p>
  );
}
