import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import "./styles/App.css";
import RoomListPage from "./pages/RoomList/RoomListPage";
import RoomCreatePage from "./pages/RoomCreate/RoomCreatePage";
import RoomLobbyPage from "./pages/RoomLobby/RoomLobbyPage";
import InvitedPage from "./pages/Invited/InvitedPage";
import { RoomProvider } from "./features/Room/RoomProvider";
import RoomsLayoutShell from "./features/Room/RoomsLayoutShell";

function App() {
  return (
    <BrowserRouter>
      <RoomProvider>
        <Routes>
          <Route element={<RoomsLayoutShell />}>
            <Route path="/" element={<Navigate to="/rooms" replace />} />
            <Route path="/rooms" element={<RoomListPage />} />
            <Route path="/rooms/create" element={<RoomCreatePage />} />
            <Route path="/rooms/:roomId" element={<RoomLobbyPage />} />
            <Route path="/invited/:roomId" element={<InvitedPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/rooms" replace />} />
        </Routes>
      </RoomProvider>
    </BrowserRouter>
  );
}

export default App;
