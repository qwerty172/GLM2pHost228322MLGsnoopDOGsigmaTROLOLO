import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export type IceConnectionType = "relay" | "srflx" | "host";

const ICE_HINTS: Record<
  IceConnectionType,
  { label: string; hint: string; borderColor: string; textColor: string }
> = {
  relay: {
    label: "Через сервер",
    hint:
      "Видео идёт через промежуточный сервер — задержка может быть выше. Если картинка лагает, попросите хоста проверить файрвол и антивирус.",
    borderColor: "#a855f7",
    textColor: "#c084fc",
  },
  srflx: {
    label: "Через NAT",
    hint:
      "Соединение установлено через обход NAT. Обычно стабильно; при обрывах попробуйте переподключиться.",
    borderColor: "#22c55e",
    textColor: "#86efac",
  },
  host: {
    label: "Прямое",
    hint: "Прямое соединение с хостом — оптимальная задержка.",
    borderColor: "#22c55e",
    textColor: "#86efac",
  },
};

export function IceConnectivityBadge({ type }: { type: IceConnectionType }) {
  const meta = ICE_HINTS[type];

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className="bg-black/50 backdrop-blur font-mono text-[10px] cursor-help"
            style={{ borderColor: meta.borderColor, color: meta.textColor }}
          >
            {meta.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs text-xs leading-relaxed">
          {meta.hint}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
