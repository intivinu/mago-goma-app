import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mago Goma | Juego de Palabras",
  description: "Encadena palabras por sus sílabas en este divertido juego.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
