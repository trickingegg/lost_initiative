import React from 'react';

interface ImagePanelProps {
    currentImageKey: string | null;
    imagesCache: Record<string, string>;
    imagePrompts: Record<string, string>;
    isGeneratingImage: boolean;
    onGenerateImage: (key: string, prompt: string) => void;
}

const ImagePanel: React.FC<ImagePanelProps> = ({ currentImageKey, imagesCache, imagePrompts, isGeneratingImage, onGenerateImage }) => {
    
    if (!currentImageKey) {
        return <div className="w-full aspect-video bg-black/30 rounded-lg mb-4 flex-shrink-0"></div>;
    }

    const imageUrl = imagesCache[currentImageKey];
    const prompt = imagePrompts[currentImageKey];

    const handleGenerateClick = () => {
        if (prompt && currentImageKey) {
            onGenerateImage(currentImageKey, prompt);
        }
    };
    
    // Attempt to create a user-friendly name from the key
    const displayName = currentImageKey
        .replace(/^(location_|npc_|item_)/, '') // remove prefix
        .replace(/_/g, ' ') // replace underscores with spaces
        .replace(/\b\w/g, l => l.toUpperCase()); // capitalize words

    return (
        <div className="w-full max-h-[30vh] aspect-video bg-black/30 rounded-lg mb-4 flex items-center justify-center relative overflow-hidden flex-shrink">
            {imageUrl ? (
                <img src={imageUrl} alt={displayName} className="w-full h-full object-cover" />
            ) : isGeneratingImage ? (
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400 mx-auto"></div>
                    <p className="mt-4 text-gray-300">Conjuring a vision...</p>
                </div>
            ) : prompt ? (
                <div className="text-center">
                    <button
                        onClick={handleGenerateClick}
                        className="bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-bold py-3 px-6 rounded-md transition duration-200"
                    >
                        Visualize: {displayName}
                    </button>
                    <p className="text-xs text-gray-500 mt-2">Generate an AI image of the scene.</p>
                </div>
            ) : (
                 <div className="text-gray-600">
                    <p>No visual available for this scene.</p>
                </div>
            )}
        </div>
    );
};

export default ImagePanel;