import { Route, Router, Switch } from "wouter";
import Home from "./pages/Home";
import NotFound from "./pages/not-found";
import Resources from "./pages/Resources";
import ResourceDetail from "./pages/ResourceDetail";
import ResourceRequest from "./pages/ResourceRequest";
import About from "./pages/About";
import Membership from "./pages/Membership";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Profile from "./pages/Profile";
import UserPurchases from "./pages/UserPurchases";
import PaymentResultSimple from "./pages/PaymentResultSimple";
import PaymentSuccess from "./pages/PaymentSuccess";
import Navbar from "./components/layout/Navbar";
import Footer from "./components/layout/Footer";
import ResourceManagement from "./pages/admin/ResourceManagement";
import ResourceUpload from "./pages/admin/ResourceUpload";
import ResourceEdit from "./pages/admin/ResourceEdit";
import ResourceRequests from "./pages/admin/ResourceRequests";
import ResourceNotifications from "./pages/admin/ResourceNotifications";
import UserManagement from "./pages/admin/UserManagement";
import ReviewManagement from "./pages/admin/ReviewManagement";
import LoginLogs from "./pages/admin/LoginLogs";
import CategoryManagement from "./pages/admin/CategoryManagement";
import AuthorManagement from "./pages/admin/AuthorManagement";
import FeifeiManagement from "./pages/admin/FeifeiManagement";
import ParameterManagement from "./pages/admin/ParameterManagement";
import { AuthProvider } from "./hooks/use-auth";
import ProtectedRoute from "./components/auth/ProtectedRoute";

// 创建受保护的管理员路由组件
const AdminRoute = ({ component: Component, ...rest }: any) => (
  <Route
    {...rest}
    component={(props: any) => (
      <ProtectedRoute adminOnly={true}>
        <Component {...props} />
      </ProtectedRoute>
    )}
  />
);

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="flex flex-col min-h-screen">
          <Navbar />
          <main className="flex-grow">
            <Switch>
              <Route path="/" component={Home} />
              <Route path="/resources" component={Resources} />
              <Route path="/resources/:id" component={ResourceDetail} />
              <Route path="/resource-request" component={ResourceRequest} />
              <Route path="/about" component={About} />
              <Route path="/membership" component={Membership} />
              <Route path="/login" component={Login} />
              <Route path="/register" component={Register} />
              <Route path="/profile" component={Profile} />
              <Route path="/user/purchases" component={UserPurchases} />
              <Route path="/payment/result" component={PaymentResultSimple} />
              <Route path="/payment/success" component={PaymentSuccess} />
              
              {/* 管理员路由 - 所有/admin路径都需要管理员权限 */}
              <AdminRoute path="/admin/resources" component={ResourceManagement} />
              <AdminRoute path="/admin/resources/upload" component={ResourceUpload} />
              <AdminRoute path="/admin/resources/:id/edit" component={ResourceEdit} />
              <AdminRoute path="/admin/resource-requests" component={ResourceRequests} />
              <AdminRoute path="/admin/resource-notifications" component={ResourceNotifications} />
              <AdminRoute path="/admin/users" component={UserManagement} />
              <AdminRoute path="/admin/reviews" component={ReviewManagement} />
              <AdminRoute path="/admin/login-logs" component={LoginLogs} />
              <AdminRoute path="/admin/categories" component={CategoryManagement} />
              <AdminRoute path="/admin/authors" component={AuthorManagement} />
              <AdminRoute path="/admin/feifei" component={FeifeiManagement} />
              <AdminRoute path="/admin/parameters" component={ParameterManagement} />
              
              <Route component={NotFound} />
            </Switch>
          </main>
          <Footer />
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
