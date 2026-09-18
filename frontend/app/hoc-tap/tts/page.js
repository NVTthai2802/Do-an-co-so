import { redirect } from "next/navigation";

// Mục 5.2 (đã chốt): "AI đọc cho bé" chuyển sang khu phụ huynh.
// Giữ đường dẫn cũ và chuyển hướng để không vỡ link đã chia sẻ.
export default function LegacyTtsRedirect() {
  redirect("/dashboard/tools?tab=tts");
}
