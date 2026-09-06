import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'NACRE 星隙 — 深空突围', description: '驾驶原创游隼星舰穿越碎星带，体验精细硬表面模型、双轨脉冲炮和电影感深空跃迁。', icons: { icon: '/favicon.svg' } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="zh-CN"><body>{children}</body></html>; }
