import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Link } from "wouter";

export default function Footer() {
  const [email, setEmail] = useState("");

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    // Implement subscription logic here
    alert(`Thanks for subscribing with: ${email}`);
    setEmail("");
  };

  return (
    <footer className="bg-white border-t border-neutral-200 py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div>
            <h3 className="text-lg font-semibold mb-4">关于我们</h3>
            <p className="text-neutral-600 text-sm mb-4">
              资源宝是一个专注于优质学习资源分享的平台，致力于为用户提供便捷、高效的知识获取渠道。
            </p>
            <div className="flex space-x-4">
              <a href="#" className="text-neutral-600 hover:text-primary">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path>
                </svg>
              </a>
              <a href="#" className="text-neutral-600 hover:text-primary">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 4.01c-1 .49-1.98.689-3 .99-1.121-1.265-2.783-1.335-4.38-.737S11.977 6.323 12 8v1c-3.245.083-6.135-1.395-8-4 0 0-4.182 7.433 4 11-1.872 1.247-3.739 2.088-6 2 3.308 1.803 6.913 2.423 10.034 1.517 3.58-1.04 6.522-3.723 7.651-7.742a13.84 13.84 0 0 0 .497-3.753C20.18 7.773 21.692 5.25 22 4.009z"></path>
                </svg>
              </a>
              <a href="#" className="text-neutral-600 hover:text-primary">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                </svg>
              </a>
              <a href="#" className="text-neutral-600 hover:text-primary">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
                </svg>
              </a>
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold mb-4">快速链接</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/" className="text-neutral-600 hover:text-primary">首页</Link>
              </li>
              <li>
                <Link href="/resources" className="text-neutral-600 hover:text-primary">全部资源</Link>
              </li>
              <li>
                <Link href="/categories" className="text-neutral-600 hover:text-primary">热门分类</Link>
              </li>
              <li>
                <Link href="/membership" className="text-neutral-600 hover:text-primary">会员计划</Link>
              </li>
              <li>
                <Link href="/admin/resources/upload" className="text-neutral-600 hover:text-primary">资源上传</Link>
              </li>
            </ul>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold mb-4">帮助支持</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/faq" className="text-neutral-600 hover:text-primary">常见问题</Link>
              </li>
              <li>
                <Link href="/contact" className="text-neutral-600 hover:text-primary">联系我们</Link>
              </li>
              <li>
                <Link href="/feedback" className="text-neutral-600 hover:text-primary">意见反馈</Link>
              </li>
              <li>
                <Link href="/terms" className="text-neutral-600 hover:text-primary">用户协议</Link>
              </li>
              <li>
                <Link href="/privacy" className="text-neutral-600 hover:text-primary">隐私政策</Link>
              </li>
            </ul>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold mb-4">联系我们</h3>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 text-primary mt-0.5 mr-2"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                  <polyline points="22,6 12,13 2,6"></polyline>
                </svg>
                <span className="text-neutral-600">support@resourcebao.com</span>
              </li>
              <li className="flex items-start">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 text-primary mt-0.5 mr-2"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                </svg>
                <span className="text-neutral-600">工作日 9:00-18:00</span>
              </li>
              <li className="flex items-start">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 text-primary mt-0.5 mr-2"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                  <circle cx="12" cy="10" r="3"></circle>
                </svg>
                <span className="text-neutral-600">北京市海淀区中关村大街1号</span>
              </li>
            </ul>
            <div className="mt-4">
              <h4 className="font-medium text-sm mb-2">订阅我们的更新</h4>
              <form onSubmit={handleSubscribe} className="flex">
                <Input
                  type="email"
                  placeholder="输入您的邮箱"
                  className="w-full rounded-r-none"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <Button type="submit" className="rounded-l-none">
                  订阅
                </Button>
              </form>
            </div>
          </div>
        </div>
        
        <div className="border-t border-neutral-200 pt-6 text-center text-sm text-neutral-600">
          <p>© {new Date().getFullYear()} 资源宝 - 精品学习资源分享平台. 保留所有权利.</p>
        </div>
      </div>
    </footer>
  );
}
