import type { Metadata, Viewport } from "next";
import { Fredoka, Manrope } from "next/font/google";
import "./globals.css";

const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Jam Bakery — заказ",
  description: "Самовывоз, доставка и торты на заказ для Jam Bakery, Костанай",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className={`${fredoka.variable} ${manrope.variable} h-full`}>
      <body className="min-h-full flex flex-col font-sans antialiased bg-bg text-fg">
        {children}
      </body>
    </html>
  );
}
