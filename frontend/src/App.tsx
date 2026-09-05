import { Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import Roles from "./pages/Roles";
import RoleDetail from "./pages/RoleDetail";
import Candidates from "./pages/Candidates";
import CandidateDetail from "./pages/CandidateDetail";
import Calls from "./pages/Calls";
import SettingsPage from "./pages/SettingsPage";
import DigitalTwinLab from "./pages/DigitalTwinLab";
import UserManual from "./pages/UserManual";
import { AppSidebar } from "./components/app-sidebar";

export default function App() {
  return (
    <div className="flex h-screen overflow-hidden bg-[#F8F9FA] dark:bg-[#09090B] dark:text-[#FAFAFA] transition-colors duration-150">
      <AppSidebar />
      <main className="min-w-0 flex-1 h-screen overflow-y-auto px-5 py-6 sm:px-8 sm:py-8">
        <div className="w-full">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/roles" element={<Roles />} />
            <Route path="/roles/:roleId" element={<RoleDetail />} />
            <Route path="/candidates" element={<Candidates />} />
            <Route path="/candidates/:candidateId" element={<CandidateDetail />} />
            <Route path="/calls" element={<Calls />} />
            <Route path="/digital-twin" element={<DigitalTwinLab />} />
            <Route path="/user-manual" element={<UserManual />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

