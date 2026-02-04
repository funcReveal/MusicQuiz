import { Navigate, Route, Routes } from "react-router-dom";

import RoomsLayoutShell from "../features/Room/ui/RoomsLayoutShell";
import RoomListPage from "../features/Room/ui/RoomListPage";
import RoomCreatePage from "../features/Room/ui/RoomCreatePage";
import RoomLobbyPage from "../features/Room/ui/RoomLobbyPage";
import CollectionsPage from "../features/Collections/ui/CollectionsPage";
import CollectionsCreatePage from "../features/Collections/ui/CollectionsCreatePage";
import EditPage from "../features/Collections/ui/EditPage";
import InvitedPage from "../features/Invited/ui/InvitedPage";
import LegalLayout from "../features/Legal/ui/LegalLayout";
import PrivacyPage from "../features/Legal/ui/PrivacyPage";
import TermsPage from "../features/Legal/ui/TermsPage";

export function AppRouter() {
  return (
    <Routes>
      <Route element={<RoomsLayoutShell />}>
        <Route path="/" element={<Navigate to="/rooms" replace />} />
        <Route path="/rooms" element={<RoomListPage />} />
        <Route path="/rooms/create" element={<RoomCreatePage />} />
        <Route path="/rooms/:roomId" element={<RoomLobbyPage />} />
        <Route path="/invited/:roomId" element={<InvitedPage />} />
        <Route path="/collections" element={<CollectionsPage />} />
        <Route path="/collections/new" element={<CollectionsCreatePage />} />
        <Route path="/collections/:collectionId/edit" element={<EditPage />} />
      </Route>
      <Route element={<LegalLayout />}>
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/rooms" replace />} />
    </Routes>
  );
}
