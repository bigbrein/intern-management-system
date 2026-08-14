export default function EmployeeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <header>
        <h1>Employee Portal</h1>
      </header>
      <main>{children}</main>
    </>
  );
}
