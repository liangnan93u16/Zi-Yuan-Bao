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
import Navbar from "./components/layout/Navbar";
import Footer from "./components/layout/Footer";
import ResourceManagement from "./pages/admin/ResourceManagement";
import ResourceUpload from "./pages/admin/ResourceUpload";
import ResourceEdit from "./pages/admin/ResourceEdit";
import ResourceRequests from "./pages/admin/ResourceRequests";
import UserManagement from "./pages/admin/UserManagement";
import ReviewManagement from "./pages/admin/ReviewManagement";
import LoginLogs from "./pages/admin/LoginLogs";
import CategoryManagement from "./pages/admin/CategoryManagement";
import AuthorManagement from "./pages/admin/AuthorManagement";
import { AuthProvider } from "./hooks/use-auth";

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
              <Route path="/admin/resources" component={ResourceManagement} />
              <Route path="/admin/resources/upload" component={ResourceUpload} />
              <Route path="/admin/resources/:id/edit" component={ResourceEdit} />
              <Route path="/admin/resource-requests" component={ResourceRequests} />
              <Route path="/admin/users" component={UserManagement} />
              <Route path="/admin/reviews" component={ReviewManagement} />
              <Route path="/admin/login-logs" component={LoginLogs} />
              <Route path="/admin/categories" component={CategoryManagement} />
              <Route path="/admin/authors" component={AuthorManagement} />
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
