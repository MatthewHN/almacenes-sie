import './globals.css';

export const metadata = {
  title: 'Stock Atelier - AI Inventory',
  description: 'Gestiona tu inventario con IA',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-slate-900 border-slate-700">{children}</body>
    </html>
  );
}
