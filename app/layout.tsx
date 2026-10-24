import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AttendEase | Student Attendance System",
  description:
    "Automated Student Attendance Monitoring and Analytics System for Colleges.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
