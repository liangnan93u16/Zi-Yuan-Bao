import { Bookmark, Users, Phone, Mail, MapPin, Clock, Globe } from 'lucide-react';

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

      {/* 团队介绍 */}
      <div className="bg-white rounded-xl shadow-sm p-8 mb-16">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
          <Users className="h-6 w-6 mr-2 text-primary" />
          核心团队
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="w-40 h-40 bg-gray-200 rounded-full mx-auto mb-4 overflow-hidden">
              <img 
                src="https://via.placeholder.com/160x160/e2e8f0/1a202c?text=CEO" 
                alt="CEO"
                className="w-full h-full object-cover"
              />
            </div>
            <h3 className="text-xl font-semibold text-gray-900">张明</h3>
            <p className="text-primary font-medium">创始人 & CEO</p>
            <p className="text-gray-600 mt-2">
              前Google高级工程师，拥有10年互联网产品研发经验，致力于用技术改变教育
            </p>
          </div>
          <div className="text-center">
            <div className="w-40 h-40 bg-gray-200 rounded-full mx-auto mb-4 overflow-hidden">
              <img 
                src="https://via.placeholder.com/160x160/e2e8f0/1a202c?text=CTO" 
                alt="CTO"
                className="w-full h-full object-cover"
              />
            </div>
            <h3 className="text-xl font-semibold text-gray-900">李华</h3>
            <p className="text-primary font-medium">CTO</p>
            <p className="text-gray-600 mt-2">
              前阿里巴巴技术专家，精通全栈开发与AI技术，负责平台的技术架构与创新
            </p>
          </div>
          <div className="text-center">
            <div className="w-40 h-40 bg-gray-200 rounded-full mx-auto mb-4 overflow-hidden">
              <img 
                src="https://via.placeholder.com/160x160/e2e8f0/1a202c?text=COO" 
                alt="COO"
                className="w-full h-full object-cover"
              />
            </div>
            <h3 className="text-xl font-semibold text-gray-900">王芳</h3>
            <p className="text-primary font-medium">COO</p>
            <p className="text-gray-600 mt-2">
              前腾讯教育产品总监，拥有丰富的教育行业经验，负责公司运营与合作伙伴关系
            </p>
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
          <div>
            <form className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">姓名</label>
                <input
                  type="text"
                  id="name"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                  placeholder="请输入您的姓名"
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">邮箱</label>
                <input
                  type="email"
                  id="email"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                  placeholder="请输入您的邮箱"
                />
              </div>
              <div>
                <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">留言</label>
                <textarea
                  id="message"
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                  placeholder="请输入您的留言内容"
                ></textarea>
              </div>
              <div>
                <button
                  type="submit"
                  className="w-full bg-primary hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition"
                >
                  提交留言
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}