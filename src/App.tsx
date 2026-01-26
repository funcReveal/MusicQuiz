import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import "./styles/App.css";
import RoomListPage from "./pages/RoomList/RoomListPage";
import RoomCreatePage from "./pages/RoomCreate/RoomCreatePage";
import RoomLobbyPage from "./pages/RoomLobby/RoomLobbyPage";
import InvitedPage from "./pages/Invited/InvitedPage";
import EditPage from "./pages/Edit/EditPage";

function App() {
  return (
    <BrowserRouter>
      <div className="flex min-h-screen bg-slate-900 text-slate-100 justify-center items-start p-4">
        <Routes>
          <Route path="/" element={<Navigate to="/rooms" replace />} />
          <Route path="/rooms" element={<RoomListPage />} />
          <Route path="/rooms/create" element={<RoomCreatePage />} />
          <Route path="/rooms/:roomId" element={<RoomLobbyPage />} />
          <Route path="/invited/:roomId" element={<InvitedPage />} />
          <Route path="/edit" element={<EditPage />} />
          <Route path="*" element={<Navigate to="/rooms" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
