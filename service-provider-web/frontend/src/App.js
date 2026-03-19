import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ProviderDashboard from "./ProviderDashboard";
import ProviderProfile from "./ProviderProfile";
import ProviderLogin from "./ProviderLogin";
import ProviderEarnings from "./ProviderEarnings";
import ProviderMessages from "./ProviderMessages";

const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem("providerToken");
  return token ? children : <Navigate to="/" />;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ProviderLogin />} />

        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <ProviderDashboard />
            </PrivateRoute>
          }
        />

        <Route
          path="/profile"
          element={
            <PrivateRoute>
              <ProviderProfile />
            </PrivateRoute>
          }
        />

        <Route
          path="/earnings"
          element={
            <PrivateRoute>
              <ProviderEarnings />
            </PrivateRoute>
          }
        />

        <Route
          path="/messages"
          element={
            <PrivateRoute>
              <ProviderMessages />
            </PrivateRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
