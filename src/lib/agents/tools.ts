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
      description: "So‘nggi kunlardagi ko‘rsatkichlar dinamikasi: har bir ko‘rsatkich uchun hozirgi qiymat, davr boshidagi qiymat va o‘zgarish foizi.",
      inputSchema: z.object({ kunlar: z.number().int().min(2).max(30).describe("Nechta kunlik tarix kerak.") }),
      execute: async ({ kunlar }) => {
        const history = await recentSnapshots(kunlar);
        if (history.length < 2) return { xabar: "Hali taqqoslash uchun yetarli tarix yo‘q." };
        // Xom kunlik qatorlar o‘rniga tayyor taqqos — model o‘zi hisoblashi shart emas va prompt ham kichik qoladi.
        const newest = metricTable(history[0].snapshot);
        const oldest = metricTable(history[history.length - 1].snapshot);
        return {
          davr: `${history[history.length - 1].capturedOn} → ${history[0].capturedOn} (${history.length} kunlik yozuv)`,
          korsatkichlar: Object.values(newest).map(({ key, label, value, text }) => {
            const past = oldest[key];
            const diff = value - past.value;
            const share = past.value ? Math.round((diff / Math.abs(past.value)) * 100) : null;
            return {
              key, nom: label, hozir: text, davrBoshida: past.text,
              ozgarish: diff === 0 ? "o‘zgarmagan" : share === null ? (diff > 0 ? "oshgan" : "kamaygan") : `${diff > 0 ? "+" : ""}${share}%`,
            };
          }),
        };
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
