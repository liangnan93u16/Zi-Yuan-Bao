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

// 系统预设的头像列表
const DEFAULT_AVATARS = [
  "https://api.dicebear.com/7.x/personas/svg?seed=avatar1",
  "https://api.dicebear.com/7.x/personas/svg?seed=avatar2",
  "https://api.dicebear.com/7.x/personas/svg?seed=avatar3",
  "https://api.dicebear.com/7.x/personas/svg?seed=avatar4",
  "https://api.dicebear.com/7.x/personas/svg?seed=avatar5",
  "https://api.dicebear.com/7.x/personas/svg?seed=avatar6",
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