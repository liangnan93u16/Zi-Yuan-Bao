import * as React from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

// 系统预设的头像列表 - 使用静态SVG格式，提供30个不同风格的卡通头像
// 包括不同的性别、年龄段和风格，覆盖男女老幼各种风格
const DEFAULT_AVATARS = [
  // 男性成人卡通头像 - 商务风格
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='45' fill='%234b5563' /><path d='M50,25 C40,25 35,35 35,40 C35,45 40,55 50,55 C60,55 65,45 65,40 C65,35 60,25 50,25 Z' fill='%23f3f4f6' /><path d='M30,85 C30,65 40,60 50,60 C60,60 70,65 70,85 Z' fill='%23f3f4f6' /><circle cx='42' cy='40' r='2' fill='%23000' /><circle cx='58' cy='40' r='2' fill='%23000' /></svg>",
  
  // 女性成人卡通头像 - 商务风格
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='45' fill='%23be185d' /><path d='M50,27 C38,27 30,35 30,43 C30,51 38,59 50,59 C62,59 70,51 70,43 C70,35 62,27 50,27 Z' fill='%23fbcfe8' /><path d='M30,90 C30,70 40,65 50,65 C60,65 70,70 70,90 Z' fill='%23fbcfe8' /><circle cx='43' cy='42' r='2' fill='%23000' /><circle cx='57' cy='42' r='2' fill='%23000' /><path d='M50,50 Q55,52 50,54 Q45,52 50,50' fill='%23881337' /></svg>",
  
  // 老年男性卡通头像
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='45' fill='%23475569' /><path d='M30,33 C30,20 40,15 50,15 C60,15 70,20 70,33 L70,35 C70,40 65,43 65,43 L35,43 C35,43 30,40 30,35 Z' fill='%23e2e8f0' /><path d='M30,85 C30,65 40,60 50,60 C60,60 70,65 70,85 Z' fill='%23cbd5e1' /><circle cx='42' cy='40' r='2' fill='%23000' /><circle cx='58' cy='40' r='2' fill='%23000' /><path d='M42,32 C42,32 46,28 50,28 C54,28 58,32 58,32' fill='none' stroke='%23e2e8f0' stroke-width='2' /></svg>",
  
  // 老年女性卡通头像
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='45' fill='%23a855f7' /><path d='M50,25 C38,25 30,33 30,45 L30,50 L70,50 L70,45 C70,33 62,25 50,25 Z' fill='%23e9d5ff' /><path d='M30,85 C30,65 40,60 50,60 C60,60 70,65 70,85 Z' fill='%23e9d5ff' /><circle cx='42' cy='40' r='2' fill='%23000' /><circle cx='58' cy='40' r='2' fill='%23000' /><path d='M50,50 Q55,52 50,54 Q45,52 50,50' fill='%239333ea' /></svg>",
  
  // 男孩卡通头像
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='45' fill='%232563eb' /><path d='M50,25 C40,25 35,32 35,40 C35,48 40,55 50,55 C60,55 65,48 65,40 C65,32 60,25 50,25 Z' fill='%23dbeafe' /><path d='M35,85 C35,65 40,60 50,60 C60,60 65,65 65,85 Z' fill='%23dbeafe' /><circle cx='42' cy='40' r='2' fill='%23000' /><circle cx='58' cy='40' r='2' fill='%23000' /><path d='M50,48 Q54,50 50,52 Q46,50 50,48' fill='%231e40af' /></svg>",
  
  // 女孩卡通头像
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='45' fill='%23ec4899' /><path d='M50,22 C37,22 28,30 28,43 C28,56 37,64 50,64 C63,64 72,56 72,43 C72,30 63,22 50,22 Z' fill='%23fce7f3' /><path d='M35,85 C35,65 42,60 50,60 C58,60 65,65 65,85 Z' fill='%23fce7f3' /><circle cx='42' cy='40' r='2' fill='%23000' /><circle cx='58' cy='40' r='2' fill='%23000' /><path d='M50,48 Q55,51 50,54 Q45,51 50,48' fill='%23db2777' /></svg>",
  
  // 科技风男性头像
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='45' fill='%2303071e' /><path d='M30,40 L40,30 L60,30 L70,40 L70,60 L60,70 L40,70 L30,60 Z' fill='%233a86ff' /><rect x='45' y='40' width='10' height='10' fill='%23fff' /><rect x='48' y='50' width='4' height='15' fill='%23fff' /><rect x='40' y='54' width='20' height='4' fill='%23fff' /></svg>",
  
  // 科技风女性头像
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='45' fill='%23370617' /><path d='M35,30 C35,30 50,15 65,30 C65,30 75,50 65,70 C65,70 50,85 35,70 C35,70 25,50 35,30 Z' fill='%23f72585' /><circle cx='42' cy='40' r='3' fill='%23fff' /><circle cx='58' cy='40' r='3' fill='%23fff' /><path d='M42,60 C42,60 50,65 58,60' fill='none' stroke='%23fff' stroke-width='2' /></svg>",
  
  // 动漫风格男性
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='45' fill='%23312e81' /><path d='M30,30 L45,20 L55,20 L70,30 L70,40 L60,60 L40,60 L30,40 Z' fill='%23fef3c7' /><polygon points='30,40 40,60 30,85 25,60' fill='%23fef3c7' /><polygon points='70,40 60,60 70,85 75,60' fill='%23fef3c7' /><path d='M40,35 L45,30 L55,30 L60,35 L55,40 L45,40 Z' fill='%23fff' /><line x1='45' y1='35' x2='47' y2='35' stroke='%23000' stroke-width='1' /><line x1='53' y1='35' x2='55' y2='35' stroke='%23000' stroke-width='1' /></svg>",
  
  // 动漫风格女性
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='45' fill='%23fca5a5' /><path d='M25,40 L30,25 L70,25 L75,40 L65,60 L35,60 Z' fill='%23fef3c7' /><path d='M35,60 L30,90 L50,70 L70,90 L65,60' fill='%23fef3c7' /><path d='M40,38 L45,35 L55,35 L60,38 L55,45 L45,45 Z' fill='%23fff' /><circle cx='45' cy='40' r='1' fill='%23000' /><circle cx='55' cy='40' r='1' fill='%23000' /><path d='M48,45 Q50,47 52,45' fill='none' stroke='%23000' stroke-width='1' /></svg>",
  
  // 职业装男性
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='45' fill='%23334155' /><rect x='35' y='50' width='30' height='40' fill='%23f8fafc' /><path d='M35,50 L35,45 C35,35 40,30 50,30 C60,30 65,35 65,45 L65,50 Z' fill='%23f8fafc' /><rect x='45' y='50' width='10' height='40' fill='%231e293b' /><circle cx='43' cy='40' r='2' fill='%23000' /><circle cx='57' cy='40' r='2' fill='%23000' /></svg>",
  
  // 职业装女性
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='45' fill='%23be185d' /><path d='M35,45 C35,35 40,25 50,25 C60,25 65,35 65,45 L65,55 L35,55 Z' fill='%23fbcfe8' /><path d='M35,55 L40,100 L60,100 L65,55' fill='%23f9a8d4' /><circle cx='43' cy='40' r='2' fill='%23000' /><circle cx='57' cy='40' r='2' fill='%23000' /><path d='M50,50 Q54,52 50,54 Q46,52 50,50' fill='%23831843' /></svg>",
  
  // 太空风格
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='45' fill='%23020617' /><circle cx='50' cy='50' r='35' fill='%231e3a8a' /><circle cx='40' cy='40' r='10' fill='%23172554' /><circle cx='60' cy='60' r='15' fill='%232563eb' /><circle cx='45' cy='35' r='2' fill='%23fff' /><circle cx='55' cy='30' r='1' fill='%23fff' /><circle cx='65' cy='40' r='1.5' fill='%23fff' /><circle cx='30' cy='55' r='1' fill='%23fff' /><circle cx='35' cy='65' r='2' fill='%23fff' /></svg>",
  
  // 机器人风格
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='45' fill='%23374151' /><rect x='35' y='35' width='30' height='30' rx='5' fill='%236b7280' /><rect x='40' y='65' width='5' height='10' fill='%236b7280' /><rect x='55' y='65' width='5' height='10' fill='%236b7280' /><rect x='40' y='25' width='20' height='10' rx='2' fill='%236b7280' /><circle cx='43' cy='45' r='3' fill='%2310b981' /><circle cx='57' cy='45' r='3' fill='%2310b981' /><rect x='40' y='55' width='20' height='3' fill='%2310b981' /></svg>",
  
  // 超级英雄风格
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='45' fill='%23b91c1c' /><path d='M35,40 C35,30 40,25 50,25 C60,25 65,30 65,40 L65,55 L35,55 Z' fill='%23fecaca' /><rect x='35' y='40' width='30' height='5' fill='%23000' /><path d='M35,55 L40,90 L60,90 L65,55' fill='%23fecaca' /><circle cx='43' cy='35' r='2' fill='%23fff' /><circle cx='57' cy='35' r='2' fill='%23fff' /><path d='M40,60 L40,90 L60,90 L60,60 L50,70 Z' fill='%23b91c1c' /></svg>",
  
  // 童话风格公主
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='45' fill='%23fef3c7' /><polygon points='50,20 40,40 60,40' fill='%23fef3c7' /><path d='M35,40 C35,30 40,25 50,25 C60,25 65,30 65,40 L65,50 L35,50 Z' fill='%23fef3c7' /><path d='M35,50 L35,90 L65,90 L65,50' fill='%23fda4af' /><circle cx='43' cy='35' r='2' fill='%23000' /><circle cx='57' cy='35' r='2' fill='%23000' /><path d='M50,42 Q54,44 50,46 Q46,44 50,42' fill='%23f43f5e' /><polygon points='35,20 40,15 60,15 65,20 65,25 35,25' fill='%23fcd34d' /></svg>",
  
  // 童话风格王子
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='45' fill='%230c4a6e' /><path d='M35,40 C35,30 40,25 50,25 C60,25 65,30 65,40 L65,50 L35,50 Z' fill='%23f8fafc' /><path d='M35,50 L35,90 L65,90 L65,50' fill='%230c4a6e' /><circle cx='43' cy='35' r='2' fill='%23000' /><circle cx='57' cy='35' r='2' fill='%23000' /><path d='M40,50 L40,75 L60,75 L60,50' fill='%23f8fafc' /><polygon points='35,20 40,15 60,15 65,20 65,25 35,25' fill='%23fcd34d' /></svg>",
  
  // 熊猫风格
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='45' fill='%23fff' /><circle cx='50' cy='50' r='40' fill='%23fff' /><circle cx='35' cy='35' r='10' fill='%23000' /><circle cx='65' cy='35' r='10' fill='%23000' /><ellipse cx='50' cy='60' rx='15' ry='10' fill='%23000' /><circle cx='35' cy='35' r='2' fill='%23fff' /><circle cx='65' cy='35' r='2' fill='%23fff' /><ellipse cx='50' cy='50' rx='20' ry='15' fill='%23000' /><circle cx='50' cy='50' r='10' fill='%23fff' /></svg>",
  
  // 猫咪风格
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='45' fill='%23fef3c7' /><polygon points='30,35 25,20 40,30' fill='%23fef3c7' /><polygon points='70,35 75,20 60,30' fill='%23fef3c7' /><circle cx='50' cy='50' r='25' fill='%23fef3c7' /><ellipse cx='40' cy='45' rx='5' ry='7' fill='%23fff' /><ellipse cx='60' cy='45' rx='5' ry='7' fill='%23fff' /><circle cx='40' cy='45' r='2' fill='%23000' /><circle cx='60' cy='45' r='2' fill='%23000' /><ellipse cx='50' cy='55' rx='3' ry='2' fill='%23fb7185' /><path d='M45,50 L35,45 M55,50 L65,45' fill='none' stroke='%23000' stroke-width='1' /></svg>",
  
  // 狐狸风格
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='45' fill='%23fdba74' /><polygon points='25,40 20,20 40,30' fill='%23fdba74' /><polygon points='75,40 80,20 60,30' fill='%23fdba74' /><polygon points='30,45 50,70 70,45' fill='%23fff' /><circle cx='40' cy='40' r='5' fill='%23fff' /><circle cx='60' cy='40' r='5' fill='%23fff' /><circle cx='40' cy='40' r='2' fill='%23000' /><circle cx='60' cy='40' r='2' fill='%23000' /><polygon points='50,50 45,60 55,60' fill='%23000' /></svg>",
  
  // 书呆子风格
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='45' fill='%23fef3c7' /><path d='M35,40 C35,30 40,25 50,25 C60,25 65,30 65,40 L65,50 L35,50 Z' fill='%23fef3c7' /><rect x='35' y='35' width='30' height='5' fill='%23000' /><circle cx='43' cy='37.5' r='3' fill='%23fff' /><circle cx='57' cy='37.5' r='3' fill='%23fff' /><path d='M43,50 C43,50 50,55 57,50' fill='none' stroke='%23000' stroke-width='1' /><path d='M35,50 L35,90 L65,90 L65,50' fill='%23fef3c7' /></svg>",
  
  // 浪漫风格
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='45' fill='%23fecdd3' /><path d='M25,40 C25,20 35,15 50,15 C65,15 75,20 75,40 L75,50 L25,50 Z' fill='%23fda4af' /><path d='M25,50 L30,100 L70,100 L75,50' fill='%23fecdd3' /><circle cx='40' cy='35' r='3' fill='%23fff' /><circle cx='60' cy='35' r='3' fill='%23fff' /><circle cx='40' cy='35' r='1' fill='%23000' /><circle cx='60' cy='35' r='1' fill='%23000' /><path d='M45,45 Q50,50 55,45' fill='none' stroke='%23f43f5e' stroke-width='2' /></svg>",
  
  // 艺术家风格
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='45' fill='%23a78bfa' /><path d='M30,35 C30,20 40,15 50,15 C60,15 70,20 70,35 L70,50 L30,50 Z' fill='%23ede9fe' /><path d='M30,50 L30,90 L70,90 L70,50' fill='%23c4b5fd' /><circle cx='40' cy='35' r='3' fill='%237c3aed' /><circle cx='60' cy='35' r='3' fill='%237c3aed' /><path d='M40,45 Q50,48 60,45' fill='none' stroke='%237c3aed' stroke-width='2' /><path d='M25,35 L30,15 M75,35 L70,15' fill='none' stroke='%23a78bfa' stroke-width='2' /></svg>",
  
  // 厨师风格
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='45' fill='%23fff' /><path d='M30,35 C30,25 40,20 50,20 C60,20 70,25 70,35 L70,50 L30,50 Z' fill='%23f8fafc' /><path d='M30,50 L30,90 L70,90 L70,50' fill='%23e2e8f0' /><circle cx='40' cy='35' r='2' fill='%23000' /><circle cx='60' cy='35' r='2' fill='%23000' /><path d='M45,42 Q50,44 55,42' fill='none' stroke='%23000' stroke-width='1' /><path d='M30,20 Q50,10 70,20 L70,30 Q50,20 30,30 Z' fill='%23f8fafc' /></svg>",
  
  // 运动员风格
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='45' fill='%23fcd34d' /><path d='M30,40 C30,30 40,25 50,25 C60,25 70,30 70,40 L70,45 L30,45 Z' fill='%23fef3c7' /><path d='M30,45 L30,90 L70,90 L70,45' fill='%23fcd34d' /><circle cx='40' cy='35' r='2' fill='%23000' /><circle cx='60' cy='35' r='2' fill='%23000' /><path d='M40,42 Q50,45 60,42' fill='none' stroke='%23000' stroke-width='1' /><rect x='30' y='45' width='40' height='5' fill='%23000' /></svg>",
  
  // 科学家风格
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='45' fill='%2322d3ee' /><path d='M30,40 C30,30 40,25 50,25 C60,25 70,30 70,40 L70,50 L30,50 Z' fill='%23ecfeff' /><path d='M30,50 L30,90 L70,90 L70,50' fill='%23e0f2fe' /><circle cx='42' cy='38' r='4' fill='%23fff' /><circle cx='58' cy='38' r='4' fill='%23fff' /><circle cx='42' cy='38' r='2' fill='%23000' /><circle cx='58' cy='38' r='2' fill='%23000' /><path d='M45,45 L55,45' fill='none' stroke='%23000' stroke-width='1' /><path d='M35,30 Q50,20 65,30' fill='none' stroke='%2322d3ee' stroke-width='2' /></svg>",
  
  // 音乐家风格
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='45' fill='%23f43f5e' /><path d='M30,40 C30,30 40,25 50,25 C60,25 70,30 70,40 L70,50 L30,50 Z' fill='%23fee2e2' /><path d='M30,50 L30,90 L70,90 L70,50' fill='%23fecdd3' /><circle cx='40' cy='35' r='2' fill='%23000' /><circle cx='60' cy='35' r='2' fill='%23000' /><path d='M40,45 Q50,48 60,45' fill='none' stroke='%23000' stroke-width='1' /><path d='M75,25 L80,20 L80,50 L75,55 L75,25' fill='%23000' /><circle cx='70' cy='55' r='5' fill='%23000' /></svg>",
  
  // 医生风格
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='45' fill='%23fff' /><path d='M30,40 C30,30 40,25 50,25 C60,25 70,30 70,40 L70,50 L30,50 Z' fill='%23f8fafc' /><path d='M30,50 L30,90 L70,90 L70,50' fill='%23e0f2fe' /><circle cx='40' cy='35' r='2' fill='%23000' /><circle cx='60' cy='35' r='2' fill='%23000' /><path d='M45,45 L55,45' fill='none' stroke='%23000' stroke-width='1' /><path d='M40,60 L60,60 L60,75 L40,75 Z' fill='%23fff' /><path d='M48,65 L52,65 M50,63 L50,67' fill='none' stroke='%23f43f5e' stroke-width='1' /></svg>",
  
  // 太空人风格
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='45' fill='%23000' /><circle cx='50' cy='40' r='25' fill='%23f8fafc' /><circle cx='40' cy='35' r='5' fill='%2393c5fd' /><circle cx='60' cy='35' r='5' fill='%2393c5fd' /><path d='M30,40 C30,60 40,70 50,70 C60,70 70,60 70,40' fill='%23f8fafc' /><path d='M40,35 L45,40 L35,40 Z' fill='%23000' /><path d='M60,35 L65,40 L55,40 Z' fill='%23000' /><path d='M40,55 Q50,60 60,55' fill='none' stroke='%23000' stroke-width='1' /></svg>",
  
  // 海盗风格
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='45' fill='%23422006' /><path d='M30,40 C30,30 40,25 50,25 C60,25 70,30 70,40 L70,50 L30,50 Z' fill='%23fef3c7' /><path d='M30,50 L30,90 L70,90 L70,50' fill='%23422006' /><rect x='35' y='30' width='30' height='10' fill='%23000' /><circle cx='40' cy='40' r='2' fill='%23000' /><circle cx='60' cy='40' r='2' fill='%23000' /><path d='M45,45 L55,45' fill='none' stroke='%23000' stroke-width='1' /><rect x='40' y='30' width='20' height='5' fill='%23fef3c7' /><rect x='40' y='35' width='20' height='5' fill='%23fef3c7' /></svg>",
  
  // 农夫风格
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='45' fill='%2365a30d' /><path d='M30,40 C30,30 40,25 50,25 C60,25 70,30 70,40 L70,50 L30,50 Z' fill='%23fef9c3' /><path d='M30,50 L30,90 L70,90 L70,50' fill='%2365a30d' /><circle cx='40' cy='35' r='2' fill='%23000' /><circle cx='60' cy='35' r='2' fill='%23000' /><path d='M40,45 Q50,48 60,45' fill='none' stroke='%23000' stroke-width='1' /><path d='M25,30 L75,30 L70,20 L30,20 Z' fill='%23fef9c3' /></svg>",
  
  // 僵尸风格
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='45' fill='%2365a30d' /><path d='M30,40 C30,30 40,25 50,25 C60,25 70,30 70,40 L70,50 L30,50 Z' fill='%2365a30d' /><path d='M30,50 L30,90 L70,90 L70,50' fill='%2365a30d' /><line x1='35' y1='35' x2='45' y2='35' stroke='%23000' stroke-width='2' /><line x1='55' y1='35' x2='65' y2='35' stroke='%23000' stroke-width='2' /><path d='M40,45 Q50,42 60,45' fill='none' stroke='%23000' stroke-width='1' /><path d='M35,30 L40,20 M65,30 L60,20' fill='none' stroke='%2365a30d' stroke-width='2' /></svg>",
];

interface AvatarSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (avatarUrl: string) => void;
  currentAvatar?: string;
}

export function AvatarSelector({ 
  open, 
  onOpenChange, 
  onSelect,
  currentAvatar
}: AvatarSelectorProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>选择头像</DialogTitle>
          <DialogDescription>
            从以下预设头像中选择一个作为您的个人头像
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-5 gap-3 py-4 max-h-[400px] overflow-y-auto pr-2">
          {DEFAULT_AVATARS.map((avatar, index) => (
            <div 
              key={index} 
              className={`
                flex flex-col items-center p-2 rounded-lg cursor-pointer transition-all
                ${currentAvatar === avatar ? 'bg-primary/10 ring-2 ring-primary' : 'hover:bg-neutral-100'}
              `}
              onClick={() => onSelect(avatar)}
            >
              <Avatar className="h-12 w-12 mb-1">
                <AvatarImage src={avatar} alt={`头像 ${index + 1}`} />
                <AvatarFallback>{index + 1}</AvatarFallback>
              </Avatar>
              <span className="text-xs text-neutral-600 text-center truncate w-full">头像 {index + 1}</span>
            </div>
          ))}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}