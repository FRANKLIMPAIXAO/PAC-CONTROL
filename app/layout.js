import './globals.css';

export const metadata = {
  title: 'PAC CONTROL',
  description: 'Monitoramento corporativo transparente'
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
