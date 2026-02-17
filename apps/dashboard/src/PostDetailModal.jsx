import React, { useState } from 'react';
import { X, ChevronLeft, ChevronRight, Calendar, Copy, Check, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from './lib/utils';

const PostDetailModal = ({ post, onClose, onUpdateStatus }) => {
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [copied, setCopied] = useState(false);

    if (!post) return null;

    let images = [];
    try {
        images = typeof post.image_urls === 'string' ? JSON.parse(post.image_urls) : post.image_urls || [];
    } catch (e) {
        images = [];
    }

    const hasMultipleImages = images && images.length > 1;

    const nextImage = () => setCurrentImageIndex((prev) => (prev + 1) % images.length);
    const prevImage = () => setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);

    const copyCaption = () => {
        navigator.clipboard.writeText(post.caption || "");
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col md:flex-row relative animate-in zoom-in-95 duration-200">

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-10 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                {/* Left: Image Carousel */}
                <div className="w-full md:w-1/2 bg-gray-900 relative flex items-center justify-center min-h-[300px] md:min-h-full">
                    {images.length > 0 ? (
                        <>
                            <img
                                src={images[currentImageIndex]}
                                alt="Post content"
                                className="max-w-full max-h-full object-contain"
                            />

                            {hasMultipleImages && (
                                <>
                                    <button
                                        onClick={prevImage}
                                        className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors border border-white/20"
                                    >
                                        <ChevronLeft className="w-6 h-6" />
                                    </button>
                                    <button
                                        onClick={nextImage}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors border border-white/20"
                                    >
                                        <ChevronRight className="w-6 h-6" />
                                    </button>
                                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                                        {images.map((_, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => setCurrentImageIndex(idx)}
                                                className={cn(
                                                    "w-2 h-2 rounded-full transition-all",
                                                    idx === currentImageIndex ? "bg-white w-4" : "bg-white/40 hover:bg-white/60"
                                                )}
                                            />
                                        ))}
                                    </div>
                                </>
                            )}
                        </>
                    ) : (
                        <div className="text-gray-500">No images available</div>
                    )}
                </div>

                {/* Right: Details */}
                <div className="w-full md:w-1/2 flex flex-col h-full bg-white">
                    <div className="p-6 flex-1 overflow-y-auto">
                        {/* Status & Time */}
                        <div className="flex items-center gap-3 mb-6">
                            <span className={cn(
                                "px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide uppercase",
                                post.status === 'APPROVED' ? "bg-green-100 text-green-700" :
                                    post.status === 'PENDING' ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"
                            )}>
                                {post.status}
                            </span>
                            {post.scheduled_at && (
                                <div className="flex items-center gap-1.5 text-sm text-gray-500">
                                    <Calendar className="w-4 h-4" />
                                    <span>{format(new Date(post.scheduled_at), "MMMM d, yyyy 'at' h:mm a")}</span>
                                </div>
                            )}
                        </div>

                        {/* Caption */}
                        <div className="mb-8">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Caption</h3>
                                <button
                                    onClick={copyCaption}
                                    className="text-xs flex items-center gap-1 text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
                                >
                                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                    {copied ? "Copied!" : "Copy Text"}
                                </button>
                            </div>
                            <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                                {post.caption || "No caption generated yet."}
                            </div>
                        </div>

                        {/* Prompt Info */}
                        <div className="space-y-4">
                            <div>
                                <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Specific Prompt</h4>
                                <p className="text-sm text-gray-800">{post.specific_prompt}</p>
                            </div>
                            {post.input_image_url && (
                                <div>
                                    <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Source</h4>
                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-50 text-blue-700 text-xs font-medium">
                                        {post.use_as_content ? "Real Image (Direct Upload)" : "AI Generated from Reference"}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Actions Footer */}
                    <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PostDetailModal;
