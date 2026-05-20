import { db, gamesTable, type InsertGame } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

// Seed the games catalog with a starting set. Re-running is safe — we
// upsert by slug. New entries can be added here over time; existing rows
// have their cosmetic fields refreshed but are never deleted.
const SEED: InsertGame[] = [
  {
    slug: "rogue-fable-3",
    title: "Rogue Fable III",
    genre: "Browser Roguelike",
    coverImageUrl: "/rf3-cover.svg",
    description:
      "Turn-based browser roguelike. Hostable directly from your browser tab — no desktop agent required.",
    hasMods: true,
    isMultiplayer: false,
    hostSpectatesPlayer: true,
    hasQuests: true,
    browserHostUrl: "games/rf3/index.html",
  },
  {
    slug: "cyberpunk-2077",
    title: "Cyberpunk 2077",
    genre: "Action RPG",
    coverImageUrl: "/game-1.png",
    description:
      "Open-world cyberpunk RPG. Heavy on graphics and a strong fit for high-end host rigs.",
    hasMods: true,
    isMultiplayer: false,
    hostSpectatesPlayer: false,
    hasQuests: true,
  },
  {
    slug: "elden-ring",
    title: "Elden Ring",
    genre: "Soulslike",
    coverImageUrl: "/game-2.png",
    description:
      "Open-world soulslike. Co-op summons supported via online play.",
    hasMods: true,
    isMultiplayer: true,
    hostSpectatesPlayer: true,
    hasQuests: true,
  },
  {
    slug: "helldivers-2",
    title: "Helldivers 2",
    genre: "Co-op Shooter",
    coverImageUrl: "/game-3.png",
    description:
      "4-player co-op third-person shooter. Bring three friends to dive in.",
    hasMods: false,
    isMultiplayer: true,
    hostSpectatesPlayer: true,
    hasQuests: false,
  },
  {
    slug: "minecraft",
    title: "Minecraft",
    genre: "Sandbox",
    coverImageUrl: "",
    description:
      "Block-building sandbox with massive mod ecosystem. Hosts often run shaders + Forge packs.",
    hasMods: true,
    isMultiplayer: true,
    hostSpectatesPlayer: false,
    hasQuests: true,
  },
  {
    slug: "skyrim-special-edition",
    title: "Skyrim Special Edition",
    genre: "Open-world RPG",
    coverImageUrl: "",
    description:
      "Classic open-world RPG. Almost every host runs a different mod list.",
    hasMods: true,
    isMultiplayer: false,
    hostSpectatesPlayer: false,
    hasQuests: true,
  },
  {
    slug: "counter-strike-2",
    title: "Counter-Strike 2",
    genre: "Competitive FPS",
    coverImageUrl: "",
    description:
      "Tactical 5v5 shooter. Low-latency hosts only — pings matter.",
    hasMods: false,
    isMultiplayer: true,
    hostSpectatesPlayer: true,
    hasQuests: false,
  },
  {
    slug: "dota-2",
    title: "Dota 2",
    genre: "MOBA",
    coverImageUrl: "",
    description: "5v5 MOBA. Long matches — pick a host with stable uptime.",
    hasMods: false,
    isMultiplayer: true,
    hostSpectatesPlayer: true,
    hasQuests: false,
  },
  {
    slug: "satisfactory",
    title: "Satisfactory",
    genre: "Factory Builder",
    coverImageUrl: "",
    description:
      "First-person factory builder with co-op. Heavy late-game CPU load.",
    hasMods: true,
    isMultiplayer: true,
    hostSpectatesPlayer: false,
    hasQuests: true,
  },
];

export async function seedGames(): Promise<void> {
  for (const g of SEED) {
    const [existing] = await db
      .select()
      .from(gamesTable)
      .where(eq(gamesTable.slug, g.slug));
    if (existing) {
      await db
        .update(gamesTable)
        .set({
          title: g.title,
          genre: g.genre ?? "",
          coverImageUrl: g.coverImageUrl ?? "",
          description: g.description ?? "",
          hasMods: g.hasMods ?? false,
          isMultiplayer: g.isMultiplayer ?? false,
          hostSpectatesPlayer: g.hostSpectatesPlayer ?? false,
          hasQuests: g.hasQuests ?? false,
          browserHostUrl: g.browserHostUrl ?? "",
        })
        .where(eq(gamesTable.id, existing.id));
    } else {
      await db.insert(gamesTable).values(g);
    }
  }
  logger.info({ count: SEED.length }, "Games catalog seeded");
}
