import { redirect } from "next/navigation";

// Mục 5.2 (đã chốt): "Đọc tài liệu" chuyển sang khu phụ huynh.
// Giữ đường dẫn cũ và chuyển hướng để không vỡ link đã chia sẻ.
export default function LegacyDocumentRedirect() {
  redirect("/dashboard/tools?tab=document");
}
