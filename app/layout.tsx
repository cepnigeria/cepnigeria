import type { Metadata } from "next";
import "./globals.css";
import "./forms.css";
export const metadata: Metadata = {
  title: "CEP Nigeria | Coalition of Entrepreneurs and Professionals",
  description: "Connect, grow and access opportunities with CEP Nigeria.",
  icons: { icon: "/cep-logo.jpeg" },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
