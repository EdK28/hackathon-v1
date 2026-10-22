import './globals.css';

export const metadata = {
  title: { default: 'Clarify', template: '%s · Clarify' },
  description: 'Turn vague client requests into clear, signed-off project briefs.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
