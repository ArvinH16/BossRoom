import './global.css';
import Providers from './providers';

export const metadata = {
  title: 'BossRoom',
  description: 'Voxel 3D Office World',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#0a0a1a]">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
