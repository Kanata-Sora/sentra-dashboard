"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Upload, Library } from "lucide-react";

const navItems = [
  { href: "/", label: "ダッシュボード", icon: LayoutDashboard },
  { href: "/upload", label: "アップロード", icon: Upload },
  { href: "/knowledge", label: "ナレッジベース", icon: Library },
];

export default function Header() {
  const pathname = usePathname();

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">S</span>
            </div>
            <span className="font-bold text-gray-900 text-lg">SENTRA Dashboard</span>
          </Link>

          <nav className="flex items-center gap-1">
            {navItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  pathname === href
                    ? "bg-primary-50 text-primary-700"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}
