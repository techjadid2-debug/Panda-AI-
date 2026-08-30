import { describe, expect, it } from "vitest";
import { esc } from "@/lib/telegram";

describe("esc (HTML qochirish)", () => {
  it("HTML maxsus belgilarini qochiradi", () => {
    expect(esc(`5 < 6 & "reja" > fakt`)).toBe(`5 &lt; 6 &amp; "reja" &gt; fakt`);
  });

  it("Markdown'da xabar yiqitadigan belgilarga tegmaydi", () => {
    // Eski Markdown rejimida ] ( ) ~ _ * belgilarining har biri 400 xatoga olib kelishi mumkin edi.
    expect(esc("Reja (fakt) [50%] ~o‘rtacha~ *muhim*_")).toBe("Reja (fakt) [50%] ~o‘rtacha~ *muhim*_");
  });
});
