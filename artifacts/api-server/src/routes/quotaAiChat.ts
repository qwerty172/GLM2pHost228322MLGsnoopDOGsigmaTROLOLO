import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import Anthropic from "@anthropic-ai/sdk";
import { resolveOwnerByToken } from "../lib/walletOwner";

const router: IRouter = Router();

let _client: Anthropic | null | undefined = undefined;

function getAnthropicClient(): Anthropic | null {
  if (_client !== undefined) return _client;
  const baseURL = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;
  const apiKey = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;
  if (!baseURL || !apiKey) {
    _client = null;
    return null;
  }
  _client = new Anthropic({ apiKey, baseURL });
  return _client;
}

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

const FormStateSchema = z.object({
  kind: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  visibility: z.string().optional(),
  royaltyBasis: z.string().optional(),
  royaltyValue: z.number().optional(),
  royaltySource: z.string().optional(),
  budgetLzt: z.number().optional(),
  sponsorHostPerMinute: z.number().optional(),
  sponsorPlayerPerMinute: z.number().optional(),
  gameId: z.string().optional(),
  minSessionMinutes: z.string().optional(),
  maxSessionMinutes: z.string().optional(),
  startAt: z.string().optional(),
  endAt: z.string().optional(),
  minGpuVram: z.number().nullish(),
  minCpuCores: z.number().nullish(),
  minRamGb: z.number().nullish(),
  minDownloadMbps: z.number().nullish(),
  minUploadMbps: z.number().nullish(),
});

const GameSchema = z.object({ id: z.string(), title: z.string() });

const BodySchema = z.object({
  ownerToken: z.string(),
  messages: z.array(MessageSchema),
  currentFormState: FormStateSchema,
  availableGames: z.array(GameSchema).optional(),
});

const SYSTEM_PROMPT = `Ты — ИИ-помощник для заполнения формы создания/редактирования квоты на платформе облачного гейминга LazorTech.

Квота — это пресет-контракт, который хост или игрок прикрепляет к сессии.

## Схема квоты

### Общие поля
- **kind**: "royalty" | "sponsor"  — тип квоты (обязательно)
- **title**: string — название квоты (обязательно)
- **description**: string — описание
- **visibility**: "public" | "private" — публичная или по коду (по умолчанию "public")
- **gameId**: string | null — ID игры из списка availableGames, или null (любая игра)
- **minSessionMinutes**: строка с числом | "" — минимальная длина сессии в минутах
- **maxSessionMinutes**: строка с числом | "" — максимальная длина сессии в минутах
- **startAt**: строка datetime-local ("YYYY-MM-DDTHH:MM") | "" — начало действия
- **endAt**: строка datetime-local ("YYYY-MM-DDTHH:MM") | "" — конец действия

### Только для kind="royalty"
- **royaltyBasis**: "percent" | "fixed_per_minute"
  - "percent" — процент от минуты (0–100)
  - "fixed_per_minute" — фиксированная сумма LZT за минуту
- **royaltyValue**: число (целое, >= 0; если basis="percent", то 0–100)
- **royaltySource**: "player" | "host_share"
  - "host_share" — роялти вычитается из доли хоста
  - "player" — роялти берётся сверху с игрока

### Только для kind="sponsor"
- **budgetLzt**: число (целое, > 0) — общий бюджет эскроу в LZT
- **sponsorHostPerMinute**: число (целое, >= 0) — доплата хосту LZT/мин
- **sponsorPlayerPerMinute**: число (целое, >= 0) — доплата игроку LZT/мин
  (хотя бы одно из двух должно быть > 0)

## Правила
1. Всегда используй инструмент update_form_fields чтобы применить изменения к форме.
2. В текстовом ответе пиши только на русском, кратко и по делу.
3. Формат ответа: «Заполнил: [перечень изменённых полей и значений]. Что-то поменять?»
4. Если пользователь упоминает игру по названию — найди её id из списка availableGames. Если точного совпадения нет — спроси уточнение.
5. Если не хватает данных для заполнения — задай один уточняющий вопрос.
6. Не публикуй квоту сам — пользователь сделает это кнопкой.
7. Для спонсорской квоты обязательно нужен budgetLzt > 0 и хотя бы одна ставка > 0.
8. Для роялти обязательны royaltyBasis, royaltyValue и royaltySource.
9. Если пользователь говорит «только быстрые хосты», «хорошее соединение», «стрим без фризов» — устанавливай minUploadMbps (рекомендуется ≥10 для 1080p, ≥20 для высококачественного стрима). Поясни это пользователю.
10. Поля minGpuVram, minCpuCores, minRamGb, minDownloadMbps, minUploadMbps задают минимальные требования к хосту — квоту нельзя прикрепить к сессии хоста, чей ПК ниже этих порогов.`;

const updateFormFieldsTool: Anthropic.Tool = {
  name: "update_form_fields",
  description:
    "Обновляет поля формы квоты. Передавай только те поля, которые нужно изменить.",
  input_schema: {
    type: "object",
    properties: {
      kind: {
        type: "string",
        enum: ["royalty", "sponsor"],
        description: "Тип квоты",
      },
      title: { type: "string", description: "Название квоты" },
      description: { type: "string", description: "Описание квоты" },
      visibility: {
        type: "string",
        enum: ["public", "private"],
        description: "Видимость",
      },
      royaltyBasis: {
        type: "string",
        enum: ["percent", "fixed_per_minute"],
        description: "База расчёта роялти",
      },
      royaltyValue: {
        type: "number",
        description: "Значение роялти (процент 0–100 или LZT/мин)",
      },
      royaltySource: {
        type: "string",
        enum: ["player", "host_share"],
        description: "Откуда брать роялти",
      },
      budgetLzt: {
        type: "number",
        description: "Бюджет эскроу в LZT (для sponsor)",
      },
      sponsorHostPerMinute: {
        type: "number",
        description: "Доплата хосту LZT/мин (для sponsor)",
      },
      sponsorPlayerPerMinute: {
        type: "number",
        description: "Доплата игроку LZT/мин (для sponsor)",
      },
      gameId: {
        type: "string",
        description: "ID игры (или пустая строка для любой игры)",
      },
      minSessionMinutes: {
        type: "string",
        description: "Мин. длина сессии в минутах (строка с числом или пустая)",
      },
      maxSessionMinutes: {
        type: "string",
        description: "Макс. длина сессии в минутах (строка с числом или пустая)",
      },
      startAt: {
        type: "string",
        description: "Начало действия в формате YYYY-MM-DDTHH:MM (или пустая строка)",
      },
      endAt: {
        type: "string",
        description: "Конец действия в формате YYYY-MM-DDTHH:MM (или пустая строка)",
      },
      minGpuVram: {
        type: "number",
        description: "Минимальный VRAM GPU в ГБ",
      },
      minCpuCores: {
        type: "number",
        description: "Минимальное количество ядер CPU",
      },
      minRamGb: {
        type: "number",
        description: "Минимальный объём RAM в ГБ",
      },
      minDownloadMbps: {
        type: "number",
        description: "Минимальная скорость скачивания в Мбит/с",
      },
      minUploadMbps: {
        type: "number",
        description: "Минимальная скорость аплоада в Мбит/с (рекомендуется ≥10 для 1080p стрима)",
      },
    },
  },
};

const VALID_FORM_PATCH_KEYS = new Set([
  "kind", "title", "description", "visibility", "royaltyBasis",
  "royaltyValue", "royaltySource", "budgetLzt", "sponsorHostPerMinute",
  "sponsorPlayerPerMinute", "gameId", "minSessionMinutes",
  "maxSessionMinutes", "startAt", "endAt",
  "minGpuVram", "minCpuCores", "minRamGb", "minDownloadMbps", "minUploadMbps",
]);

function sanitizeFormPatch(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(raw)) {
    if (VALID_FORM_PATCH_KEYS.has(key)) {
      out[key] = raw[key];
    }
  }
  return out;
}

router.post("/quotas/ai-chat", async (req, res): Promise<void> => {
  const parsed = BodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { ownerToken, messages, currentFormState, availableGames = [] } = parsed.data;

  const owner = await resolveOwnerByToken(ownerToken);
  if (!owner) {
    res.status(401).json({ error: "Invalid owner token" });
    return;
  }

  const client = getAnthropicClient();
  if (!client) {
    res.status(503).json({ error: "AI assistant is not available in this environment" });
    return;
  }

  const systemWithContext = `${SYSTEM_PROMPT}

## Текущее состояние формы
${JSON.stringify(currentFormState, null, 2)}

## Доступные игры
${availableGames.length > 0 ? availableGames.map((g) => `- ${g.title} (id: ${g.id})`).join("\n") : "Игры не загружены"}`;

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      system: systemWithContext,
      tools: [updateFormFieldsTool],
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    let replyText = "";
    let formPatch: Record<string, unknown> | null = null;

    for (const block of response.content) {
      if (block.type === "text") {
        replyText += block.text;
      } else if (block.type === "tool_use" && block.name === "update_form_fields") {
        formPatch = sanitizeFormPatch(block.input as Record<string, unknown>);
      }
    }

    if (!replyText && formPatch) {
      const fieldNames = Object.keys(formPatch);
      replyText = `Заполнил: ${fieldNames.join(", ")}. Что-то поменять?`;
    }
    if (!replyText) {
      replyText = "Готово! Что-то поменять?";
    }

    res.json({ reply: replyText, formPatch: formPatch ?? undefined });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI error";
    res.status(500).json({ error: msg });
  }
});

export default router;
