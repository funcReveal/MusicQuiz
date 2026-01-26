import React from "react";
import { Outlet } from "react-router-dom";
import { Snackbar } from "@mui/material";

import HeaderSection from "./components/HeaderSection";
import UsernameStep from "./components/UsernameStep";
import { useRoom } from "./useRoom";

const RoomsLayoutShell: React.FC = () => {
  const {
    displayUsername,
    isConnected,
    statusText,
    username,
    usernameInput,
    setUsernameInput,
    handleSetUsername,
  } = useRoom();

  return (
    <div className="flex min-h-screen bg-slate-900 text-slate-100 justify-center items-start p-4">
      <div className="flex flex-col w-95/100 space-y-4">
        <HeaderSection
          serverUrl={import.meta.env.VITE_SOCKET_URL}
          isConnected={isConnected}
          displayUsername={displayUsername}
        />

        {!username && (
          <UsernameStep
            usernameInput={usernameInput}
            onInputChange={setUsernameInput}
            onConfirm={handleSetUsername}
          />
        )}

        <Outlet />

        {statusText && <Snackbar message={`Status: ${statusText}`} open={true} />}
      </div>
    </div>
  );
};

export default RoomsLayoutShell;
