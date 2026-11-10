import "./globals.css";
export const metadata = { title: "Koya Clinic", description: "Simple appointment booking" };
export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
