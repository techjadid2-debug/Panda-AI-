import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hazrat Panda AI | CEO markazi",
  description: "Moliya, marketing va savdo agentlari uchun CEO boshqaruv paneli.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return <html lang="uz"><body>{children}</body></html>;
}
