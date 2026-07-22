"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Copy,
  KeyRound,
  MoreHorizontal,
  Plus,
  RefreshCw,
  ShieldOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/admin/empty-state";
import { formatDateBR } from "@/lib/format";
import type { ApiKeyListItem } from "@/lib/api-key-service";
import {
  ALL_API_SCOPES,
  API_KEY_PRESET_LABELS,
  API_SCOPE_LABELS,
  formatScopesSummary,
  type ApiKeyPermissionPreset,
  type ApiScope,
} from "@/lib/api-key-scopes";
import {
  createApiKeyAction,
  revokeApiKeyAction,
  rotateApiKeyAction,
} from "@/app/admin/(panel)/configuracoes/integracoes/actions";
import { ADMIN_SURFACE } from "@/lib/admin-surface";
import { cn } from "@/lib/utils";

type ApiKeysPanelProps = {
  initialKeys: ApiKeyListItem[];
};

type RevealedKey = {
  name: string;
  fullKey: string;
};

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const date = iso.slice(0, 10);
  const time = iso.slice(11, 16);
  return `${formatDateBR(date)} ${time}`;
}

function keyStatus(key: ApiKeyListItem): {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
} {
  if (key.revokedAt) return { label: "Revogada", variant: "destructive" };
  if (key.expiresAt && new Date(key.expiresAt) <= new Date()) {
    return { label: "Expirada", variant: "secondary" };
  }
  if (!key.active) return { label: "Inativa", variant: "secondary" };
  return { label: "Ativa", variant: "default" };
}

export function ApiKeysPanel({ initialKeys }: ApiKeysPanelProps) {
  const router = useRouter();
  const [keys, setKeys] = useState(initialKeys);
  const [createOpen, setCreateOpen] = useState(false);
  const [revealOpen, setRevealOpen] = useState(false);
  const [revealed, setRevealed] = useState<RevealedKey | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<ApiKeyListItem | null>(null);
  const [rotateTarget, setRotateTarget] = useState<ApiKeyListItem | null>(null);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("");
  const [preset, setPreset] = useState<ApiKeyPermissionPreset>("full");
  const [customScopes, setCustomScopes] = useState<ApiScope[]>([...ALL_API_SCOPES]);
  const [expiresAt, setExpiresAt] = useState("");
  const [revokeOldOnRotate, setRevokeOldOnRotate] = useState(false);

  const activeKeys = useMemo(
    () => keys.filter((k) => !k.revokedAt),
    [keys]
  );

  function resetCreateForm() {
    setName("");
    setPreset("full");
    setCustomScopes([...ALL_API_SCOPES]);
    setExpiresAt("");
    setRevokeOldOnRotate(false);
  }

  function openReveal(result: RevealedKey) {
    setRevealed(result);
    setRevealOpen(true);
  }

  function closeReveal() {
    setRevealOpen(false);
    setRevealed(null);
  }

  async function handleCreate() {
    if (!name.trim()) {
      toast.error("Informe um nome para a chave.");
      return;
    }

    setBusy(true);
    const result = await createApiKeyAction({
      name: name.trim(),
      preset,
      customScopes: preset === "custom" ? customScopes : undefined,
      expiresAt: expiresAt || null,
    });
    setBusy(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    setCreateOpen(false);
    resetCreateForm();
    setKeys((prev) => [result.key, ...prev]);
    openReveal({ name: result.key.name, fullKey: result.fullKey });
    router.refresh();
    toast.success("Chave criada.");
  }

  async function handleRotate() {
    if (!rotateTarget || !name.trim()) {
      toast.error("Informe um nome para a nova chave.");
      return;
    }

    setBusy(true);
    const result = await rotateApiKeyAction({
      oldKeyId: rotateTarget.id,
      name: name.trim(),
      preset,
      customScopes: preset === "custom" ? customScopes : undefined,
      expiresAt: expiresAt || null,
      revokeOld: revokeOldOnRotate,
    });
    setBusy(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    setRotateTarget(null);
    resetCreateForm();
    setKeys((prev) => {
      const updated = revokeOldOnRotate
        ? prev.map((k) =>
            k.id === rotateTarget.id
              ? {
                  ...k,
                  active: false,
                  revokedAt: new Date().toISOString(),
                }
              : k
          )
        : prev;
      return [result.key, ...updated];
    });
    openReveal({ name: result.key.name, fullKey: result.fullKey });
    router.refresh();
    toast.success(
      revokeOldOnRotate
        ? "Nova chave criada e a anterior revogada."
        : "Nova chave criada. A anterior continua ativa até você revogá-la."
    );
  }

  async function handleRevoke() {
    if (!revokeTarget) return;
    setBusy(true);
    const result = await revokeApiKeyAction(revokeTarget.id);
    setBusy(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    setKeys((prev) =>
      prev.map((k) =>
        k.id === revokeTarget.id
          ? { ...k, active: false, revokedAt: new Date().toISOString() }
          : k
      )
    );
    setRevokeTarget(null);
    router.refresh();
    toast.success("Chave revogada.");
  }

  async function copyKey(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Copiado.");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  }

  function toggleCustomScope(scope: ApiScope, checked: boolean) {
    setCustomScopes((prev) => {
      if (checked) return [...new Set([...prev, scope])];
      return prev.filter((s) => s !== scope);
    });
  }

  function renderPermissionFields() {
    return (
      <div className="flex flex-col gap-4">
        <div className="space-y-2">
          <Label className="text-[#f5f5f5]">Permissões</Label>
          <Select
            value={preset}
            onValueChange={(v) => setPreset(v as ApiKeyPermissionPreset)}
          >
            <SelectTrigger className={ADMIN_SURFACE.selectTrigger}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className={ADMIN_SURFACE.popover}>
              <SelectItem value="full">
                {API_KEY_PRESET_LABELS.full}
              </SelectItem>
              <SelectItem value="readonly">
                {API_KEY_PRESET_LABELS.readonly}
              </SelectItem>
              <SelectItem value="custom">Personalizada</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {preset === "custom" && (
          <div className="grid gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            {ALL_API_SCOPES.map((scope) => (
              <label
                key={scope}
                className="flex cursor-pointer items-center gap-2 text-sm text-[#d4d5d8]"
              >
                <Checkbox
                  checked={customScopes.includes(scope)}
                  onCheckedChange={(checked) =>
                    toggleCustomScope(scope, checked === true)
                  }
                />
                {API_SCOPE_LABELS[scope]}
              </label>
            ))}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="expiresAt" className="text-[#f5f5f5]">
            Expira em (opcional)
          </Label>
          <Input
            id="expiresAt"
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className={ADMIN_SURFACE.input}
          />
        </div>
      </div>
    );
  }

  function keyMenu(key: ApiKeyListItem) {
    if (key.revokedAt) return null;
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-[#b4b6bb] hover:bg-white/5 hover:text-[#ecf15e]"
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className={ADMIN_SURFACE.popover}>
          <DropdownMenuItem
            onClick={() => {
              resetCreateForm();
              setName(`${key.name} (nova)`);
              setPreset(
                key.scopes.length === ALL_API_SCOPES.length
                  ? "full"
                  : key.scopes.length === 4
                    ? "readonly"
                    : "custom"
              );
              setCustomScopes(key.scopes as ApiScope[]);
              setRotateTarget(key);
            }}
          >
            <RefreshCw />
            Gerar substituta
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => setRevokeTarget(key)}
          >
            <ShieldOff />
            Revogar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button
          onClick={() => setCreateOpen(true)}
          className={cn(
            "h-10 w-full sm:h-9 sm:w-auto",
            ADMIN_SURFACE.btnPrimary
          )}
        >
          <Plus />
          Nova chave
        </Button>
      </div>

      {keys.length === 0 ? (
        <EmptyState
          icon={KeyRound}
          className="border-white/10 text-[#f5f5f5]"
          title="Nenhuma chave ainda"
          description="Crie uma chave para conectar o n8n ou outra ferramenta à API."
          action={
            <Button
              onClick={() => setCreateOpen(true)}
              className={cn(
                "h-10 w-full sm:h-9 sm:w-auto",
                ADMIN_SURFACE.btnPrimary
              )}
            >
              <Plus />
              Criar primeira chave
            </Button>
          }
        />
      ) : (
        <>
          <div className={cn(ADMIN_SURFACE.panel, "overflow-hidden md:hidden")}>
            <ul className="divide-y divide-white/10">
              {keys.map((key) => {
                const status = keyStatus(key);
                return (
                  <li
                    key={key.id}
                    className="flex items-start gap-3 px-4 py-3.5"
                  >
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-[15px] font-medium tracking-tight text-[#f5f5f5]">
                          {key.name}
                        </p>
                        <Badge
                          variant={status.variant}
                          className="font-normal"
                        >
                          {status.label}
                        </Badge>
                      </div>
                      <p
                        className={cn(
                          "font-mono text-xs",
                          ADMIN_SURFACE.muted
                        )}
                      >
                        {key.keyPrefix}…
                      </p>
                      <p className={cn("text-xs", ADMIN_SURFACE.muted)}>
                        {formatScopesSummary(key.scopes)} · Criada{" "}
                        {formatDateTime(key.createdAt)}
                      </p>
                    </div>
                    {keyMenu(key)}
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="hidden gap-4 md:grid md:grid-cols-2 xl:grid-cols-3">
            {keys.map((key) => {
              const status = keyStatus(key);
              return (
                <Card
                  key={key.id}
                  className={cn(ADMIN_SURFACE.panel, "shadow-none")}
                >
                  <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
                    <div className="min-w-0">
                      <CardTitle className="truncate text-base text-[#f5f5f5]">
                        {key.name}
                      </CardTitle>
                      <p
                        className={cn(
                          "mt-1 font-mono text-xs",
                          ADMIN_SURFACE.muted
                        )}
                      >
                        {key.keyPrefix}…
                      </p>
                    </div>
                    {keyMenu(key)}
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={status.variant} className="font-normal">
                        {status.label}
                      </Badge>
                      <span className={cn("text-xs", ADMIN_SURFACE.muted)}>
                        {formatScopesSummary(key.scopes)}
                      </span>
                    </div>
                    <div className={cn("grid gap-1 text-xs", ADMIN_SURFACE.muted)}>
                      <p>Criada: {formatDateTime(key.createdAt)}</p>
                      <p>Último uso: {formatDateTime(key.lastUsedAt)}</p>
                      {key.expiresAt && (
                        <p>Expira: {formatDateTime(key.expiresAt)}</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {activeKeys.length > 0 && (
        <p className={cn("text-xs", ADMIN_SURFACE.muted)}>
          {activeKeys.length} chave{activeKeys.length === 1 ? "" : "s"} ativa
          {activeKeys.length === 1 ? "" : "s"}. Durante a rotação, você pode
          manter duas chaves ativas até revogar a antiga.
        </p>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md border-white/10 bg-[#151618] text-[#f5f5f5] ring-white/10">
          <DialogHeader>
            <DialogTitle className="text-[#f5f5f5]">
              Nova chave de API
            </DialogTitle>
            <DialogDescription className={ADMIN_SURFACE.muted}>
              Dê um nome para identificar onde essa chave será usada.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="space-y-2">
              <Label htmlFor="keyName" className="text-[#f5f5f5]">
                Nome
              </Label>
              <Input
                id="keyName"
                placeholder="WhatsApp n8n"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={ADMIN_SURFACE.input}
              />
            </div>
            {renderPermissionFields()}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              className={ADMIN_SURFACE.btnGhost}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreate}
              disabled={busy}
              className={ADMIN_SURFACE.btnPrimary}
            >
              Criar chave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!rotateTarget}
        onOpenChange={(open) => !open && setRotateTarget(null)}
      >
        <DialogContent className="max-w-md border-white/10 bg-[#151618] text-[#f5f5f5] ring-white/10">
          <DialogHeader>
            <DialogTitle className="text-[#f5f5f5]">
              Gerar chave substituta
            </DialogTitle>
            <DialogDescription className={ADMIN_SURFACE.muted}>
              Crie uma nova chave para substituir &quot;{rotateTarget?.name}
              &quot;. Você pode manter a antiga ativa durante a troca no n8n.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="space-y-2">
              <Label htmlFor="rotateName" className="text-[#f5f5f5]">
                Nome da nova chave
              </Label>
              <Input
                id="rotateName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={ADMIN_SURFACE.input}
              />
            </div>
            {renderPermissionFields()}
            <label className="flex items-start gap-2 text-sm text-[#d4d5d8]">
              <Checkbox
                checked={revokeOldOnRotate}
                onCheckedChange={(checked) =>
                  setRevokeOldOnRotate(checked === true)
                }
                className="mt-0.5"
              />
              <span>
                Revogar a chave antiga agora (desmarque para manter as duas
                ativas temporariamente)
              </span>
            </label>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRotateTarget(null)}
              className={ADMIN_SURFACE.btnGhost}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleRotate}
              disabled={busy}
              className={ADMIN_SURFACE.btnPrimary}
            >
              Gerar nova chave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={revealOpen}
        onOpenChange={(open) => {
          if (!open) closeReveal();
        }}
      >
        <DialogContent className="max-w-lg border-white/10 bg-[#151618] text-[#f5f5f5] ring-white/10">
          <DialogHeader>
            <DialogTitle className="text-[#f5f5f5]">
              Copie sua chave agora
            </DialogTitle>
            <DialogDescription className={ADMIN_SURFACE.muted}>
              Esta é a única vez que a chave completa será exibida. Guarde em
              local seguro — não será possível recuperá-la depois.
            </DialogDescription>
          </DialogHeader>
          {revealed && (
            <div className="flex flex-col gap-3">
              <p className="text-sm font-medium text-[#f5f5f5]">
                {revealed.name}
              </p>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={revealed.fullKey}
                  className={cn("font-mono text-xs", ADMIN_SURFACE.input)}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => copyKey(revealed.fullKey)}
                  className={ADMIN_SURFACE.btnGhost}
                >
                  <Copy />
                </Button>
              </div>
              <p className={cn("text-xs", ADMIN_SURFACE.muted)}>
                No n8n: credencial Header Auth, header{" "}
                <span className="font-mono text-[#d4d5d8]">Authorization</span>,
                valor{" "}
                <span className="font-mono text-[#d4d5d8]">
                  Bearer SUA_CHAVE
                </span>
                .
              </p>
            </div>
          )}
          <DialogFooter>
            <Button
              onClick={closeReveal}
              className={ADMIN_SURFACE.btnPrimary}
            >
              Já copiei, fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!revokeTarget}
        onOpenChange={(open) => !open && setRevokeTarget(null)}
      >
        <DialogContent className="border-white/10 bg-[#151618] text-[#f5f5f5] ring-white/10">
          <DialogHeader>
            <DialogTitle className="text-[#f5f5f5]">Revogar chave?</DialogTitle>
            <DialogDescription className={ADMIN_SURFACE.muted}>
              A chave &quot;{revokeTarget?.name}&quot; deixará de funcionar na
              hora. Integrações que a usam precisarão de outra chave. Não é
              possível reativar — crie uma nova se precisar.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRevokeTarget(null)}
              className={ADMIN_SURFACE.btnGhost}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleRevoke}
              disabled={busy}
            >
              Revogar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
