import { useEffect, useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { Dialog } from '../ui/dialog';
import { Button, Field, Input, Segmented, Select, Textarea, Toggle } from '../ui/primitives';
import { ProductVisual, REWARD_ICON_OPTIONS } from '../ui/visuals';
import { useAppStore } from '../../store/appStore';
import { useData } from '../../store/hooks';
import { minutesToEarn } from '../../domain/economy';
import { formatCredits, formatHoursPrecise, parseCreditsInput, parseDecimal } from '../../domain/format';
import type { Reward, RewardIcon, RewardPriority, Wallet } from '../../domain/types';
import { fileToCompressedDataUrl } from '../../lib/image';

interface Props {
  open: boolean;
  onClose: () => void;
  reward?: Reward | null;
  onSaved?: (id: string) => void;
  /** Account preselected for new rewards. */
  defaultWallet?: Wallet;
}

export function RewardFormDialog({ open, onClose, reward, onSaved, defaultWallet = 'main' }: Props) {
  const data = useData();
  const addReward = useAppStore((s) => s.addReward);
  const updateReward = useAppStore((s) => s.updateReward);
  const pushToast = useAppStore((s) => s.pushToast);
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [variant, setVariant] = useState('');
  const [icon, setIcon] = useState<RewardIcon>('gift');
  const [imageUrl, setImageUrl] = useState('');
  const [price, setPrice] = useState('');
  const [realPrice, setRealPrice] = useState('');
  const [productUrl, setProductUrl] = useState('');
  const [priority, setPriority] = useState<RewardPriority>('mittel');
  const [preOwned, setPreOwned] = useState(false);
  const [wallet, setWallet] = useState<Wallet>(defaultWallet);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(reward?.name ?? '');
    setDescription(reward?.description ?? '');
    setCategory(reward?.category ?? '');
    setVariant(reward?.variant ?? '');
    setIcon(reward?.icon ?? 'gift');
    setImageUrl(reward?.imageUrl ?? '');
    setPrice(reward ? formatCredits(reward.priceCents).replace(/\./g, '') : '');
    setRealPrice(reward?.realPriceEuroCents != null ? (reward.realPriceEuroCents / 100).toFixed(2).replace('.', ',') : '');
    setProductUrl(reward?.productUrl ?? '');
    setPriority(reward?.priority ?? 'mittel');
    setPreOwned(reward?.preOwned ?? false);
    setWallet(reward?.wallet ?? defaultWallet);
    setError(null);
  }, [open, reward, defaultWallet]);

  const priceCents = preOwned && price.trim() === '' ? 0 : parseCreditsInput(price);
  const realCents = realPrice.trim() === '' ? null : Math.round(parseDecimal(realPrice) * 100);
  const hours = Number.isFinite(priceCents) && priceCents > 0 ? minutesToEarn(priceCents, data.settings.rates, wallet) : 0;
  const categories = [...new Set(data.rewards.map((r) => r.category))];

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      setImageUrl(await fileToCompressedDataUrl(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload fehlgeschlagen.');
    } finally {
      setUploading(false);
    }
  };

  const save = () => {
    if (!Number.isFinite(priceCents)) return setError('Bitte gib einen gültigen virtuellen Preis ein.');
    if (realCents !== null && !Number.isFinite(realCents)) return setError('Bitte gib einen gültigen realen Preis ein.');
    const input = {
      name,
      description,
      category,
      variant,
      icon,
      imageUrl: imageUrl.trim(),
      priceCents,
      realPriceEuroCents: realCents,
      productUrl: productUrl.trim(),
      priority,
      preOwned,
      wallet,
    };
    if (reward) {
      const r = updateReward(reward.id, input);
      if (!r.ok) return setError(r.error);
      pushToast({ tone: 'success', title: 'Belohnung gespeichert' });
      onSaved?.(reward.id);
    } else {
      const r = addReward(input);
      if (!r.ok) return setError(r.error);
      pushToast({ tone: 'success', title: 'Belohnung hinzugefügt', message: r.value.name });
      onSaved?.(r.value.id);
    }
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title={reward ? 'Belohnung bearbeiten' : 'Eigene Belohnung'}
      description={reward?.isDefault ? 'Standard-Belohnungen lassen sich in den Einstellungen jederzeit wiederherstellen.' : 'Lege fest, wofür du lernst.'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button variant="primary" onClick={save} disabled={uploading}>
            {reward ? 'Speichern' : 'Hinzufügen'}
          </Button>
        </>
      }
    >
      <form
        className="grid grid-cols-1 gap-4 pb-2 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Field label="Name" htmlFor="rw-name" className="sm:col-span-2">
          <Input id="rw-name" data-autofocus value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="z. B. Monitor-Lichtleiste" />
        </Field>
        <Field label="Beschreibung" htmlFor="rw-desc" className="sm:col-span-2">
          <Textarea id="rw-desc" value={description} maxLength={400} onChange={(e) => setDescription(e.target.value)} placeholder="Warum ist diese Belohnung es wert?" />
        </Field>
        <Field label="Kategorie" htmlFor="rw-cat">
          <Input id="rw-cat" list="rw-cat-list" value={category} maxLength={40} onChange={(e) => setCategory(e.target.value)} placeholder="z. B. Beleuchtung" />
          <datalist id="rw-cat-list">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <Field label="Variante / Farbe" htmlFor="rw-var">
          <Input id="rw-var" value={variant} maxLength={60} onChange={(e) => setVariant(e.target.value)} placeholder="Optional" />
        </Field>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-[13px] font-medium text-muted">Konto</span>
          <Segmented<Wallet>
            label="Konto"
            value={wallet}
            onChange={setWallet}
            options={[
              { value: 'main', label: 'Setup Credits (SC)' },
              { value: 'creative', label: 'Kreativ-Credits (KC)' },
            ]}
          />
          <p className="text-xs text-faint">
            {wallet === 'main' ? 'Wird mit allen Lern-Credits freigeschaltet.' : 'Nur mit Kreativ-Credits aus dem Video-Schnitt freischaltbar – für Kreativ-Equipment.'}
          </p>
        </div>
        <Field
          label={`Virtueller Preis (${wallet === 'main' ? 'SC' : 'KC'})`}
          htmlFor="rw-price"
          hint={hours > 0 ? `≈ ${formatHoursPrecise(hours)} ${wallet === 'main' ? 'Lernzeit' : 'Video-Schnitt'} ab null` : preOwned ? 'Für vorhandene Artikel optional' : undefined}
        >
          <Input id="rw-price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="z. B. 120" />
        </Field>
        <Field label="Realer Preis (€, optional)" htmlFor="rw-real" hint="Nur zur Information – keine Auswirkung auf Credits.">
          <Input id="rw-real" inputMode="decimal" value={realPrice} onChange={(e) => setRealPrice(e.target.value)} placeholder="z. B. 89,99" />
        </Field>
        <Field label="Produkt-URL (optional)" htmlFor="rw-url" className="sm:col-span-2">
          <Input id="rw-url" type="url" value={productUrl} onChange={(e) => setProductUrl(e.target.value)} placeholder="https://…" />
        </Field>
        <Field label="Priorität" htmlFor="rw-prio">
          <Select id="rw-prio" value={priority} onChange={(e) => setPriority(e.target.value as RewardPriority)}>
            <option value="hoch">Hoch</option>
            <option value="mittel">Mittel</option>
            <option value="niedrig">Niedrig</option>
          </Select>
        </Field>
        <Field label="Symbol" htmlFor="rw-icon">
          <Select id="rw-icon" value={icon} onChange={(e) => setIcon(e.target.value as RewardIcon)}>
            {REWARD_ICON_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>

        <div className="flex gap-4 sm:col-span-2">
          <ProductVisual reward={{ icon, imageUrl, name: name || 'Vorschau' }} className="size-24 shrink-0" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Field label="Bild-URL oder Upload" htmlFor="rw-img">
              <Input id="rw-img" value={imageUrl.startsWith('data:') ? 'Hochgeladenes Bild' : imageUrl} disabled={imageUrl.startsWith('data:')} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…/bild.jpg" />
            </Field>
            <div className="flex gap-2">
              <Button size="sm" icon={ImagePlus} onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? 'Wird verarbeitet …' : 'Bild hochladen'}
              </Button>
              {imageUrl && (
                <Button size="sm" variant="ghost" icon={X} onClick={() => setImageUrl('')}>
                  Entfernen
                </Button>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-line-soft bg-[#111418] p-4 sm:col-span-2">
          <Toggle id="rw-owned" checked={preOwned} onChange={setPreOwned} label="Bereits vorhanden" description="Der Artikel erscheint im Inventar und ist nicht im Shop kaufbar." />
        </div>

        {error && (
          <p role="alert" className="rounded-xl border border-danger/20 bg-danger-soft px-3.5 py-2.5 text-sm text-danger sm:col-span-2">
            {error}
          </p>
        )}
        <button type="submit" className="hidden" />
      </form>
    </Dialog>
  );
}
