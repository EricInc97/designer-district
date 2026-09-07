import type { Metadata } from "next";
import {
  Geist,
  Geist_Mono,
  Anton,
  Archivo_Black,
  Pirata_One,
  Permanent_Marker,
  Bodoni_Moda,
} from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CartDrawer from "@/components/CartDrawer";
import RecommendationPopup from "@/components/RecommendationPopup";
import Splash from "@/components/Splash";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

/**
 * Display faces used only by <BrandMark />, one per house, chosen to match
 * each brand's own typographic register (condensed block, geometric,
 * blackletter, Didone serif, marker script). Single weight, latin subset, swap-on-load.
 */
const anton = Anton({
  variable: "--font-collegiate",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});
const archivoBlack = Archivo_Black({
  variable: "--font-geometric",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});
const pirataOne = Pirata_One({
  variable: "--font-blackletter",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});
const bodoni = Bodoni_Moda({
  variable: "--font-didone",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});
const permanentMarker = Permanent_Marker({
  variable: "--font-marker",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const fontVars = [
  geistSans.variable,
  geistMono.variable,
  anton.variable,
  archivoBlack.variable,
  pirataOne.variable,
  permanentMarker.variable,
  bodoni.variable,
].join(" ");

export const metadata: Metadata = {
  title: {
    default: "Designer District, Premium Streetwear",
    template: "%s · Designer District",
  },
  description:
    "Bape, Chrome Hearts, Balenciaga, Amiri, Supreme and more. The house of the most wanted names in streetwear.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: the inline splash script stamps data-splash on
    // <html> before React hydrates, which React would otherwise report as a
    // server/client attribute mismatch. It covers this element's own
    // attributes only, not its children.
    <html
      lang="en"
      className={`${fontVars} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-paper text-ink">
        {/* Runs before the splash markup paints, so a returning visitor in this
            tab never sees a frame of it. Kept inline and dependency-free on
            purpose: anything async would be too late. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(sessionStorage.getItem('dd-splash')){document.documentElement.dataset.splash='skip'}}catch(e){}",
          }}
        />
        <Splash />
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
        <CartDrawer />
        <RecommendationPopup />
      </body>
    </html>
  );
}
