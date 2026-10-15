import React, { useState } from 'react';
import { X, Check, Plus, Trash2, Edit2, Shield, Settings, Sparkles } from 'lucide-react';
import { UserProfile } from '../types/stream';
import { AVATAR_OPTIONS } from '../services/storageService';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profiles: UserProfile[];
  activeProfile: UserProfile;
  onSelectProfile: (id: string) => void;
  onUpdateProfile: (profile: UserProfile) => void;
  onCreateProfile: (profile: Omit<UserProfile, 'id' | 'createdAt'>) => void;
  onDeleteProfile: (id: string) => void;
  onShowToast: (text: string, type?: 'success' | 'info' | 'warning') => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  profiles,
  activeProfile,
  onSelectProfile,
  onUpdateProfile,
  onCreateProfile,
  onDeleteProfile,
  onShowToast,
}) => {
  const [editingProfile, setEditingProfile] = useState<UserProfile | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAvatar, setNewAvatar] = useState(AVATAR_OPTIONS[0]);
  const [newBio, setNewBio] = useState('');
  const [newQuality, setNewQuality] = useState<'hd' | 'auto' | 'sd'>('hd');
  const [newAutoplay, setNewAutoplay] = useState(true);

  if (!isOpen) return null;

  const handleStartEdit = (profile: UserProfile) => {
    setEditingProfile({ ...profile });
    setIsCreatingNew(false);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProfile) return;
    onUpdateProfile(editingProfile);
    onShowToast(`Updated profile "${editingProfile.name}"`, 'success');
    setEditingProfile(null);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    onCreateProfile({
      name: newName.trim(),
      avatar: newAvatar,
      bio: newBio.trim() || 'Live stream enthusiast',
      favoriteCategories: ['Live Sports', '24/7 Channels'],
      autoplay: newAutoplay,
      defaultQuality: newQuality,
      theme: 'midnight',
    });

    onShowToast(`Profile "${newName}" created and active!`, 'success');
    setIsCreatingNew(false);
    setNewName('');
    setNewBio('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-[#12151e] border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-white">Profiles & Experience</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Personalized watch history, watchlist, and multiview screen setups.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* If Editing a Profile */}
          {editingProfile ? (
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <h3 className="text-sm font-bold text-white">Edit Profile</h3>
                <button
                  type="button"
                  onClick={() => setEditingProfile(null)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-2">Select Avatar</label>
                <div className="flex items-center gap-3">
                  {AVATAR_OPTIONS.map((av, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setEditingProfile({ ...editingProfile, avatar: av })}
                      className={`relative w-12 h-12 rounded-xl overflow-hidden border-2 transition-all ${
                        editingProfile.avatar === av
                          ? 'border-blue-500 scale-105 shadow-md shadow-blue-600/30'
                          : 'border-slate-700 hover:border-slate-500 opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img src={av} alt="Avatar" className="w-full h-full object-cover" />
                      {editingProfile.avatar === av && (
                        <div className="absolute inset-0 bg-blue-600/20 flex items-center justify-center">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Display Name</label>
                <input
                  type="text"
                  value={editingProfile.name}
                  onChange={(e) => setEditingProfile({ ...editingProfile, name: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Bio / Preference</label>
                <input
                  type="text"
                  value={editingProfile.bio}
                  onChange={(e) => setEditingProfile({ ...editingProfile, bio: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Default Quality</label>
                  <select
                    value={editingProfile.defaultQuality}
                    onChange={(e) =>
                      setEditingProfile({
                        ...editingProfile,
                        defaultQuality: e.target.value as 'hd' | 'auto' | 'sd',
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="hd">1080p Full HD</option>
                    <option value="auto">Adaptive Auto</option>
                    <option value="sd">720p Balanced</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Autoplay Next</label>
                  <select
                    value={editingProfile.autoplay ? 'yes' : 'no'}
                    onChange={(e) =>
                      setEditingProfile({
                        ...editingProfile,
                        autoplay: e.target.value === 'yes',
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="yes">Enabled</option>
                    <option value="no">Disabled</option>
                  </select>
                </div>
              </div>

              {/* Notification Alert Controls */}
              <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 space-y-2.5">
                <p className="text-xs font-bold text-slate-200">Watchlist Live Alert Preferences</p>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300">Toast Alerts When Stream Goes Live</span>
                  <input
                    type="checkbox"
                    checked={editingProfile.liveAlertsEnabled !== false}
                    onChange={(e) =>
                      setEditingProfile({
                        ...editingProfile,
                        liveAlertsEnabled: e.target.checked,
                      })
                    }
                    className="accent-blue-600 w-4 h-4 rounded cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300">Audio Chime Sound</span>
                  <input
                    type="checkbox"
                    checked={editingProfile.soundAlertsEnabled !== false}
                    onChange={(e) =>
                      setEditingProfile({
                        ...editingProfile,
                        soundAlertsEnabled: e.target.checked,
                      })
                    }
                    className="accent-blue-600 w-4 h-4 rounded cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                {profiles.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => {
                      onDeleteProfile(editingProfile.id);
                      setEditingProfile(null);
                      onShowToast('Profile removed', 'info');
                    }}
                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Profile</span>
                  </button>
                ) : (
                  <div />
                )}

                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-md shadow-blue-600/30 transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </form>
          ) : isCreatingNew ? (
            /* Creating New Profile Form */
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <h3 className="text-sm font-bold text-white">Create New Profile</h3>
                <button
                  type="button"
                  onClick={() => setIsCreatingNew(false)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-2">Choose Avatar</label>
                <div className="flex items-center gap-3">
                  {AVATAR_OPTIONS.map((av, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setNewAvatar(av)}
                      className={`relative w-12 h-12 rounded-xl overflow-hidden border-2 transition-all ${
                        newAvatar === av
                          ? 'border-blue-500 scale-105 shadow-md shadow-blue-600/30'
                          : 'border-slate-700 hover:border-slate-500 opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img src={av} alt="Avatar" className="w-full h-full object-cover" />
                      {newAvatar === av && (
                        <div className="absolute inset-0 bg-blue-600/20 flex items-center justify-center">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Name</label>
                <input
                  type="text"
                  placeholder="e.g. Jordan, Living Room TV"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  autoFocus
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Description / Taste</label>
                <input
                  type="text"
                  placeholder="e.g. Sunday Football, UFC & F1 racing"
                  value={newBio}
                  onChange={(e) => setNewBio(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreatingNew(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-md shadow-blue-600/30 transition-colors"
                >
                  Create & Activate
                </button>
              </div>
            </form>
          ) : (
            /* Profiles Grid View */
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {profiles.map((p) => {
                  const isActive = p.id === activeProfile.id;
                  return (
                    <div
                      key={p.id}
                      className={`relative flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                        isActive
                          ? 'bg-slate-800/80 border-blue-500 shadow-md shadow-blue-950/20'
                          : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div
                        onClick={() => {
                          onSelectProfile(p.id);
                          onShowToast(`Switched to ${p.name}`, 'info');
                        }}
                        className="flex items-center gap-3 cursor-pointer min-w-0 flex-1"
                      >
                        <img
                          src={p.avatar}
                          alt={p.name}
                          className="w-11 h-11 rounded-lg object-cover ring-1 ring-white/10 shrink-0"
                          referrerPolicy="no-referrer"
                        />
                        <div className="truncate">
                          <p className="text-sm font-bold text-white truncate flex items-center gap-1.5">
                            <span>{p.name}</span>
                            {isActive && (
                              <span className="text-[10px] font-mono text-blue-400 uppercase tracking-wider">
                                (Active)
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-slate-400 truncate mt-0.5">{p.bio}</p>
                        </div>
                      </div>

                      <button
                        onClick={() => handleStartEdit(p)}
                        className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors shrink-0 ml-2"
                        title="Edit profile settings"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Add New Profile Trigger */}
              <button
                onClick={() => setIsCreatingNew(true)}
                className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-slate-700 hover:border-slate-500 text-slate-400 hover:text-white transition-colors text-xs font-semibold"
              >
                <Plus className="w-4 h-4" />
                <span>Add Another Profile</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
