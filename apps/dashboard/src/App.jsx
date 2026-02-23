import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Layout, Play, CheckCircle, Clock, ExternalLink, Loader2, AlertCircle, Plus, Image as ImageIcon, Briefcase, X, Trash2, Calendar, List, Grid, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from './lib/utils';
import CalendarView from './CalendarView';
import PostDetailModal from './PostDetailModal';

// API Configuration
const API_URL = 'http://localhost:8000';
const API_KEY = import.meta.env.VITE_API_KEY;

// Configure global axios defaults
axios.defaults.baseURL = API_URL;
axios.defaults.headers.common['X-API-Key'] = API_KEY;

// --- Brand Management Component ---
function BrandManager({ onBack }) {
  const [url, setUrl] = useState("");
  const [brandContext, setBrandContext] = useState(""); // New: Text context
  const [logoUrl, setLogoUrl] = useState(null); // New: Logo URL
  const [isUploadingLogo, setIsUploadingLogo] = useState(false); // New: Logo upload state

  const [loading, setLoading] = useState(false);
  const [generatedDNA, setGeneratedDNA] = useState(null);
  const [brandName, setBrandName] = useState("");
  const [brands, setBrands] = useState([]);

  useEffect(() => {
    fetchBrands();
  }, []);

  const fetchBrands = async () => {
    try {
      const res = await axios.get("/brands");
      setBrands(res.data);
    } catch (e) {
      console.error("Failed to fetch brands", e);
    }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploadingLogo(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await axios.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setLogoUrl(res.data.url);
    } catch (err) {
      console.error("Logo upload failed", err);
      alert("Failed to upload logo");
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const generateDNA = async () => {
    if (!url && !brandContext && !logoUrl) {
      alert("Please provide at least a URL, a description, or a logo.");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        url: url || undefined,
        brand_context: brandContext || undefined,
        logo_url: logoUrl || undefined
      };

      const res = await axios.post("/brands/generate", payload);
      setGeneratedDNA(res.data);
      if (res.data.brand_name && res.data.brand_name !== 'Unknown') {
        setBrandName(res.data.brand_name);
      }
    } catch (e) {
      console.error(e);
      alert("Failed to generate DNA: " + (e.response?.data?.detail || e.message));
    } finally {
      setLoading(false);
    }
  };

  const saveBrand = async () => {
    try {
      await axios.post("/brands", {
        name: brandName,
        website_url: url,
        brand_dna: generatedDNA || {}
      });
      alert("Brand saved!");
      setGeneratedDNA(null);
      setUrl("");
      setBrandContext("");
      setLogoUrl(null);
      setBrandName("");
      fetchBrands();
    } catch (e) {
      alert("Failed to save brand");
    }
  };

  return (
    <div className="flex bg-gray-50 h-screen">
      {/* Sidebar for Brands */}
      <div className="w-64 bg-white border-r border-gray-200 p-6 flex flex-col">
        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
          <Briefcase className="w-6 h-6 text-indigo-600" /> Brands
        </h2>
        <div className="flex-1 overflow-y-auto space-y-2">
          {brands.map(b => (
            <div key={b.id} className="p-3 bg-gray-50 rounded-lg border border-gray-100 group hover:border-indigo-200 transition-colors">
              <div className="font-medium text-gray-900">{b.name}</div>
              <div className="text-xs text-gray-500 truncate">{b.website_url || "Manual Entry"}</div>
            </div>
          ))}
        </div>
        <button onClick={onBack} className="mt-4 text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1">
          Back to Campaigns
        </button>
      </div>

      {/* Main Content: Generator */}
      <div className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">New Brand Identity</h1>
          <p className="text-gray-500 mb-8">Generate a brand persona using AI. Provide a URL, text description, or logo.</p>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-8 space-y-6">

            {/* Input Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Website URL (Optional)</label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://example.com"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Brand Description / Context</label>
                  <textarea
                    value={brandContext}
                    onChange={(e) => setBrandContext(e.target.value)}
                    placeholder="Describe the brand's voice, values, and visual style..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 h-32 resize-none"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Brand Logo (Optional)</label>
                  <div className="flex flex-col gap-3">
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                      {logoUrl ? (
                        <img src={logoUrl} alt="Logo Preview" className="h-full w-full object-contain p-2" />
                      ) : (
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          {isUploadingLogo ? (
                            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                          ) : (
                            <>
                              <ImageIcon className="w-8 h-8 text-gray-400 mb-2" />
                              <p className="text-xs text-gray-500">Click to upload logo</p>
                            </>
                          )}
                        </div>
                      )}
                      <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} disabled={isUploadingLogo} />
                    </label>
                    {logoUrl && (
                      <button onClick={() => setLogoUrl(null)} className="text-xs text-red-600 hover:text-red-800 self-end">
                        Remove Logo
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-gray-100">
              <button
                onClick={generateDNA}
                disabled={loading || (!url && !brandContext && !logoUrl)}
                className="bg-indigo-600 text-white px-8 py-2.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium shadow-sm transition-all hover:shadow"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Analyze Brand Identity
              </button>
            </div>

            {/* Analysis Results */}
            {generatedDNA && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pt-6 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-gray-900">Analysis Results</h3>
                  <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-medium">AI Generated</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left Col: Core Identity */}
                  <div className="space-y-4">
                    <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
                      <label className="text-xs font-bold text-indigo-900 uppercase tracking-wider mb-1 block">Brand Voice</label>
                      <p className="text-sm text-indigo-900 leading-relaxed">{generatedDNA.brand_voice}</p>
                    </div>
                    <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                      <label className="text-xs font-bold text-blue-900 uppercase tracking-wider mb-1 block">Target Audience</label>
                      <p className="text-sm text-blue-900 leading-relaxed">{generatedDNA.target_audience}</p>
                    </div>
                  </div>

                  {/* Right Col: Visuals */}
                  <div className="space-y-4">
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Visual Style</label>
                      <p className="text-sm text-gray-700 mb-4">{generatedDNA.visual_style_description || generatedDNA.visual_style}</p>

                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Color Palette</label>
                      <div className="flex flex-wrap gap-2">
                        {generatedDNA.color_palette?.map((color, idx) => (
                          <div key={idx} className="flex flex-col items-center gap-1 group">
                            <div
                              className="w-12 h-12 rounded-full shadow-sm border border-gray-200 ring-2 ring-transparent group-hover:ring-indigo-300 transition-all"
                              style={{ backgroundColor: color }}
                              title={color}
                            />
                            <span className="text-[10px] font-mono text-gray-500 uppercase">{color}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-gray-100">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Save as Brand Name</label>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={brandName}
                      onChange={(e) => setBrandName(e.target.value)}
                      placeholder="e.g. Acme Corp"
                      className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      onClick={saveBrand}
                      disabled={!brandName}
                      className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                    >
                      Save Brand
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [view, setView] = useState("campaigns"); // 'campaigns' or 'brands'

  // Data States
  const [campaigns, setCampaigns] = useState([]);
  const [brands, setBrands] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [selectedBrandId, setSelectedBrandId] = useState("");
  const [posts, setPosts] = useState([]);

  // UI States
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(null);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [viewMode, setViewMode] = useState('list');
  const [selectedPostForModal, setSelectedPostForModal] = useState(null);

  // Forms
  const [newCampaignName, setNewCampaignName] = useState("");
  const [newCampaignPrompt, setNewCampaignPrompt] = useState("");
  const [newPostPrompt, setNewPostPrompt] = useState("");
  const [newPostType, setNewPostType] = useState("POST");
  const [newPostCount, setNewPostCount] = useState(1);
  const [uploadedImageUrl, setUploadedImageUrl] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [useAsContent, setUseAsContent] = useState(false);

  // --- Effects ---
  useEffect(() => {
    fetchCampaigns();
    axios.get("/brands").then(res => setBrands(res.data)).catch(console.error);
  }, []);

  useEffect(() => {
    if (selectedCampaign) {
      fetchPosts(selectedCampaign.id);
    } else {
      setPosts([]);
    }
  }, [selectedCampaign]);

  useEffect(() => {
    if (!selectedCampaign) return;
    const hasPending = posts.some(p => p.status === 'PENDING');
    if (hasPending) {
      const interval = setInterval(() => {
        fetchPosts(selectedCampaign.id, true);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [posts, selectedCampaign]);

  // --- Handlers ---
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
      if (!silent && view === 'campaigns') setLoading(true);
      const res = await axios.get(`/campaigns/${campaignId}/posts`);
      setPosts(res.data);
    } catch (err) {
      console.error(err);
      if (!silent) setError("Failed to fetch posts");
    } finally {
      if (!silent) setLoading(false);
    }
  };

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

  const createCampaign = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await axios.post("/campaigns", {
        name: newCampaignName,
        master_prompt: newCampaignPrompt,
        brand_id: selectedBrandId ? parseInt(selectedBrandId) : null
      });
      setCampaigns([res.data, ...campaigns]);
      setSelectedCampaign(res.data);
      setModalOpen(false);
      setNewCampaignName("");
      setNewCampaignPrompt("");
      setSelectedBrandId("");
    } catch (err) {
      console.error(err);
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

  // Create Post Handler
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
    }
  };

  // View Switcher
  if (view === "brands") {
    return <BrandManager onBack={() => setView("campaigns")} />;
  }

  return (
    <div className="flex h-screen bg-gray-50 font-sans text-gray-900">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-2 text-indigo-700 mb-6">
            <Briefcase className="w-6 h-6" />
            <span className="font-bold text-lg tracking-tight">Vision Media 1.0</span>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="w-full bg-indigo-600 text-white py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all shadow-sm shadow-indigo-200 font-medium text-sm"
          >
            <Plus className="w-4 h-4" /> New Campaign
          </button>

          <button
            onClick={() => setView("brands")}
            className="w-full mt-3 bg-white text-gray-700 border border-gray-200 py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 hover:bg-gray-50 transition-all font-medium text-sm"
          >
            <Sparkles className="w-4 h-4 text-purple-600" /> Manage Brands
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
              {/* Add Post Form */}
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

                      {/* Brand Indicator */}
                      <div className="flex items-end pb-2">
                        {selectedCampaign.brand_name ? (
                          <div className="flex items-center gap-1.5 px-2 py-1.5 bg-purple-50 text-purple-700 text-xs font-medium rounded-md border border-purple-100" title="Posts inherit brand DNA from campaign">
                            <Sparkles className="w-3 h-3" />
                            {selectedCampaign.brand_name}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 px-2 py-1.5 bg-gray-50 text-gray-500 text-xs rounded-md border border-gray-100" title="No brand linked">
                            <span className="w-2 h-2 rounded-full bg-gray-300"></span>
                            No Brand
                          </div>
                        )}
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
            <h2 className="text-xl font-bold text-gray-900 mb-2">Welcome to Vision Media 1.0</h2>
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
        {modalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
              <h2 className="text-lg font-bold text-gray-900 mb-4">New Campaign</h2>
              <form onSubmit={createCampaign} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Name</label>
                  <input
                    type="text"
                    required
                    value={newCampaignName}
                    onChange={(e) => setNewCampaignName(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="e.g., Summer Launch 2024"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Brand Identity (Optional)</label>
                  <select
                    value={selectedBrandId}
                    onChange={(e) => setSelectedBrandId(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                  >
                    <option value="">-- No Brand --</option>
                    {brands.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Campaign will inherit brand voice and visual style.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Master Strategy / Objective</label>
                  <textarea
                    required
                    value={newCampaignPrompt}
                    onChange={(e) => setNewCampaignPrompt(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 h-24 resize-none"
                    placeholder="Describe the high-level goal, target audience across all posts..."
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg"
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
        {lightboxImage && (
          <div
            className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={() => setLightboxImage(null)}
          >
            <button
              onClick={() => setLightboxImage(null)}
              className="absolute top-4 right-4 text-white hover:text-gray-300 p-2"
            >
              <X className="w-8 h-8" />
            </button>
            <img
              src={lightboxImage}
              alt="Fullscreen view"
              className="max-w-full max-h-screen object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )
        }
      </div>
    </div>
  );
}

export default App;
