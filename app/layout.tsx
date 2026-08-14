import type { Metadata } from "next";
import "./globals.css";
import "./refinements.css";
import "./text-edit.css";

export const metadata: Metadata = {
  title: "谢师傅工作室",
  description: "通过对话生成和编辑图片",
  icons: { icon: "/xie-studio-logo.png", apple: "/xie-studio-logo.png" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
