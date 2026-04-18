import './globals.css';

export const metadata = {
  title: 'PAC CONTROL',
  description: 'Monitoramento corporativo transparente'
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
