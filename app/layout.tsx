import { Geist_Mono, Source_Sans_3, Public_Sans } from "next/font/google"

import "./globals.css"
import { cn } from "@/lib/utils"

const publicSansHeading = Public_Sans({
  subsets: ["latin"],
  variable: "--font-heading",
})

const sourceSans3 = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-sans",
})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="vi"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        fontMono.variable,
        "font-sans",
        sourceSans3.variable,
        publicSansHeading.variable,
      )}
    >
      <body>{children}</body>
    </html>
  )
}
