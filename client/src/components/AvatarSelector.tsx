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

// 系统预设的头像列表 - 使用静态SVG格式
const DEFAULT_AVATARS = [
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='40' fill='%234f46e5' /><text x='50' y='65' font-size='40' text-anchor='middle' fill='white'>1</text></svg>",
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='40' fill='%23f59e0b' /><text x='50' y='65' font-size='40' text-anchor='middle' fill='white'>2</text></svg>",
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='40' fill='%2310b981' /><text x='50' y='65' font-size='40' text-anchor='middle' fill='white'>3</text></svg>",
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='40' fill='%23ef4444' /><text x='50' y='65' font-size='40' text-anchor='middle' fill='white'>4</text></svg>",
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='40' fill='%238b5cf6' /><text x='50' y='65' font-size='40' text-anchor='middle' fill='white'>5</text></svg>",
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='40' fill='%23ec4899' /><text x='50' y='65' font-size='40' text-anchor='middle' fill='white'>6</text></svg>",
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>选择头像</DialogTitle>
          <DialogDescription>
            从以下预设头像中选择一个作为您的个人头像
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-3 gap-4 py-4">
          {DEFAULT_AVATARS.map((avatar, index) => (
            <div 
              key={index} 
              className={`
                flex flex-col items-center p-2 rounded-lg cursor-pointer transition-all
                ${currentAvatar === avatar ? 'bg-primary/10 ring-2 ring-primary' : 'hover:bg-neutral-100'}
              `}
              onClick={() => onSelect(avatar)}
            >
              <Avatar className="h-16 w-16 mb-2">
                <AvatarImage src={avatar} alt={`Avatar ${index + 1}`} />
                <AvatarFallback>{index + 1}</AvatarFallback>
              </Avatar>
              <span className="text-sm text-neutral-600">头像 {index + 1}</span>
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