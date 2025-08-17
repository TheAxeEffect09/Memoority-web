export const metadata = {
  title: "MEMOORITY — Memories of Eternity",
  description: "Interactive world mosaic.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}