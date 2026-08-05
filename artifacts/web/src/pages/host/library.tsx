import { useState, useCallback, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { formatApiError } from "@/lib/api-errors";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  GripVertical,
  Plus,
  Pencil,
  Trash2,
  Gamepad2,
  Globe,
  Monitor,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  useListHostLibrary,
  useUpdateHostLibraryEntry,
  useRemoveHostLibraryEntry,
  getListHostLibraryQueryKey,
  type HostLibraryEntry,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  lztToUsd,
  resolveEntryKind,
  normalizeLibraryConfigValues,
  resolveDeleteConflictStatus,
} from "./library-helpers";
import { ExePathPicker } from "./exe-path-picker";
import { AddGameModal } from "./add-game-modal";

const cardStyle = {
  background: "#0a1018",
  border: "1px solid rgba(255,255,255,0.06)",
};

const inputStyle = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.08)",
  color: "#e2e8f0",
};

type LibraryEntry = HostLibraryEntry;

function LztBadge({ lzt, className = "" }: { lzt: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 font-mono ${className}`}>
      <span
        title="Доход хоста — зачисляется на баланс «К выводу»"
        className="inline-block w-2 h-2 rounded-full"
        style={{ background: "#34d399" }}
      />
      <span
        title="Игровой баланс"
        className="inline-block w-2 h-2 rounded-full -ml-0.5"
        style={{ background: "#38bdf8" }}
      />
      <span className="text-emerald-300 font-bold">{lzt.toLocaleString("ru-RU")}</span>
      <span className="text-slate-500 text-xs">LZT</span>
      <span className="text-slate-600 text-xs">≈${lztToUsd(lzt)}</span>
    </span>
  );
}

// --------------------------------------------------------------------------
// Sortable row
// --------------------------------------------------------------------------
function SortableRow({
  entry,
  hasActiveSession,
  onToggle,
  onEdit,
  onDelete,
  toggling,
}: {
  entry: LibraryEntry;
  hasActiveSession: boolean;
  onToggle: (e: LibraryEntry) => void;
  onEdit: (e: LibraryEntry) => void;
  onDelete: (e: LibraryEntry) => void;
  toggling: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: entry.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  const isBrowser = resolveEntryKind(entry) === "browser";

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        background: isDragging ? "rgba(14,165,233,0.08)" : undefined,
        border: isDragging ? "1px solid rgba(14,165,233,0.25)" : undefined,
      }}
      className="flex items-center gap-3 px-3 py-3 rounded-lg"
    >
      {/* Drag handle */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="text-slate-600 hover:text-slate-400 cursor-grab active:cursor-grabbing flex-shrink-0"
        title="Перетащи для изменения порядка"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Cover */}
      <div
        className="w-9 h-9 rounded flex-shrink-0 flex items-center justify-center overflow-hidden"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        {entry.game.coverImageUrl ? (
          <img src={entry.game.coverImageUrl} alt="" className="w-full h-full object-cover rounded" />
        ) : (
          <Gamepad2 className="h-4 w-4 text-slate-600" />
        )}
      </div>

      {/* Title + meta */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-white text-sm truncate">{entry.game.title}</span>
          <Badge
            variant="outline"
            className="text-[10px] h-4 px-1.5 flex-shrink-0"
            style={{
              background: isBrowser ? "rgba(16,185,129,0.12)" : "rgba(14,165,233,0.12)",
              color: isBrowser ? "#34d399" : "#38bdf8",
              border: isBrowser ? "1px solid rgba(16,185,129,0.3)" : "1px solid rgba(14,165,233,0.3)",
            }}
          >
            {isBrowser ? <Globe className="h-2.5 w-2.5 mr-0.5" /> : <Monitor className="h-2.5 w-2.5 mr-0.5" />}
            {isBrowser ? "браузер" : "нативная"}
          </Badge>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <LztBadge lzt={entry.pricePerMinuteLzt} className="text-xs" />
          {!entry.enabled && (
            <span className="text-[10px] text-slate-600 italic">выключена</span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Switch
                checked={entry.enabled}
                disabled={toggling}
                onCheckedChange={() => onToggle(entry)}
                className="data-[state=checked]:bg-sky-500"
              />
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {entry.enabled ? "Выключить игру" : "Включить игру"}
          </TooltipContent>
        </Tooltip>

        {/* Edit */}
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0 text-slate-400 hover:text-white"
          onClick={() => onEdit(entry)}
          title="Редактировать"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>

        {/* Delete */}
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-slate-500 hover:text-red-400"
                onClick={() => !hasActiveSession && onDelete(entry)}
                disabled={hasActiveSession}
                title={hasActiveSession ? "Есть активная сессия" : "Удалить"}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </span>
          </TooltipTrigger>
          {hasActiveSession && (
            <TooltipContent>Нельзя удалить: идёт активная сессия</TooltipContent>
          )}
        </Tooltip>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Edit modal
// --------------------------------------------------------------------------
function EditModal({
  entry,
  open,
  onClose,
  onSave,
}: {
  entry: LibraryEntry | null;
  open: boolean;
  onClose: () => void;
  onSave: (gameId: string, v: { pricePerMinuteLzt: number; appPath: string; boundUrl: string; launchArgs: string }) => Promise<void>;
}) {
  const [price, setPrice] = useState("0");
  const [appPath, setAppPath] = useState("");
  const [boundUrl, setBoundUrl] = useState("");
  const [launchArgs, setLaunchArgs] = useState("");
  const [saving, setSaving] = useState(false);
  const [pathErr, setPathErr] = useState("");

  useEffect(() => {
    if (entry) {
      setPrice(String(entry.pricePerMinuteLzt));
      setAppPath(entry.appPath);
      setBoundUrl(entry.boundUrl);
      setLaunchArgs(entry.launchArgs);
      setPathErr("");
    }
  }, [entry]);

  if (!entry) return null;
  const isBrowser = resolveEntryKind(entry) === "browser";

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const { values, pathError } = normalizeLibraryConfigValues({
      isBrowser,
      price,
      appPath,
      boundUrl,
      launchArgs,
    });
    if (pathError) {
      setPathErr(pathError);
      return;
    }
    setSaving(true);
    await onSave(entry.gameId, values);
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md" style={{ background: "#0d1520", border: "1px solid rgba(255,255,255,0.08)" }}>
        <DialogHeader>
          <DialogTitle className="text-white">Редактировать: {entry.game.title}</DialogTitle>
          <DialogDescription className="text-slate-500">Измени настройки запуска и цену.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-sm">Цена за минуту (LZT)</Label>
            <div className="flex items-center gap-3">
              <Input type="number" min={0} max={200000} value={price} onChange={(e) => setPrice(e.target.value)} className="w-32" style={inputStyle} />
              <span className="text-xs text-slate-500">≈ ${lztToUsd(parseInt(price, 10) || 0)} / мин</span>
            </div>
          </div>
          {isBrowser ? (
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-sm">URL браузерной игры</Label>
              <Input value={boundUrl} onChange={(e) => setBoundUrl(e.target.value)} style={inputStyle} />
            </div>
          ) : (
            <>
              <ExePathPicker
                value={appPath}
                onChange={setAppPath}
                pathErr={pathErr || undefined}
                onClearError={() => setPathErr("")}
              />
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-sm">Аргументы <span className="text-slate-500 font-normal">(опционально)</span></Label>
                <Input value={launchArgs} onChange={(e) => setLaunchArgs(e.target.value)} style={inputStyle} className="font-mono" />
              </div>
            </>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="border-white/10 text-slate-300 hover:text-white">Отмена</Button>
            <Button type="submit" disabled={saving} style={{ background: "#0ea5e9", color: "#fff" }}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Сохранить
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// --------------------------------------------------------------------------
// Delete confirmation modal
// --------------------------------------------------------------------------
function DeleteModal({
  entry,
  open,
  onClose,
  onConfirm,
}: {
  entry: LibraryEntry | null;
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [deleting, setDeleting] = useState(false);

  const handle = async () => {
    setDeleting(true);
    await onConfirm();
    setDeleting(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-sm" style={{ background: "#0d1520", border: "1px solid rgba(255,255,255,0.08)" }}>
        <DialogHeader>
          <DialogTitle className="text-white">Удалить игру?</DialogTitle>
          <DialogDescription className="text-slate-500">
            «{entry?.game.title}» будет удалена из твоей библиотеки. Это действие необратимо.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2 mt-4">
          <Button type="button" variant="outline" onClick={onClose} className="border-white/10 text-slate-300 hover:text-white">Отмена</Button>
          <Button type="button" onClick={handle} disabled={deleting} style={{ background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }}>
            {deleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Удалить
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// --------------------------------------------------------------------------
// Main page
// --------------------------------------------------------------------------
export default function HostLibrary() {
  const { hostToken } = useAuth();
  const queryClient = useQueryClient();
  const [localEntries, setLocalEntries] = useState<LibraryEntry[] | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<LibraryEntry | null>(null);
  const [deleteEntry, setDeleteEntry] = useState<LibraryEntry | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  const {
    data: remoteEntries,
    isLoading: loading,
    isError,
    refetch,
  } = useListHostLibrary(hostToken ?? "", {
    query: {
      enabled: !!hostToken,
      queryKey: getListHostLibraryQueryKey(hostToken ?? ""),
    },
  });

  const updateEntry = useUpdateHostLibraryEntry();
  const removeEntry = useRemoveHostLibraryEntry();

  const sortedRemote = useMemo(() => {
    if (!remoteEntries) return [];
    return [...remoteEntries].sort((a, b) => a.sortOrder - b.sortOrder);
  }, [remoteEntries]);

  // Prefer optimistic local order while drag/reorder is in flight.
  const entries = localEntries ?? sortedRemote;

  useEffect(() => {
    setLocalEntries(null);
  }, [sortedRemote]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const invalidateLibrary = useCallback(() => {
    if (!hostToken) return;
    void queryClient.invalidateQueries({
      queryKey: getListHostLibraryQueryKey(hostToken),
    });
  }, [hostToken, queryClient]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !hostToken) return;

    const oldIndex = entries.findIndex((e) => e.id === active.id);
    const newIndex = entries.findIndex((e) => e.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const previous = entries;
    const reordered = arrayMove(entries, oldIndex, newIndex);
    setLocalEntries(reordered);

    try {
      await Promise.all(
        reordered.map((entry, idx) =>
          updateEntry.mutateAsync({
            hostToken,
            gameId: entry.gameId,
            data: { sortOrder: idx },
          }),
        ),
      );
      invalidateLibrary();
    } catch {
      setLocalEntries(previous);
      toast.error("Не удалось сохранить порядок — изменения отменены");
      void refetch();
    }
  };

  const handleToggle = async (entry: LibraryEntry) => {
    if (!hostToken) return;
    setToggling(entry.id);
    try {
      await updateEntry.mutateAsync({
        hostToken,
        gameId: entry.gameId,
        data: { enabled: !entry.enabled },
      });
      setLocalEntries((prev) => {
        const base = prev ?? entries;
        return base.map((e) =>
          e.id === entry.id ? { ...e, enabled: !e.enabled } : e,
        );
      });
      invalidateLibrary();
    } catch (err) {
      toast.error(formatApiError(err, "Не удалось переключить"));
    } finally {
      setToggling(null);
    }
  };

  const handleEdit = async (
    gameId: string,
    v: { pricePerMinuteLzt: number; appPath: string; boundUrl: string; launchArgs: string },
  ) => {
    if (!hostToken) return;
    try {
      await updateEntry.mutateAsync({ hostToken, gameId, data: v });
      toast.success("Сохранено");
      setEditEntry(null);
      invalidateLibrary();
    } catch (err) {
      toast.error(formatApiError(err, "Не удалось сохранить"));
    }
  };

  const handleDelete = async () => {
    if (!deleteEntry || !hostToken) return;
    try {
      await removeEntry.mutateAsync({
        hostToken,
        gameId: deleteEntry.gameId,
      });
      toast.success(`«${deleteEntry.game.title}» удалена из библиотеки`);
      setDeleteEntry(null);
      invalidateLibrary();
    } catch (err) {
      if (resolveDeleteConflictStatus(err) === 409) {
        toast.error("Нельзя удалить: идёт активная сессия");
      }
      else toast.error(formatApiError(err, "Не удалось удалить"));
    }
  };

  return (
    <div className="space-y-6 text-slate-300">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Моя библиотека</h1>
          <p className="text-sm text-slate-500">Игры, которые ты хостишь. Первая в списке — дефолтная при коннекте игрока.</p>
        </div>
        <Button
          onClick={() => setAddOpen(true)}
          className="font-bold gap-2"
          style={{ background: "#0ea5e9", color: "#fff" }}
          data-testid="button-add-game"
        >
          <Plus className="h-4 w-4" />
          Добавить игру
        </Button>
      </div>

      <Card style={cardStyle}>
        <CardHeader>
          <CardTitle className="text-base text-white flex items-center gap-2">
            <Gamepad2 className="h-4 w-4 text-sky-400" />
            Библиотека
            {!loading && entries.length > 0 && (
              <Badge variant="outline" className="text-[10px] ml-auto border-white/10 text-slate-400">
                {entries.length} игр
              </Badge>
            )}
          </CardTitle>
          <CardDescription className="text-slate-500">
            Перетащи строки для изменения порядка отображения.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : isError ? (
            <div className="py-10 text-center space-y-3">
              <p className="text-sm text-slate-400">Не удалось загрузить библиотеку</p>
              <Button size="sm" variant="outline" onClick={() => void refetch()}>
                Повторить
              </Button>
            </div>
          ) : entries.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-14 text-center rounded-lg"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.08)" }}
            >
              <Gamepad2 className="h-16 w-16 text-slate-700 mb-4" />
              <p className="text-slate-300 font-semibold text-lg mb-1">Библиотека пуста</p>
              <p className="text-sm text-slate-500 mb-6 max-w-xs">
                Добавь первую игру из глобального каталога или предложи новую.
              </p>
              <Button
                onClick={() => setAddOpen(true)}
                className="font-bold gap-2"
                style={{ background: "#0ea5e9", color: "#fff" }}
              >
                <Plus className="h-4 w-4" />
                Добавить первую игру
              </Button>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={entries.map((e) => e.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-1">
                  {entries.map((entry) => (
                    <SortableRow
                      key={entry.id}
                      entry={entry}
                      hasActiveSession={entry.hasActiveSession}
                      onToggle={handleToggle}
                      onEdit={setEditEntry}
                      onDelete={setDeleteEntry}
                      toggling={toggling === entry.id}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </CardContent>
      </Card>

      {/* Mobile hint */}
      {entries.length > 0 && (
        <p className="text-[11px] text-slate-600 text-center">
          Первая игра в списке будет выбрана по умолчанию, когда игрок подключается без явного выбора.
        </p>
      )}

      <AddGameModal
        hostToken={hostToken ?? ""}
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdded={invalidateLibrary}
      />
      <EditModal
        entry={editEntry}
        open={!!editEntry}
        onClose={() => setEditEntry(null)}
        onSave={handleEdit}
      />
      <DeleteModal
        entry={deleteEntry}
        open={!!deleteEntry}
        onClose={() => setDeleteEntry(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
