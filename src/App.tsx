import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import "./styles/App.css";
import RoomListPage from "./pages/RoomList/RoomListPage";
import RoomCreatePage from "./pages/RoomCreate/RoomCreatePage";
import RoomLobbyPage from "./pages/RoomLobby/RoomLobbyPage";
import InvitedPage from "./pages/Invited/InvitedPage";
import { RoomProvider } from "./features/Room/RoomProvider";
import RoomsLayoutShell from "./features/Room/RoomsLayoutShell";
import EditPage from "./pages/Edit/EditPage";
import PrivacyPage from "./pages/Legal/PrivacyPage";
import TermsPage from "./pages/Legal/TermsPage";
import CollectionsPage from "./pages/Collections/CollectionsPage";

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
            <Route path="/collections" element={<CollectionsPage />} />
            <Route path="/collection/edit" element={<EditPage />} />
            <Route
              path="/collection/edit/:collectionId"
              element={<EditPage />}
            />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/terms" element={<TermsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/rooms" replace />} />
        </Routes>
      </RoomProvider>
    </BrowserRouter>
  );
}

export default App;
