import type { Metadata, Viewport } from "next";
import { Inter, Poppins } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "../contexts/AuthContext";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const poppins = Poppins({
  variable: "--font-poppins",
  weight: ["400", "600", "700", "800"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FlavorDex — Your pantry, now collectible.",
  description: "Collect unusual ingredients, unlock recipes, and turn every meal into a small adventure.",
};

export const viewport: Viewport = {
  themeColor: "#080b10",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${poppins.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-background font-sans text-foreground selection:bg-[#e77a9b]/30">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
