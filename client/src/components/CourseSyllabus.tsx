import { useState } from "react";
import { ChevronDown, ChevronRight, Play, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Lecture {
  title: string;
  duration: string;
  preview?: boolean; // 是否可预览
}

interface Chapter {
  title: string;
  duration: string;
  lectures: Lecture[];
}

interface CourseContentsProps {
  contentsJson: string;
}

const CourseSyllabus = ({ contentsJson }: CourseContentsProps) => {
  // 存储每个章节的展开状态
  const [expandedChapters, setExpandedChapters] = useState<Record<number, boolean>>({});
  // 存储是否展开所有章节
  const [showAllChapters, setShowAllChapters] = useState(false);

  // 尝试解析 JSON
  let chaptersData: { chapters: Chapter[] } = { chapters: [] };
  
  try {
    if (contentsJson) {
      chaptersData = typeof contentsJson === 'string' 
        ? JSON.parse(contentsJson) 
        : contentsJson;
    }
  } catch (error) {
    console.error("解析课程内容时出错:", error);
    return (
      <div className="p-4 bg-red-50 text-red-600 rounded-md">
        课程内容格式有误，无法正确显示。
      </div>
    );
  }

  const { chapters } = chaptersData;
  
  if (!chapters || !Array.isArray(chapters) || chapters.length === 0) {
    return (
      <div className="p-4 bg-neutral-50 text-neutral-500 rounded-md">
        暂无课程内容信息
      </div>
    );
  }

  // 计算课程总计信息
  const totalChapters = chapters.length;
  const totalLectures = chapters.reduce((total, chapter) => 
    total + (chapter.lectures?.length || 0), 0);
  
  // 将时间格式化为分钟数
  const parseTimeToMinutes = (timeStr: string): number => {
    if (!timeStr) return 0;
    
    // 处理"XX 分钟"格式
    if (timeStr.includes('分钟')) {
      return parseInt(timeStr.replace(/[^0-9]/g, '')) || 0;
    }
    
    // 处理"XX 小时 YY 分钟"格式
    if (timeStr.includes('小时')) {
      const hours = parseInt(timeStr.match(/(\d+)\s*小时/)?.[1] || '0');
      const minutes = parseInt(timeStr.match(/(\d+)\s*分钟/)?.[1] || '0');
      return hours * 60 + minutes;
    }
    
    // 处理 "MM:SS" 格式
    if (timeStr.includes(':')) {
      const [minutes, seconds] = timeStr.split(':').map(part => parseInt(part) || 0);
      return minutes + (seconds > 0 ? 1 : 0); // 如果有秒数，向上取整到分钟
    }
    
    return 0;
  };
  
  // 计算总时长（分钟）
  const totalDurationMinutes = chapters.reduce((total, chapter) => {
    // 如果章节有总时长，直接使用
    if (chapter.duration) {
      return total + parseTimeToMinutes(chapter.duration);
    }
    
    // 否则计算该章节所有讲座的总时长
    return total + (chapter.lectures || []).reduce(
      (chapterTotal, lecture) => chapterTotal + parseTimeToMinutes(lecture.duration), 0
    );
  }, 0);
  
  // 格式化总时长为"X小时Y分钟"
  const formatTotalDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (hours > 0 && remainingMinutes > 0) {
      return `${hours} 小时 ${remainingMinutes} 分钟`;
    } else if (hours > 0) {
      return `${hours} 小时`;
    } else {
      return `${remainingMinutes} 分钟`;
    }
  };

  // 切换章节展开/折叠状态
  const toggleChapter = (index: number) => {
    setExpandedChapters(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  // 切换所有章节的展开/折叠状态
  const toggleAllChapters = () => {
    setShowAllChapters(!showAllChapters);
  };

  return (
    <div className="course-syllabus">
      {/* 课程总览信息 */}
      <div className="text-sm text-neutral-600 mb-4">
        {totalChapters} 个章节 · {totalLectures} 个讲座 · 总时长 {formatTotalDuration(totalDurationMinutes)}
      </div>
      
      {/* 展开/折叠所有章节按钮 */}
      <div className="flex justify-end mb-3">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={toggleAllChapters} 
          className="text-primary"
        >
          {showAllChapters ? "折叠所有章节" : "展开所有章节"}
        </Button>
      </div>

      {/* 章节列表 */}
      <div className="space-y-3">
        {chapters.map((chapter, chapterIndex) => {
          // 计算本章节的讲座数量和总时长
          const lectureCount = chapter.lectures?.length || 0;
          const chapterDuration = chapter.duration
            ? parseTimeToMinutes(chapter.duration)
            : (chapter.lectures || []).reduce(
                (total, lecture) => total + parseTimeToMinutes(lecture.duration), 0
              );
          
          // 确定章节是否展开
          const isExpanded = showAllChapters || expandedChapters[chapterIndex];
          
          return (
            <div key={chapterIndex} className="border border-neutral-200 rounded-md overflow-hidden">
              {/* 章节标题栏 */}
              <button
                className="w-full flex items-center justify-between p-4 bg-neutral-50 hover:bg-neutral-100 transition-colors text-left"
                onClick={() => toggleChapter(chapterIndex)}
              >
                <div className="flex items-center">
                  {isExpanded ? (
                    <ChevronDown className="h-5 w-5 text-neutral-500 mr-2" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-neutral-500 mr-2" />
                  )}
                  <span className="font-medium">{chapter.title}</span>
                </div>
                <div className="text-sm text-neutral-500">
                  {lectureCount} 个讲座 · {formatTotalDuration(chapterDuration)}
                </div>
              </button>
              
              {/* 讲座列表（展开时显示） */}
              {isExpanded && (
                <ul className="divide-y divide-neutral-100">
                  {chapter.lectures?.map((lecture, lectureIndex) => (
                    <li key={lectureIndex} className="flex items-center justify-between p-4 hover:bg-neutral-50">
                      <div className="flex items-center">
                        <Play className="h-4 w-4 text-neutral-400 mr-3" />
                        
                        {/* 标题可能带有预览标记 */}
                        <div className="flex items-center">
                          {lecture.preview ? (
                            <a href="#" className="text-primary hover:underline">
                              {lecture.title}
                            </a>
                          ) : (
                            <span>{lecture.title}</span>
                          )}
                          
                          {lecture.preview && (
                            <Badge className="ml-2 bg-primary/10 text-primary border-0 text-xs">
                              预览
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center">
                        {lecture.preview && (
                          <Button variant="ghost" size="sm" className="mr-2 h-7 px-2">
                            预览
                          </Button>
                        )}
                        <span className="text-sm text-neutral-500 flex items-center">
                          <Clock className="h-3.5 w-3.5 mr-1" />
                          {lecture.duration}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CourseSyllabus;