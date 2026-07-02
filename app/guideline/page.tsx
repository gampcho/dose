"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  RiCapsuleLine,
  RiFileListLine,
  RiCameraLine,
  RiCheckboxCircleLine,
  RiCheckLine,
  RiArrowLeftLine,
  RiArrowRightLine,
  RiShieldCheckLine,
  RiVolumeUpLine,
  RiEditLine,
  RiFileTextLine,
  RiSunLine,
  RiFocus3Line,
  RiLayoutGridLine,
  RiCheckboxCircleFill,
  RiCloseCircleFill,
  RiErrorWarningFill,
  RiQuestionLine,
  RiScanLine,
  RiRocketLine,
} from "@remixicon/react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type SlideIcon = typeof RiCapsuleLine

interface Detail {
  icon: SlideIcon
  iconClass: string
  text: string
}

interface Slide {
  icon: SlideIcon
  badge: string
  title: string
  description: string
  details: Detail[]
}

const SLIDES: Slide[] = [
  {
    icon: RiCapsuleLine,
    badge: "Chào mừng",
    title: "Không lo nhầm liều thuốc",
    description:
      "Chụp khay thuốc trước khi uống, DOSE kiểm tra giúp bạn và báo ngay nếu có bất thường.",
    details: [
      {
        icon: RiShieldCheckLine,
        iconClass: "text-primary",
        text: "Ảnh và dữ liệu chỉ nằm trên máy của bạn, không gửi đi đâu cả",
      },
      {
        icon: RiCheckLine,
        iconClass: "text-primary",
        text: "Dùng ngay, không cần đăng ký tài khoản",
      },
      {
        icon: RiVolumeUpLine,
        iconClass: "text-primary",
        text: "Kết quả được đọc to bằng giọng nói tiếng Việt",
      },
    ],
  },
  {
    icon: RiFileListLine,
    badge: "Bước 1",
    title: "Thêm đơn thuốc",
    description:
      "Chỉ cần chụp ảnh tờ đơn thuốc của bác sĩ, hệ thống sẽ tự đọc và điền thông tin.",
    details: [
      {
        icon: RiCameraLine,
        iconClass: "text-primary",
        text: "Chụp ảnh đơn thuốc bằng điện thoại hoặc chọn ảnh có sẵn",
      },
      {
        icon: RiFileTextLine,
        iconClass: "text-primary",
        text: "Hệ thống tự đọc tên thuốc, liều lượng và buổi uống",
      },
      {
        icon: RiEditLine,
        iconClass: "text-primary",
        text: "Xem lại và sửa trước khi lưu — hoặc nhập tay nếu muốn",
      },
    ],
  },
  {
    icon: RiCameraLine,
    badge: "Bước 2",
    title: "Chụp khay thuốc",
    description:
      "Đến giờ uống thuốc, xếp thuốc ra khay rồi chụp một tấm ảnh. Chỉ vậy thôi.",
    details: [
      {
        icon: RiSunLine,
        iconClass: "text-primary",
        text: "Chụp ở nơi đủ ánh sáng, tránh bóng đổ lên khay",
      },
      {
        icon: RiLayoutGridLine,
        iconClass: "text-primary",
        text: "Đặt các viên thuốc tách rời, không chồng lên nhau",
      },
      {
        icon: RiFocus3Line,
        iconClass: "text-primary",
        text: "Giữ máy thẳng, đợi lấy nét rõ rồi mới chụp",
      },
    ],
  },
  {
    icon: RiCheckboxCircleLine,
    badge: "Bước 3",
    title: "Xem kết quả kiểm tra",
    description:
      "DOSE so sánh khay thuốc với đơn thuốc và cho biết ngay khay đã đúng hay chưa.",
    details: [
      {
        icon: RiCheckboxCircleFill,
        iconClass: "text-emerald-500",
        text: "ĐẠT — khay thuốc đúng với đơn, yên tâm uống",
      },
      {
        icon: RiCloseCircleFill,
        iconClass: "text-red-500",
        text: "KHÔNG ĐẠT — thiếu hoặc thừa thuốc, hãy kiểm tra lại khay",
      },
      {
        icon: RiErrorWarningFill,
        iconClass: "text-amber-500",
        text: "CẦN KIỂM TRA — ảnh chưa rõ, chụp lại hoặc nhờ người thân xem giúp",
      },
    ],
  },
  {
    icon: RiRocketLine,
    badge: "Sẵn sàng",
    title: "Bắt đầu thôi!",
    description:
      "Mỗi ngày chỉ cần một tấm ảnh khay thuốc, DOSE lo phần kiểm tra giúp bạn.",
    details: [
      {
        icon: RiScanLine,
        iconClass: "text-primary",
        text: "Ở trang chính, bấm nút “Kiểm tra khay thuốc hôm nay”",
      },
      {
        icon: RiQuestionLine,
        iconClass: "text-primary",
        text: "Muốn xem lại hướng dẫn, bấm nút dấu hỏi (?) ở góc trên trang chính",
      },
    ],
  },
]

export default function GuidelinePage() {
  const router = useRouter()
  const [index, setIndex] = React.useState(0)

  const slide = SLIDES[index]
  const isFirst = index === 0
  const isLast = index === SLIDES.length - 1

  function goBack() {
    if (!isFirst) setIndex(index - 1)
  }

  function goNext() {
    if (isLast) router.push("/")
    else setIndex(index + 1)
  }

  // Tap left half of the content area = back, right half = next.
  function handleTap(e: React.MouseEvent<HTMLElement>) {
    if (e.clientX < window.innerWidth / 2) goBack()
    else if (!isLast) setIndex(index + 1)
  }

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="flex items-center justify-between px-6 py-5">
        <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
          {slide.badge}
        </span>
        <button
          onClick={() => router.push("/")}
          className="text-base text-muted-foreground hover:text-foreground"
        >
          Bỏ qua
        </button>
      </header>

      <main
        onClick={handleTap}
        className="flex flex-1 cursor-pointer flex-col items-center justify-center gap-7 px-6 select-none"
      >
        <SlideArt icon={slide.icon} />

        <div className="flex max-w-sm flex-col gap-3 text-center">
          <h1 className="font-heading text-3xl font-bold tracking-tight text-balance">
            {slide.title}
          </h1>
          <p className="text-lg leading-relaxed text-muted-foreground">
            {slide.description}
          </p>
        </div>

        <div className="flex w-full max-w-sm flex-col gap-3">
          {slide.details.map((detail) => (
            <div
              key={detail.text}
              className="flex items-start gap-3 rounded-xl bg-muted/50 px-4 py-3"
            >
              <detail.icon className={cn("mt-0.5 size-5 shrink-0", detail.iconClass)} />
              <p className="text-left text-base leading-snug">{detail.text}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={(e) => {
                e.stopPropagation()
                setIndex(i)
              }}
              aria-label={`Trang ${i + 1}`}
              className={cn(
                "h-2.5 rounded-full transition-all",
                i === index ? "w-7 bg-primary" : "w-2.5 bg-muted-foreground/30",
              )}
            />
          ))}
        </div>
      </main>

      <footer className="mx-auto flex w-full max-w-sm gap-3 px-6 pb-10">
        {!isFirst && (
          <Button
            variant="outline"
            size="lg"
            className="h-14 flex-1 text-lg"
            onClick={goBack}
          >
            <RiArrowLeftLine className="size-5" />
            Quay lại
          </Button>
        )}
        <Button size="lg" className="h-14 flex-[2] text-lg" onClick={goNext}>
          {isLast ? "Bắt đầu sử dụng" : "Tiếp theo"}
          <RiArrowRightLine className="size-5" />
        </Button>
      </footer>
    </div>
  )
}

function SlideArt({ icon: Icon }: { icon: SlideIcon }) {
  return (
    <div className="relative flex size-44 items-center justify-center rounded-full bg-primary/10">
      <div className="flex size-26 items-center justify-center rounded-3xl bg-card shadow-sm ring-1 ring-foreground/10">
        <Icon className="size-12 text-primary" />
      </div>
      <div className="absolute top-1 right-3 flex size-10 items-center justify-center rounded-full bg-emerald-300">
        <RiCheckLine className="size-5 text-emerald-900" />
      </div>
      <div className="absolute bottom-3 left-1 flex size-9 items-center justify-center rounded-full bg-amber-200">
        <RiCameraLine className="size-4 text-amber-800" />
      </div>
    </div>
  )
}
