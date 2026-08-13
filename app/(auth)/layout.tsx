export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <header>
        <h1>My App</h1>
      </header>
      <main>{children}</main>
    </div>
  );
}
