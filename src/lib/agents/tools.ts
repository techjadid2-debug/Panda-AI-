import { tool } from "ai";
import { z } from "zod";
import { metricTable } from "@/lib/agents/metrics";
import { listOpenRecommendations, recentSnapshots } from "@/lib/db";
import { formatDue } from "@/lib/time";
import type { BusinessSnapshot } from "@/lib/types";

export function agentTools(snapshot: BusinessSnapshot) {
  const table = metricTable(snapshot);
  return {
    biznesKorsatkichlari: tool({
      description: "Bugungi savdo va moliya ko‘rsatkichlari. Har bir ko‘rsatkichning kaliti, nomi va qiymati qaytadi.",
      inputSchema: z.object({}),
      execute: async () => Object.values(table).map(({ key, label, text }) => ({ key, label, qiymat: text })),
    }),
    tarixiyTrend: tool({
      description: "So‘nggi kunlardagi ko‘rsatkichlar dinamikasi. Bugungi holat o‘tgan kunlarga nisbatan qanday o‘zgarganini ko‘rish uchun.",
      inputSchema: z.object({ kunlar: z.number().int().min(2).max(30).describe("Nechta kunlik tarix kerak.") }),
      execute: async ({ kunlar }) => {
        const history = await recentSnapshots(kunlar);
        if (history.length < 2) return { xabar: "Hali taqqoslash uchun yetarli tarix yo‘q." };
        return history.map(({ capturedOn, snapshot: past }) => {
          const values = metricTable(past);
          return { sana: capturedOn, korsatkichlar: Object.values(values).map(({ key, text }) => ({ key, qiymat: text })) };
        });
      },
    }),
    ochiqAmallar: tool({
      description: "Oldingi kunlardan qolgan, hali yopilmagan amallar. Takliflarni takrorlamaslik uchun ishlating.",
      inputSchema: z.object({ kunlar: z.number().int().min(1).max(30).describe("Nechta kun orqaga qarash kerak.") }),
      execute: async ({ kunlar }) => {
        const open = await listOpenRecommendations(kunlar);
        if (!open.length) return { xabar: "Ochiq amal yo‘q." };
        return open.map((item) => ({ bolim: item.owner, sarlavha: item.title, holat: item.status, muddat: formatDue(item.dueAt) }));
      },
    }),
  };
}
