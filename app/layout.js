export const metadata = {
  title: 'BMB APIs',
  description: 'Brand My Beverage APIs project deployed on Vercel',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
