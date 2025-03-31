import { Bookmark, Phone, Mail, MapPin, Clock, Globe } from 'lucide-react';

export default function About() {
  return (
    <div className="container mx-auto py-12 px-4 sm:px-6 lg:px-8">
      {/* 页面标题 */}
      <div className="text-center mb-16">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">关于我们</h1>
        <p className="text-lg text-gray-600 max-w-3xl mx-auto">
          我们致力于为用户提供优质的学习资源，帮助每个人实现自我提升和职业发展
        </p>
      </div>

      {/* 公司简介 */}
      <div className="bg-white rounded-xl shadow-sm p-8 mb-16">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
          <Bookmark className="h-6 w-6 mr-2 text-primary" />
          公司简介
        </h2>
        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <p className="text-gray-600 mb-4">
              学习资源平台成立于2023年，是一家专注于在线教育资源分享的创新型科技公司。我们汇集了来自全球的优质学习资源，覆盖编程开发、创意设计、商业管理、影视制作和语言学习等多个领域。
            </p>
            <p className="text-gray-600 mb-4">
              我们的使命是通过技术打破传统教育的壁垒，让每个人都能便捷地获取高质量的学习内容，提升自我，实现梦想。
            </p>
            <p className="text-gray-600">
              目前，我们已经拥有超过10,000名活跃用户和500多门精品课程，并与多家知名教育机构和行业专家保持紧密合作，不断丰富我们的资源库。
            </p>
          </div>
          <div className="bg-blue-50 rounded-lg p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">我们的价值观</h3>
            <ul className="space-y-3">
              <li className="flex items-start">
                <span className="bg-primary text-white p-1 rounded mr-3 mt-1">•</span>
                <span><strong>优质内容</strong> - 严选高质量学习资源</span>
              </li>
              <li className="flex items-start">
                <span className="bg-primary text-white p-1 rounded mr-3 mt-1">•</span>
                <span><strong>用户至上</strong> - 以用户体验为核心</span>
              </li>
              <li className="flex items-start">
                <span className="bg-primary text-white p-1 rounded mr-3 mt-1">•</span>
                <span><strong>持续创新</strong> - 不断探索教育科技新可能</span>
              </li>
              <li className="flex items-start">
                <span className="bg-primary text-white p-1 rounded mr-3 mt-1">•</span>
                <span><strong>普惠学习</strong> - 让优质教育触手可及</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* 联系我们 */}
      <div className="bg-white rounded-xl shadow-sm p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
          <Phone className="h-6 w-6 mr-2 text-primary" />
          联系我们
        </h2>
        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div className="flex items-start">
              <MapPin className="h-5 w-5 text-primary mr-3 mt-1" />
              <div>
                <h3 className="font-semibold text-gray-900">公司地址</h3>
                <p className="text-gray-600">北京市海淀区中关村科技园区8号楼 创新大厦20层</p>
              </div>
            </div>
            <div className="flex items-start">
              <Mail className="h-5 w-5 text-primary mr-3 mt-1" />
              <div>
                <h3 className="font-semibold text-gray-900">电子邮箱</h3>
                <p className="text-gray-600">contact@learning-resources.com</p>
              </div>
            </div>
            <div className="flex items-start">
              <Phone className="h-5 w-5 text-primary mr-3 mt-1" />
              <div>
                <h3 className="font-semibold text-gray-900">联系电话</h3>
                <p className="text-gray-600">400-123-4567</p>
              </div>
            </div>
            <div className="flex items-start">
              <Clock className="h-5 w-5 text-primary mr-3 mt-1" />
              <div>
                <h3 className="font-semibold text-gray-900">工作时间</h3>
                <p className="text-gray-600">周一至周五: 9:00 - 18:00</p>
              </div>
            </div>
            <div className="flex items-start">
              <Globe className="h-5 w-5 text-primary mr-3 mt-1" />
              <div>
                <h3 className="font-semibold text-gray-900">官方网站</h3>
                <p className="text-gray-600">www.learning-resources.com</p>
              </div>
            </div>
          </div>
          <div className="bg-blue-50 rounded-lg p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">关注我们</h3>
            <p className="text-gray-600 mb-4">
              欢迎通过以下社交媒体关注我们，获取最新资源和活动信息：
            </p>
            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="flex items-center space-x-3">
                <div className="bg-blue-600 text-white p-2 rounded-full">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path>
                  </svg>
                </div>
                <span className="font-medium">Facebook</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="bg-blue-400 text-white p-2 rounded-full">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"></path>
                  </svg>
                </div>
                <span className="font-medium">Twitter</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="bg-red-600 text-white p-2 rounded-full">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"></path>
                    <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"></polygon>
                  </svg>
                </div>
                <span className="font-medium">YouTube</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="bg-pink-600 text-white p-2 rounded-full">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                  </svg>
                </div>
                <span className="font-medium">Instagram</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}