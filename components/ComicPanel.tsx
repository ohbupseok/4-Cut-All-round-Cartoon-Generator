
import React from 'react';
import Spinner from './Spinner';
import type { PanelScript } from '../types';

interface ComicPanelProps {
  panel: PanelScript;
  imageData: string | null;
  isLoading: boolean;
  onGenerateImage: () => void;
  isScriptGenerated: boolean;
}

const ComicPanel: React.FC<ComicPanelProps> = ({ panel, imageData, isLoading, onGenerateImage, isScriptGenerated }) => {
  return (
    <div className="aspect-square border-4 border-orange-200 bg-white rounded-lg shadow-lg flex flex-col justify-between items-center p-4 relative overflow-hidden">
      {imageData ? (
        <img src={`data:image/png;base64,${imageData}`} alt={`패널 ${panel.panel} 이미지`} className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div className="text-center w-full flex flex-col justify-between h-full">
          <div>
            <h3 className="font-bold text-lg text-orange-600 mb-2">패널 #{panel.panel}</h3>
            {isScriptGenerated ? (
              <div className="text-left w-full mt-2">
                {panel.dialogue && panel.dialogue !== '없음' ? (
                  <p className="text-sm text-gray-800 bg-orange-50 p-2 rounded-md border border-orange-100">
                    <span className="font-bold text-orange-700">{panel.character}: </span>
                    {panel.dialogue}
                  </p>
                ) : (
                  <p className="text-sm text-gray-500 italic p-2">
                    (지문 또는 행동)
                  </p>
                )}
                 <p className="text-xs text-gray-500 mt-2">묘사: {panel.description}</p>
              </div>
            ) : <p className="text-sm text-gray-700">{panel.description}</p>
            }
          </div>
          <div className="flex justify-center items-center h-full">
            {isLoading ? (
              <Spinner />
            ) : (
                isScriptGenerated && (
                <button
                    onClick={onGenerateImage}
                    disabled={isLoading}
                    className="mt-4 px-4 py-2 bg-orange-500 text-white font-bold rounded-lg hover:bg-orange-600 transition-colors disabled:bg-gray-400"
                >
                    이미지 생성
                </button>
                )
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ComicPanel;
