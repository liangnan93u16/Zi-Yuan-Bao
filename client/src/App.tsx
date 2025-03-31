import { Route, Router, Switch } from "wouter";
import Home from "./pages/Home";
import NotFound from "./pages/not-found";
import ResourceDetail from "./pages/ResourceDetail";
import Navbar from "./components/layout/Navbar";
import Footer from "./components/layout/Footer";
import ResourceManagement from "./pages/admin/ResourceManagement";
import ResourceUpload from "./pages/admin/ResourceUpload";
import UserManagement from "./pages/admin/UserManagement";
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
              <Route path="/resources/:id" component={ResourceDetail} />
              <Route path="/admin/resources" component={ResourceManagement} />
              <Route path="/admin/resources/upload" component={ResourceUpload} />
              <Route path="/admin/users" component={UserManagement} />
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
