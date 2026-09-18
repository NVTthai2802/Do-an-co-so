import { Baloo_2, Nunito } from "next/font/google";
import "./globals.css";

// Mục 4.2 – cả hai font đều có subset tiếng Việt trên Google Fonts,
// nên hiển thị đúng Ă Â Đ Ê Ô Ơ Ư cùng mọi dấu thanh (sửa lỗi R7).
const baloo = Baloo_2({
  subsets: ["latin", "vietnamese"],
  weight: ["600", "700", "800"],
  variable: "--font-baloo",
  display: "swap",
});

const nunito = Nunito({
  subsets: ["latin", "vietnamese"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-nunito",
  display: "swap",
});

export const metadata = {
  title: "KidLearn",
  description: "Trang web học số, học chữ và học hình cho bé",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi" className={`${baloo.variable} ${nunito.variable}`}>
      <body>{children}</body>
    </html>
  );
}
