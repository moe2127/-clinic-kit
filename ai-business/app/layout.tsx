import type { Metadata } from 'next';import './globals.css';
export const metadata:Metadata={title:'AI販促・運営キット',description:'小さな院とサロンのための、編集できる運営素材。'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="ja"><body>{children}</body></html>}
