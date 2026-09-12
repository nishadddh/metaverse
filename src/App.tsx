import { useState, useEffect } from 'react';
import type { UserProfile, Office, Room } from './types/office';
import { dbService } from './services/database';
import { Header } from './components/common/Header';
import { OrgDashboard } from './components/dashboard/OrgDashboard';
import { OfficeView } from './components/office/OfficeView';
import { OfficeBuilderView } from './components/builder/OfficeBuilderView';
import { SuperAdminPortal } from './components/admin/SuperAdminPortal';
import { AuthModal } from './components/auth/AuthModal';
import { LoginGateway } from './components/auth/LoginGateway';
import { ChatDrawer } from './components/chat/ChatDrawer';
import { MeetingModal } from './components/meeting/MeetingModal';
import { WhiteboardModal } from './components/whiteboard/WhiteboardModal';

import { logoutFromFirebase, subscribeFirebaseOffices } from './services/firebase';

export function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(dbService.getCurrentUser());
  const [offices, setOffices] = useState<Office[]>(dbService.getOfficesForUser(currentUser));
  const [selectedOffice, setSelectedOffice] = useState<Office | null>(offices[0] || null);

  const [activeView, setActiveView] = useState<'dashboard' | 'office' | 'builder' | 'superadmin'>('dashboard');

  // Modals
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isWhiteboardOpen, setIsWhiteboardOpen] = useState(false);
  const [meetingRoom, setMeetingRoom] = useState<Room | null>(null);

  // Hash-based URL Routing for standalone office tab access
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#office/')) {
        const officeId = hash.replace('#office/', '');
        const targetOffice = dbService.getOfficeById(officeId);
        if (targetOffice && dbService.isUserAllowedInOffice(currentUser, targetOffice)) {
          setSelectedOffice(targetOffice);
          setActiveView('office');
        } else {
          setActiveView('dashboard');
        }
      } else if (hash.startsWith('#builder/')) {
        const officeId = hash.replace('#builder/', '');
        const targetOffice = dbService.getOfficeById(officeId);
        if (targetOffice && dbService.isUserAllowedInOffice(currentUser, targetOffice)) {
          setSelectedOffice(targetOffice);
          setActiveView('builder');
        } else {
          setActiveView('dashboard');
        }
      } else if (hash === '#superadmin') {
        if (currentUser?.isSuperAdmin) {
          setActiveView('superadmin');
        } else {
          setActiveView('dashboard');
        }
      } else {
        setActiveView('dashboard');
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Real-time Firebase database listener: Syncs office creation, layout edits, & granted email permissions live across all browsers
  useEffect(() => {
    const unsubscribeOffices = subscribeFirebaseOffices((remoteOffices) => {
      if (remoteOffices && remoteOffices.length > 0) {
        dbService.updateOfficesFromFirebase(remoteOffices);
        const userOffices = dbService.getOfficesForUser(currentUser);
        setOffices(userOffices);
        if (selectedOffice) {
          const refreshedSelected = remoteOffices.find(o => o.id === selectedOffice.id);
          if (refreshedSelected) {
            setSelectedOffice(refreshedSelected);
          }
        }
      }
    });

    return () => {
      unsubscribeOffices();
    };
  }, [currentUser, selectedOffice?.id]);

  const refreshData = () => {
    const updatedUser = dbService.getCurrentUser();
    const updatedOffices = dbService.getOfficesForUser(updatedUser);
    setCurrentUser(updatedUser);
    setOffices(updatedOffices);

    if (selectedOffice) {
      const refreshedSelected = dbService.getOfficeById(selectedOffice.id) || updatedOffices[0] || null;
      setSelectedOffice(refreshedSelected);
    } else {
      setSelectedOffice(updatedOffices[0] || null);
    }
  };

  const handleSelectOffice = (office: Office) => {
    setSelectedOffice(office);
    setActiveView('office');
    window.location.hash = `#office/${office.id}`;
  };

  const handleOpenBuilder = (office: Office) => {
    setSelectedOffice(office);
    setActiveView('builder');
    window.location.hash = `#builder/${office.id}`;
  };

  const navigateToDashboard = () => {
    setActiveView('dashboard');
    window.location.hash = '#dashboard';
  };

  const navigateToSuperAdmin = () => {
    setActiveView('superadmin');
    window.location.hash = '#superadmin';
  };

  const handleLogout = () => {
    logoutFromFirebase();
    dbService.logout();
    setCurrentUser(null);
    window.location.hash = '';
  };

  // If no user is logged in, present mandatory Login Gateway
  if (!currentUser) {
    return (
      <LoginGateway
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          const userOffices = dbService.getOfficesForUser(user);
          setOffices(userOffices);
          if (selectedOffice) {
            const refreshed = dbService.getOfficeById(selectedOffice.id);
            setSelectedOffice(refreshed || userOffices[0] || null);
          } else {
            setSelectedOffice(userOffices[0] || null);
          }
        }}
      />
    );
  }

  const allUsers = dbService.getUsers();
  const isSelectedOfficeAllowed = selectedOffice ? dbService.isUserAllowedInOffice(currentUser, selectedOffice) : false;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col">
      {/* Show Global Header unless in Standalone Office view or Builder view */}
      {activeView === 'dashboard' && (
        <Header
          currentUser={currentUser}
          onOpenAuth={() => setIsAuthOpen(true)}
          activeView={activeView}
          onNavigateDashboard={navigateToDashboard}
          onLogout={handleLogout}
        />
      )}

      <main className="flex-1 relative">
        {activeView === 'dashboard' && (
          <OrgDashboard
            currentUser={currentUser}
            offices={offices}
            onSelectOffice={handleSelectOffice}
            onOpenBuilder={handleOpenBuilder}
            onOpenSuperAdmin={navigateToSuperAdmin}
            onRefreshData={refreshData}
          />
        )}

        {activeView === 'office' && selectedOffice && (
          isSelectedOfficeAllowed ? (
            <OfficeView
              office={selectedOffice}
              currentUser={currentUser}
              allUsers={allUsers}
              onBackToDashboard={navigateToDashboard}
              onOpenBuilder={() => handleOpenBuilder(selectedOffice)}
              onOpenChat={() => setIsChatOpen(true)}
              onOpenWhiteboard={() => setIsWhiteboardOpen(true)}
              onJoinMeeting={(room) => setMeetingRoom(room)}
            />
          ) : (
            <OrgDashboard
              currentUser={currentUser}
              offices={offices}
              onSelectOffice={handleSelectOffice}
              onOpenBuilder={handleOpenBuilder}
              onOpenSuperAdmin={navigateToSuperAdmin}
              onRefreshData={refreshData}
            />
          )
        )}

        {activeView === 'builder' && selectedOffice && (
          isSelectedOfficeAllowed ? (
            <OfficeBuilderView
              office={selectedOffice}
              onSaveSuccess={(updatedOffice) => {
                setSelectedOffice(updatedOffice);
                refreshData();
              }}
              onCancel={navigateToDashboard}
            />
          ) : (
            <OrgDashboard
              currentUser={currentUser}
              offices={offices}
              onSelectOffice={handleSelectOffice}
              onOpenBuilder={handleOpenBuilder}
              onOpenSuperAdmin={navigateToSuperAdmin}
              onRefreshData={refreshData}
            />
          )
        )}

        {activeView === 'superadmin' && (
          <SuperAdminPortal
            currentUser={currentUser}
            onBackToDashboard={navigateToDashboard}
            onRefreshData={refreshData}
          />
        )}
      </main>

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        currentUser={currentUser}
        onLoginSuccess={(u) => {
          setCurrentUser(u);
          refreshData();
        }}
        onLogout={handleLogout}
      />

      <ChatDrawer
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        currentUser={currentUser}
        officeId={selectedOffice?.id || 'default'}
        allUsers={allUsers}
      />

      {meetingRoom && (
        <MeetingModal
          isOpen={Boolean(meetingRoom)}
          onClose={() => setMeetingRoom(null)}
          room={meetingRoom}
          currentUser={currentUser}
          allUsers={allUsers}
        />
      )}

      <WhiteboardModal
        isOpen={isWhiteboardOpen}
        onClose={() => setIsWhiteboardOpen(false)}
      />
    </div>
  );
}

export default App;
