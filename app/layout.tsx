import type { Metadata, Viewport } from "next"
import { Fraunces, Cairo, JetBrains_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { Toaster } from "@/components/ui/sonner"
import "./globals.css"

// Display — editorial serif with sharp character (variable font)
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display-impl",
  display: "swap",
})

// Body — clean Arabic + Latin pairing (variable font)
const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-sans-impl",
  display: "swap",
})

// Mono — for codes, numbers, labels (variable font)
const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-impl",
  display: "swap",
})

export const metadata: Metadata = {
  title: "منصة التحقق | ITQ Testing",
  description: "منصة تتبع اختبارات المقرأة والأكاديمية — تحديث لحظي وتعاون مباشر",
  generator: "v0.app",
}

export const viewport: Viewport = {
  themeColor: "#FBF8F2",
  colorScheme: "light",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${fraunces.variable} ${cairo.variable} ${jetBrainsMono.variable}`}
    >
      <body className="font-sans antialiased min-h-screen bg-background">
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: "#fff",
              border: "1px solid oklch(0.88 0.008 85)",
              color: "oklch(0.18 0.01 220)",
            },
          }}
        />
        {process.env.NODE_ENV === "production" && <Analytics />}
      </body>
    </html>
  )
}
