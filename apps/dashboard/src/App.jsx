import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Layout, Play, CheckCircle, Clock, ExternalLink, Loader2, AlertCircle, Plus, Image as ImageIcon, Briefcase, X, Trash2, Calendar, List, Grid } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from './lib/utils';
import CalendarView from './CalendarView';
import PostDetailModal from './PostDetailModal';

// API Configuration

// API Configuration
const API_URL = 'http://localhost:8000';
const API_KEY = import.meta.env.VITE_API_KEY;

// Configure global axios defaults
axios.defaults.baseURL = API_URL;
axios.defaults.headers.common['X-API-Key'] = API_KEY;

console.log("App Configured with API_KEY:", API_KEY ? "Present" : "Missing", "URL:", API_URL);

function App() {
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [posts, setPosts] = useState([]);

  // UI States
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(null); // id of post being processed
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null); // New: Lightbox state

  // New Campaign Form
  const [newCampaignName, setNewCampaignName] = useState("");
  const [newMasterPrompt, setNewMasterPrompt] = useState("");

  // New Post Form
  const [newPostPrompt, setNewPostPrompt] = useState("");
  const [newPostType, setNewPostType] = useState("POST");
  const [newPostCount, setNewPostCount] = useState(1);
  const [uploadedImageUrl, setUploadedImageUrl] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [useAsContent, setUseAsContent] = useState(false);

  // View State
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'calendar'
  const [selectedPostForModal, setSelectedPostForModal] = useState(null);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await axios.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setUploadedImageUrl(res.data.url);
    } catch (err) {
      console.error("Upload failed", err);
      alert("Failed to upload image");
    } finally {
      setIsUploading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  useEffect(() => {
    if (selectedCampaign) {
      fetchPosts(selectedCampaign.id);
    } else {
      setPosts([]);
    }
  }, [selectedCampaign]);

  // Polling for pending posts
  useEffect(() => {
    if (!selectedCampaign) return;

    // Check if any post is in PENDING state
    const hasPending = posts.some(p => p.status === 'PENDING');

    if (hasPending) {
      const interval = setInterval(() => {
        fetchPosts(selectedCampaign.id, true); // Silent update
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [posts, selectedCampaign]);

  const fetchCampaigns = async () => {
    try {
      const res = await axios.get('/campaigns');
      setCampaigns(res.data);
      if (res.data.length > 0 && !selectedCampaign) {
        setSelectedCampaign(res.data[0]);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to fetch campaigns");
    }
  };

  const fetchPosts = async (campaignId, silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await axios.get(`/campaigns/${campaignId}/posts`);
      setPosts(res.data);
    } catch (err) {
      console.error(err);
      if (!silent) setError("Failed to fetch posts");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const createCampaign = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post('/campaigns', {
        name: newCampaignName,
        master_prompt: newMasterPrompt
      });
      setCampaigns([res.data, ...campaigns]);
      setSelectedCampaign(res.data);
      setModalOpen(false);
      setNewCampaignName("");
      setNewMasterPrompt("");
    } catch (err) {
      setError("Failed to create campaign");
    }
  };

  const deleteCampaign = async () => {
    if (!selectedCampaign) return;
    if (!window.confirm(`Are you sure you want to delete "${selectedCampaign.name}" and all its posts?`)) return;

    try {
      await axios.delete(`/campaigns/${selectedCampaign.id}`);
      setCampaigns(prev => prev.filter(c => c.id !== selectedCampaign.id));
      setSelectedCampaign(null);
      setPosts([]);
    } catch (err) {
      console.error(err);
      alert("Failed to delete campaign");
    }
  };

  const createPost = async (e) => {
    e.preventDefault();
    if (!selectedCampaign) return;
    try {
      const res = await axios.post(`/campaigns/${selectedCampaign.id}/posts`, {
        specific_prompt: newPostPrompt,
        image_count: parseInt(newPostCount),
        type: newPostType,
        input_image_url: uploadedImageUrl,
        use_as_content: useAsContent
      });
      // Optimistically add to list
      const newPost = {
        id: res.data.id,
        campaign_id: selectedCampaign.id,
        specific_prompt: newPostPrompt,
        image_count: newPostCount,
        status: 'PENDING',
        created_at: new Date().toISOString()
      };
      setPosts([...posts, newPost]);
      setNewPostPrompt("");
      setUploadedImageUrl(null);
      setUseAsContent(false);

      // Auto trigger generation
      generatePost(newPost.id);

    } catch (err) {
      setError("Failed to create post");
    }
  };

  const generatePost = async (postId) => {
    try {
      setProcessing(postId);
      await axios.post(`/posts/${postId}/generate`);
      // Initial poll after 1s just in case it's super fast, regular polling will catch the rest
      setTimeout(() => fetchPosts(selectedCampaign.id, true), 1000);
    } catch (err) {
      console.error(err);
    } finally {
      setProcessing(null);
    }
  };

  const updatePost = async (postId, updates) => {
    try {
      await axios.patch(`/posts/${postId}`, updates);
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, ...updates } : p));
    } catch (err) {
      console.error(err);
      alert("Failed to update post");
    }
  };

  const deletePost = async (postId, e) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this post?")) return;
    try {
      await axios.delete(`/posts/${postId}`);
      setPosts(prev => prev.filter(p => p.id !== postId));
    } catch (err) {
      console.error(err);
      alert("Failed to delete post: " + (err.response?.data?.detail || err.message));
      setError("Failed to delete post");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-2 text-indigo-700 mb-6">
            <Briefcase className="w-6 h-6" />
            <span className="font-bold text-lg tracking-tight">Arkesthetics</span>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Campaign
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          <h3 className="px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Campaigns</h3>
          {campaigns.map(campaign => (
            <button
              key={campaign.id}
              onClick={() => setSelectedCampaign(campaign)}
              className={cn(
                "w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2",
                selectedCampaign?.id === campaign.id
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-gray-700 hover:bg-gray-50"
              )}
            >
              <span className="truncate">{campaign.name}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedCampaign ? (
          <>
            <header className="bg-white border-b border-gray-200 px-8 py-5 flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{selectedCampaign.name}</h1>
                <p className="text-sm text-gray-500 mt-1 max-w-3xl truncate">
                  Master Prompt: {selectedCampaign.master_prompt}
                </p>
              </div>
              <div className="flex items-center gap-4">
                {/* View Toggle */}
                <div className="flex items-center bg-gray-100 p-1 rounded-lg border border-gray-200">
                  <button
                    onClick={() => setViewMode('list')}
                    className={cn(
                      "p-1.5 rounded-md transition-all flex items-center gap-2 text-xs font-medium",
                      viewMode === 'list' ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                    )}
                  >
                    <List className="w-4 h-4" />
                    List
                  </button>
                  <button
                    onClick={() => setViewMode('calendar')}
                    className={cn(
                      "p-1.5 rounded-md transition-all flex items-center gap-2 text-xs font-medium",
                      viewMode === 'calendar' ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                    )}
                  >
                    <Calendar className="w-4 h-4" />
                    Calendar
                  </button>
                </div>

                <div className="h-6 w-px bg-gray-300"></div>

                <button
                  onClick={deleteCampaign}
                  className="text-gray-400 hover:text-red-600 transition-colors p-2 rounded-lg hover:bg-red-50"
                  title="Delete Campaign"
                >
                  <Trash2 className="w-5 h-5" />
                </button>

                <div className="text-sm bg-gray-100 px-3 py-1 rounded-full text-gray-600">
                  {posts.length} posts
                </div>
              </div>
            </header>

            <main className="flex-1 overflow-y-auto p-8">
              {/* Add Post Form - Only show in List view or if explicitly toggled (optional, for now keep in list view) */}
              {viewMode === 'list' && (
                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm mb-8">
                  <h2 className="text-sm font-medium text-gray-900 mb-4 flex items-center gap-2">
                    <Plus className="w-4 h-4 text-indigo-500" />
                    Add New Post
                  </h2>
                  <form onSubmit={createPost} className="flex flex-col gap-4">
                    <div className="flex gap-4 items-end">
                      <div className="flex-1">
                        <input
                          type="text"
                          required
                          value={newPostPrompt}
                          onChange={(e) => setNewPostPrompt(e.target.value)}
                          placeholder="e.g., Summer promotion for Botox focusing on wrinkles..."
                          className="block w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      </div>
                      <div className="w-32">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
                        <select
                          value={newPostType}
                          onChange={(e) => setNewPostType(e.target.value)}
                          className="block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                        >
                          <option value="POST">Feed Post</option>
                          <option value="STORY">Story</option>
                          <option value="REEL">Reel</option>
                        </select>
                      </div>
                      <div className="w-24">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Images</label>
                        <input
                          type="number"
                          min="1" max="4"
                          value={newPostCount}
                          onChange={(e) => setNewPostCount(e.target.value)}
                          disabled={useAsContent}
                          className={cn(
                            "block w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500",
                            useAsContent && "bg-gray-100 text-gray-400"
                          )}
                        />
                      </div>
                      <button
                        type="submit"
                        className="bg-gray-900 hover:bg-gray-800 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
                      >
                        {useAsContent ? "Add Real Post" : "Add & Generate"}
                      </button>
                    </div>

                    {/* Image Upload Field */}
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600 hover:text-indigo-600 transition-colors border border-gray-200 rounded-lg px-3 py-2 bg-gray-50">
                          <ImageIcon className="w-4 h-4" />
                          <span>{uploadedImageUrl ? "Change Reference Image" : "Upload Reference / Real Image"}</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleFileUpload}
                          />
                        </label>
                        {isUploading && <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />}
                        {uploadedImageUrl && (
                          <div className="relative group w-10 h-10 rounded overflow-hidden border border-gray-200">
                            <img src={uploadedImageUrl} alt="Reference" className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => { setUploadedImageUrl(null); setUseAsContent(false); }}
                              className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                        {uploadedImageUrl && <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Ready</span>}
                      </div>

                      {uploadedImageUrl && (
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={useAsContent}
                            onChange={(e) => setUseAsContent(e.target.checked)}
                            className="rounded text-indigo-600 focus:ring-indigo-500 border-gray-300 w-4 h-4"
                          />
                          <span className="text-xs text-gray-700 font-medium">Use this image as the post content (Skip Generation)</span>
                        </label>
                      )}
                    </div>
                  </form>
                </div>
              )}

              {viewMode === 'list' ? (
                /* Posts Grid/Table */
                <div className="space-y-6">
                  {posts.map(post => {
                    const images = typeof post.image_urls === 'string' ? JSON.parse(post.image_urls) : post.image_urls;
                    return (
                      <div key={post.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm flex flex-col md:flex-row">
                        {/* Image Section */}
                        <div className="w-full md:w-1/3 bg-gray-100 min-h-[300px] border-r border-gray-200">
                          {images && images.length > 0 ? (
                            <div className={cn(
                              "w-full h-full grid gap-1",
                              images.length === 1 ? "grid-cols-1" :
                                images.length === 2 ? "grid-cols-2" :
                                  "grid-cols-2" // 3 or 4 images
                            )}>
                              {images.map((imgUrl, idx) => (
                                <div
                                  key={idx}
                                  className="relative group overflow-hidden h-full cursor-pointer"
                                  onClick={() => setLightboxImage(imgUrl)}
                                >
                                  <img src={imgUrl} alt={`Generated ${idx}`} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                    <ExternalLink className="w-6 h-6 text-white drop-shadow-lg" />
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center p-6 h-full flex flex-col items-center justify-center">
                              {post.status === 'PENDING' ? (
                                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mx-auto" />
                              ) : (
                                <ImageIcon className="w-12 h-12 text-gray-300 mx-auto" />
                              )}
                              <p className="text-sm text-gray-500 mt-2">
                                {post.status === 'PENDING' ? `Generating ${post.image_count} visuals...` : "No image"}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Content Section */}
                        <div className="flex-1 p-6 flex flex-col">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                "px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide",
                                post.status === 'APPROVED' ? "bg-green-100 text-green-700" :
                                  post.status === 'PUBLISHED' ? "bg-blue-100 text-blue-700" :
                                    "bg-yellow-100 text-yellow-700"
                              )}>
                                {post.status}
                              </span>
                              <span className="text-xs text-gray-400">
                                {format(new Date(post.created_at), 'MMM d, h:mm a')}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 mt-2 sm:mt-0">
                              <div className="flex flex-col items-end gap-1">
                                <label className="flex items-center gap-1 text-xs text-gray-400 font-medium">
                                  <Calendar className="w-3 h-3" />
                                  <span>Scheduled For</span>
                                </label>
                                <input
                                  type="datetime-local"
                                  value={post.scheduled_at ? format(new Date(post.scheduled_at), "yyyy-MM-dd'T'HH:mm") : ""}
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      updatePost(post.id, { scheduled_at: new Date(e.target.value).toISOString() });
                                    }
                                  }}
                                  className="block w-full text-xs border border-gray-200 rounded px-2 py-1 text-gray-600 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50"
                                />
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {post.status !== 'APPROVED' && post.status !== 'PENDING' && (
                                <button className="text-indigo-600 text-sm font-medium hover:underline">
                                  Approve
                                </button>
                              )}
                              <button
                                onClick={(e) => deletePost(post.id, e)}
                                className="text-gray-400 hover:text-red-500 transition-colors p-1"
                                title="Delete Post"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          <div className="mb-4">
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Prompt</h4>
                            <p className="text-sm text-gray-800 bg-gray-50 p-3 rounded-lg border border-gray-100">
                              {post.specific_prompt}
                            </p>
                          </div>

                          <div className="flex-1">
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Caption</h4>
                            <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">
                              {post.caption || <span className="italic text-gray-400">Waiting for generation...</span>}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {posts.length === 0 && (
                    <div className="text-center py-20 bg-white rounded-xl border border-gray-200 border-dashed">
                      <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <h3 className="text-gray-900 font-medium">No posts in this campaign</h3>
                      <p className="text-gray-500 text-sm">Create your first post above to get started.</p>
                    </div>
                  )}
                </div>
              ) : (
                <CalendarView posts={posts} onPostClick={setSelectedPostForModal} />
              )}
            </main>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gray-50/50">
            <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center mb-6">
              <Briefcase className="w-8 h-8 text-indigo-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Welcome to Arkesthetics Content Engine</h2>
            <p className="text-gray-500 max-w-md mb-8">
              Select an existing campaign from the sidebar or start a new one to begin automating your content strategy.
            </p>
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white px-6 py-3 rounded-xl font-medium transition-all shadow-lg hover:shadow-xl"
            >
              <Plus className="w-5 h-5" />
              Create Your First Campaign
            </button>
          </div>
        )}

        {/* Modals */}
        {selectedPostForModal && (
          <PostDetailModal
            post={selectedPostForModal}
            onClose={() => setSelectedPostForModal(null)}
          />
        )}

        {/* Create Campaign Modal */}
        {
          modalOpen && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
                <h2 className="text-lg font-bold text-gray-900 mb-4">New Campaign</h2>
                <form onSubmit={createCampaign}>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Name</label>
                      <input
                        type="text"
                        required
                        value={newCampaignName}
                        onChange={e => setNewCampaignName(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                        placeholder="e.g., Summer Glow 2026"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Master Prompt / Strategy</label>
                      <textarea
                        required
                        value={newMasterPrompt}
                        onChange={e => setNewMasterPrompt(e.target.value)}
                        rows={4}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                        placeholder="Define the overarching goal, tone, and visual direction for this campaign..."
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 mt-6">
                    <button
                      type="button"
                      onClick={() => setModalOpen(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
                    >
                      Create Campaign
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )
        }

        {/* Lightbox Modal */}
        {
          lightboxImage && (
            <div
              className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center p-4 animate-in fade-in duration-200"
              onClick={() => setLightboxImage(null)}
            >
              <button
                onClick={() => setLightboxImage(null)}
                className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors p-2"
              >
                <X className="w-8 h-8" />
              </button>
              <img
                src={lightboxImage}
                alt="Full size preview"
                className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                onClick={(e) => e.stopPropagation()} // Prevent closing when clicking image
              />
            </div>
          )
        }

      </div >
    </div >
  );
}

export default App;
