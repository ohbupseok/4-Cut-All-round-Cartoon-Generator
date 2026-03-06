


import React, { useState, useCallback, useRef, useEffect } from 'react';
import { generateScript, generateImage, generateCharacterSheet, generateIdeas, generateInstagramPost, generateContinuationScript } from './services/geminiService';
import type { FullScript, PanelScript } from './types';
import ComicPanel from './components/ComicPanel';
import Spinner from './components/Spinner';
import { InteractiveComicPanel, type BubbleConfig, drawTextOnImage, getDefaultBubbleConfig } from './components/InteractiveComicPanel';


const artStyles = [
  { name: '명랑만화', value: '명랑만화' },
  { name: '아메리칸 코믹스', value: '아메리칸 코믹스' },
  { name: '한국 최신 웹툰', value: '한국 최신 웹툰' },
  { name: '복고풍 만화', value: '린 클레어 (Ligne claire)' },
];

const categories = [
  '사용자 주제에 따름',
  '시사 풍자 만화',
  '일상 공감 및 개그 만화',
  '반려동물',
  '감동실화',
  '자기계발(자신감상승)',
  '캠페인',
  '매뉴얼',
  '가상 역사/SF 만화',
  '개념 설명 및 원리 소개',
  '언어 학습'
];

const textFrameStyles = [
  { id: 'speech-bubble', name: '말풍선 (편집 가능)' },
  { id: 'simple', name: '심플 (반투명 흰색)' },
  { id: 'webtoon', name: '웹툰 (흰색 테두리)' },
  { id: 'narration', name: '나레이션 (상단 노란색)' },
  { id: 'cinematic', name: '시네마틱 (글자 테두리)' },
];

type Step = 'STEP_1_TOPIC' | 'STEP_2_SCRIPT' | 'STEP_3_CHARACTERS' | 'STEP_4_COMIC';
export type TailDirection =
  | 'top-left' | 'top-center' | 'top-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right'
  | 'left-top' | 'left-center' | 'left-bottom'
  | 'right-top' | 'right-center' | 'right-bottom';
export type StoryFormat = 'single' | 'serial';
export type ContinuationType = 'continue' | 'end';


const StepIndicator: React.FC<{ currentStep: Step }> = ({ currentStep }) => {
    const steps = [
        { id: 'STEP_1_TOPIC', title: '주제 선정' },
        { id: 'STEP_2_SCRIPT', title: '대본 확인' },
        { id: 'STEP_3_CHARACTERS', title: '등장인물 확인' },
        { id: 'STEP_4_COMIC', title: '만화 생성' }
    ];
    const currentStepIndex = steps.findIndex(s => s.id === currentStep);

    return (
        <div className="flex justify-center items-center my-8 w-full max-w-4xl mx-auto">
            {steps.map((step, index) => (
                <React.Fragment key={step.id}>
                    <div className="flex items-center">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg transition-colors ${index <= currentStepIndex ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                            {index + 1}
                        </div>
                        <span className={`ml-3 font-semibold transition-colors ${index <= currentStepIndex ? 'text-orange-600' : 'text-gray-500'}`}>{step.title}</span>
                    </div>
                    {index < steps.length - 1 && (
                        <div className={`flex-1 h-1 mx-4 transition-colors ${index < currentStepIndex ? 'bg-orange-500' : 'bg-gray-200'}`}></div>
                    )}
                </React.Fragment>
            ))}
        </div>
    );
};

const App: React.FC = () => {
  const [topic, setTopic] = useState<string>('');
  const [artStyle, setArtStyle] = useState<string>(artStyles[0].value);
  const [category, setCategory] = useState<string>(categories[0]);
  const [textFrameStyle, setTextFrameStyle] = useState<string>(textFrameStyles[0].id);
  const [script, setScript] = useState<FullScript | null>(null);
  
  // Image state now splits raw images and final (non-interactive) images
  const [rawImages, setRawImages] = useState<(string | null)[]>([null, null, null, null]);
  const [finalImages, setFinalImages] = useState<(string | null)[]>([null, null, null, null]);
  const [bubbleConfigs, setBubbleConfigs] = useState<(BubbleConfig | null)[]>([null, null, null, null]);
  
  const [isGeneratingScript, setIsGeneratingScript] = useState<boolean>(false);
  const [isGeneratingSheets, setIsGeneratingSheets] = useState<boolean>(false);
  const [generatingImageIndex, setGeneratingImageIndex] = useState<number | null>(null);
  const [isGeneratingAllImages, setIsGeneratingAllImages] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isGeneratingIdeas, setIsGeneratingIdeas] = useState<boolean>(false);
  const [suggestedIdeas, setSuggestedIdeas] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState<Step>('STEP_1_TOPIC');
  const [instagramPost, setInstagramPost] = useState<{description: string; hashtags: string} | null>(null);
  const [isGeneratingPost, setIsGeneratingPost] = useState<boolean>(false);
  
  // Story format and continuation state
  const [storyFormat, setStoryFormat] = useState<StoryFormat>('single');
  const [isContinuation, setIsContinuation] = useState<boolean>(false);
  const [showContinuationInput, setShowContinuationInput] = useState<boolean>(false);
  const [continuationTopic, setContinuationTopic] = useState<string>('');
  const [isGeneratingContinuation, setIsGeneratingContinuation] = useState<boolean>(false);
  const [continuationType, setContinuationType] = useState<ContinuationType>('continue');

  // Image merging state
  const [isMergingImages, setIsMergingImages] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Character image upload and regeneration state
  const characterImageInputRef = useRef<HTMLInputElement>(null);
  const [uploadTargetIndex, setUploadTargetIndex] = useState<number | null>(null);
  const [regeneratingSheetIndex, setRegeneratingSheetIndex] = useState<number | null>(null);


  const handleReset = () => {
    setTopic('');
    // Keep artStyle, category, textFrameStyle, storyFormat
    setScript(null);
    setRawImages([null, null, null, null]);
    setFinalImages([null, null, null, null]);
    setBubbleConfigs([null, null, null, null]);
    setIsGeneratingScript(false);
    setIsGeneratingSheets(false);
    setGeneratingImageIndex(null);
    setIsGeneratingAllImages(false);
    setError(null);
    setSuggestedIdeas([]);
    setCurrentStep('STEP_1_TOPIC');
    setInstagramPost(null);
    setIsGeneratingPost(false);
    setIsContinuation(false);
    setShowContinuationInput(false);
    setContinuationTopic('');
    setIsGeneratingContinuation(false);
    setContinuationType('continue');
    setStoryFormat('single');
  };
  
  const handleCharacterNameChange = useCallback((characterIndex: number, newName: string) => {
    if (!script) return;

    // The name of the character in the current state, before this change.
    const oldName = script.characters[characterIndex].name;
    
    // Create the new list of characters with the updated name.
    const updatedCharacters = script.characters.map((char, index) =>
        index === characterIndex ? { ...char, name: newName } : char
    );

    // Create the new list of panels, updating speaker and dialogue text.
    const updatedPanels = script.panels.map(panel => {
        const newPanel = { ...panel };

        // 1. Update the speaker property of the panel.
        if (newPanel.character === oldName) {
            newPanel.character = newName;
        }

        // 2. Update all occurrences of the name within the dialogue string.
        //    This check prevents errors from trying to replace an empty string.
        if (oldName && oldName.trim() !== '' && newPanel.dialogue) {
            const escapedOldName = oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const nameRegex = new RegExp(escapedOldName, 'g');
            newPanel.dialogue = newPanel.dialogue.replace(nameRegex, newName);
        }
        
        return newPanel;
    });

    setScript({
        ...script,
        characters: updatedCharacters,
        panels: updatedPanels
    });
  }, [script]);


  const handlePanelCharacterChange = useCallback((panelIndex: number, newCharacter: string) => {
    if (!script) return;
    
    const updatedPanels = script.panels.map((panel, index) => {
        if (index === panelIndex) {
            return { ...panel, character: newCharacter };
        }
        return panel;
    });
    
    setScript({
        ...script,
        panels: updatedPanels
    });

    // If we have a bubble config for this panel, update its style
    setBubbleConfigs(prev => {
        const newConfigs = [...prev];
        const config = newConfigs[panelIndex];
        if (config) {
            newConfigs[panelIndex] = { 
                ...config, 
                style: newCharacter === '생각' ? 'thought' : 'speech' 
            };
        }
        return newConfigs;
    });

  }, [script]);

  const handleDialogueChange = useCallback((panelIndex: number, newDialogue: string) => {
    if (!script) return;
    
    const updatedPanels = script.panels.map((panel, index) => {
        if (index === panelIndex) {
            return { ...panel, dialogue: newDialogue };
        }
        return panel;
    });
    
    setScript({
        ...script,
        panels: updatedPanels
    });
  }, [script]);


  const handleBubbleConfigChange = useCallback((panelIndex: number, newConfig: BubbleConfig) => {
    setBubbleConfigs(prev => {
      const newConfigs = [...prev];
      newConfigs[panelIndex] = newConfig;
      return newConfigs;
    });
  }, []);

  const handleGenerateIdeas = useCallback(async () => {
    setIsGeneratingIdeas(true);
    setError(null);
    setSuggestedIdeas([]);
    try {
      const ideas = await generateIdeas(category);
      setSuggestedIdeas(ideas);
    } catch (err) {
      setError(err instanceof Error ? err.message : '아이디어 추천 중 오류가 발생했습니다.');
      console.error(err);
    } finally {
      setIsGeneratingIdeas(false);
    }
  }, [category]);

  const handleGenerateScript = useCallback(async () => {
    if (!topic.trim()) {
      setError('주제를 입력해주세요.');
      return;
    }
    setIsGeneratingScript(true);
    setError(null);
    setScript(null);
    setRawImages([null, null, null, null]);
    setFinalImages([null, null, null, null]);
    setBubbleConfigs([null, null, null, null]);
    try {
      const generatedScript = await generateScript(topic, category, storyFormat);
      if(generatedScript.panels.length !== 4){
        throw new Error("AI가 4컷 만화 대본을 생성하지 못했습니다. 다시 시도해주세요.");
      }
      setScript(generatedScript);
      setCurrentStep('STEP_2_SCRIPT');
    } catch (err) {
      setError(err instanceof Error ? err.message : '대본 생성 중 오류가 발생했습니다.');
      console.error(err);
    } finally {
      setIsGeneratingScript(false);
    }
  }, [topic, category, storyFormat]);
  
  const handleGenerateCharacterSheets = useCallback(async () => {
    if (!script) return;
    
    if (script.characters.some(c => c.name.trim() === '')) {
        setError("모든 등장인물의 이름은 비워둘 수 없습니다.");
        return;
    }

    if (script.characters.every(c => c.sheetImage)) {
        setCurrentStep('STEP_3_CHARACTERS');
        return;
    }

    setIsGeneratingSheets(true);
    setError(null);
    try {
        const sheetPromises = script.characters.map(char => 
            generateCharacterSheet(char.description, artStyle)
        );
        const sheetImages = await Promise.all(sheetPromises);
        
        const updatedCharacters = script.characters.map((char, index) => ({
            ...char,
            sheetImage: sheetImages[index],
        }));
        const finalScript = { ...script, characters: updatedCharacters };
        setScript(finalScript);
        setCurrentStep('STEP_3_CHARACTERS');
    } catch (err) {
      setError(err instanceof Error ? err.message : '캐릭터 생성 중 오류가 발생했습니다.');
      console.error(err);
    } finally {
        setIsGeneratingSheets(false);
    }
  }, [script, artStyle]);
  
  const handleRegenerateCharacterSheet = useCallback(async (characterIndex: number) => {
    if (!script) return;

    setRegeneratingSheetIndex(characterIndex);
    setError(null);
    try {
        const charToRegenerate = script.characters[characterIndex];
        const newSheetImage = await generateCharacterSheet(charToRegenerate.description, artStyle);
        
        setScript(prevScript => {
            if (!prevScript) return null;
            const updatedCharacters = prevScript.characters.map((char, index) => {
                if (index === characterIndex) {
                    return { ...char, sheetImage: newSheetImage };
                }
                return char;
            });
            return { ...prevScript, characters: updatedCharacters };
        });

    } catch (err) {
        setError(err instanceof Error ? err.message : '캐릭터 이미지 재생성 중 오류가 발생했습니다.');
        console.error(err);
    } finally {
        setRegeneratingSheetIndex(null);
    }
  }, [script, artStyle]);


  const handleGenerateImage = useCallback(async (panelIndex: number) => {
    if (!script) return;
    setGeneratingImageIndex(panelIndex);
    setError(null);
    try {
      const panel = script.panels[panelIndex];
      const rawImageBytes = await generateImage(panel.description, script.characters, artStyle);

      if (textFrameStyle === 'speech-bubble') {
        setRawImages(prev => {
          const newImages = [...prev];
          newImages[panelIndex] = rawImageBytes;
          return newImages;
        });
        setFinalImages(prev => {
            const newImages = [...prev];
            newImages[panelIndex] = null;
            return newImages;
        });

        // Use a temporary canvas to get image dimensions for default bubble config
        const tempImg = new Image();
        tempImg.src = `data:image/png;base64,${rawImageBytes}`;
        tempImg.onload = () => {
          const tempCanvas = document.createElement('canvas');
          const tempCtx = tempCanvas.getContext('2d');
          if (tempCtx) {
            const defaultConfig = getDefaultBubbleConfig(tempCtx, tempImg.width, tempImg.height, panel);
            if (panel.character === '생각') {
              defaultConfig.style = 'thought';
            }
            setBubbleConfigs(prev => {
                const newConfigs = [...prev];
                newConfigs[panelIndex] = defaultConfig;
                return newConfigs;
            });
          }
        };
      } else {
        const imageWithText = await drawTextOnImage(rawImageBytes, panel, textFrameStyle);
        setFinalImages(prev => {
          const newImages = [...prev];
          newImages[panelIndex] = imageWithText;
          return newImages;
        });
        setRawImages(prev => {
            const newImages = [...prev];
            newImages[panelIndex] = null;
            return newImages;
        });
        setBubbleConfigs(prev => {
            const newConfigs = [...prev];
            newConfigs[panelIndex] = null;
            return newConfigs;
        });
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : '이미지 생성 중 오류가 발생했습니다.');
      console.error(err);
    } finally {
      setGeneratingImageIndex(null);
    }
  }, [script, artStyle, textFrameStyle]);

  const handleGenerateInstagramPost = useCallback(async (currentTopic: string, currentScript: FullScript) => {
    setIsGeneratingPost(true);
    try {
        const post = await generateInstagramPost(currentTopic, currentScript);
        setInstagramPost(post);
    } catch (err) {
        console.error("Failed to generate Instagram post:", err);
    } finally {
        setIsGeneratingPost(false);
    }
  }, []);

  const handleGenerateAllImages = useCallback(async () => {
    if (!script) return;
    setIsGeneratingAllImages(true);
    setError(null);
    setGeneratingImageIndex(null);
    setInstagramPost(null);
    try {
      const imageGenerationPromises = script.panels.map(panel => 
        generateImage(panel.description, script.characters, artStyle)
      );
      const generatedRawImages = await Promise.all(imageGenerationPromises);

      if (textFrameStyle === 'speech-bubble') {
        setRawImages(generatedRawImages);
        setFinalImages([null, null, null, null]);
        
        const tempImg = new Image();
        tempImg.src = `data:image/png;base64,${generatedRawImages[0]}`;
        tempImg.onload = () => {
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');
            if (tempCtx) {
                const newConfigs = script.panels.map((panel) => {
                    const defaultConfig = getDefaultBubbleConfig(tempCtx, tempImg.width, tempImg.height, panel);
                    if (panel.character === '생각') {
                      defaultConfig.style = 'thought';
                    }
                    return defaultConfig;
                });
                setBubbleConfigs(newConfigs);
            }
        };

      } else {
        const processedImages = await Promise.all(
          generatedRawImages.map((rawImg, index) => 
            drawTextOnImage(rawImg, script.panels[index], textFrameStyle)
          )
        );
        setFinalImages(processedImages);
        setRawImages([null, null, null, null]);
        setBubbleConfigs([null, null, null, null]);
      }
      handleGenerateInstagramPost(topic, script);
    } catch (err) {
        setError(err instanceof Error ? err.message : '전체 이미지 생성 중 오류가 발생했습니다.');
        console.error(err);
    } finally {
        setIsGeneratingAllImages(false);
    }
  }, [script, artStyle, topic, handleGenerateInstagramPost, textFrameStyle]);

  const handleGenerateContinuationScript = useCallback(async () => {
    if (!script) return;

    setIsGeneratingContinuation(true);
    setError(null);
    try {
        const newScript = await generateContinuationScript(topic, script, continuationTopic, category, continuationType);
        
        const updatedCharacters = newScript.characters.map(newChar => {
            const oldChar = script.characters.find(oc => oc.name === newChar.name);
            return {
                ...newChar,
                sheetImage: oldChar ? oldChar.sheetImage : null,
            };
        });

        setScript({ ...newScript, characters: updatedCharacters });
        setTopic(continuationTopic.trim() || `${topic} (계속)`);
        setRawImages([null, null, null, null]);
        setFinalImages([null, null, null, null]);
        setBubbleConfigs([null, null, null, null]);
        setInstagramPost(null);
        
        setShowContinuationInput(false);
        setContinuationTopic('');
        setContinuationType('continue');
        setIsContinuation(true);
        setCurrentStep('STEP_2_SCRIPT');

    } catch (err) {
        setError(err instanceof Error ? err.message : '후속 대본 생성 중 오류가 발생했습니다.');
        console.error(err);
    } finally {
        setIsGeneratingContinuation(false);
    }
  }, [script, topic, continuationTopic, category, continuationType]);

  const getFinalImagesForDownload = useCallback(async (): Promise<(string | null)[]> => {
    if (textFrameStyle === 'speech-bubble') {
        return await Promise.all(rawImages.map(async (rawImg, index) => {
            if (!rawImg || !script || !bubbleConfigs[index]) return null;
            const finalDialogue = (bubbleConfigs[index]!.style === 'shout' && script.panels[index].character !== '없음' && script.panels[index].character !== '생각')
                ? script.panels[index].dialogue
                : `${script.panels[index].character}: ${script.panels[index].dialogue}`;
            
            const panelForDrawing = {
                ...script.panels[index],
                dialogue: script.panels[index].dialogue,
            };
            return await drawTextOnImage(rawImg, panelForDrawing, textFrameStyle, bubbleConfigs[index]!);
        }));
    }
    return finalImages;
  }, [rawImages, finalImages, script, bubbleConfigs, textFrameStyle]);
  
  const handleDownload = useCallback(async (layout: 'grid' | 'horizontal' | 'vertical') => {
    const imagesToDownload = await getFinalImagesForDownload();
    if (!imagesToDownload.every(img => img)) {
      setError("모든 이미지가 생성되어야 저장할 수 있습니다.");
      return;
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setError("캔버스를 생성할 수 없습니다.");
      return;
    }

    const imageElements = await Promise.all(imagesToDownload.map(imgData => {
      return new Promise<HTMLImageElement>((resolve) => {
        const img = new Image();
        img.src = `data:image/png;base64,${imgData}`;
        img.onload = () => resolve(img);
      });
    }));

    const panelWidth = imageElements[0].width;
    const panelHeight = imageElements[0].height;
    const gap = 20;

    if (layout === 'grid') {
      canvas.width = panelWidth * 2 + gap;
      canvas.height = panelHeight * 2 + gap;
    } else if (layout === 'horizontal') {
      canvas.width = panelWidth * 4 + gap * 3;
      canvas.height = panelHeight;
    } else {
      canvas.width = panelWidth;
      canvas.height = panelHeight * 4 + gap * 3;
    }
    
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (layout === 'grid') {
      ctx.drawImage(imageElements[0], 0, 0);
      ctx.drawImage(imageElements[1], panelWidth + gap, 0);
      ctx.drawImage(imageElements[2], 0, panelHeight + gap);
      ctx.drawImage(imageElements[3], panelWidth + gap, panelHeight + gap);
    } else if (layout === 'horizontal') {
      imageElements.forEach((img, i) => ctx.drawImage(img, i * (panelWidth + gap), 0));
    } else {
      imageElements.forEach((img, i) => ctx.drawImage(img, 0, i * (panelHeight + gap)));
    }

    const link = document.createElement('a');
    link.download = `4-cut-comic-${layout}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();

  }, [getFinalImagesForDownload]);

  const handleDownloadIndividual = useCallback(async () => {
    const imagesToDownload = await getFinalImagesForDownload();
    if (!imagesToDownload.every(img => img)) {
      setError("모든 이미지가 생성되어야 저장할 수 있습니다.");
      return;
    }

    imagesToDownload.forEach((imgData, index) => {
      if (imgData) {
        const link = document.createElement('a');
        link.download = `4-cut-comic-panel-${index + 1}.png`;
        link.href = `data:image/png;base64,${imgData}`;
        link.click();
      }
    });
  }, [getFinalImagesForDownload]);
  
  const handleCopyToClipboard = useCallback((text: string, type: '설명' | '해시태그') => {
    navigator.clipboard.writeText(text).then(() => {
        alert(`${type}이(가) 클립보드에 복사되었습니다!`);
    }).catch(err => {
        setError('클립보드 복사에 실패했습니다. 브라우저 설정을 확인해주세요.');
        console.error('Copy to clipboard failed:', err);
    });
  }, []);

  const handleMergeImages = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
      return;
    }

    setIsMergingImages(true);
    setError(null);

    try {
      const imagePromises = Array.from(files).map((file: File) => {
        return new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error(`이미지 로딩 실패: ${file.name}`));
          img.src = URL.createObjectURL(file);
        });
      });

      const images = await Promise.all(imagePromises);
      images.forEach(img => URL.revokeObjectURL(img.src)); // Clean up object URLs

      if (images.length === 0) return;

      const gap = 20;
      const maxWidth = Math.max(...images.map(img => img.width));
      let totalHeight = 0;

      const scaledDimensions = images.map(img => {
        const scale = maxWidth / img.width;
        const newHeight = img.height * scale;
        totalHeight += newHeight;
        return { width: maxWidth, height: newHeight };
      });
      
      totalHeight += (images.length - 1) * gap;

      const canvas = document.createElement('canvas');
      canvas.width = maxWidth;
      canvas.height = totalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('캔버스 컨텍스트를 가져올 수 없습니다.');
      
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      let currentY = 0;
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        const { height } = scaledDimensions[i];
        ctx.drawImage(img, 0, currentY, maxWidth, height);
        currentY += height + gap;
      }
      
      const link = document.createElement('a');
      link.download = 'merged-comic.png';
      link.href = canvas.toDataURL('image/png');
      link.click();

    } catch (err) {
      setError(err instanceof Error ? err.message : '이미지 병합 중 오류가 발생했습니다.');
      console.error(err);
    } finally {
      setIsMergingImages(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = ''; // Reset file input
      }
    }
  }, []);
  
  const triggerCharacterImageUpload = (index: number) => {
    setUploadTargetIndex(index);
    characterImageInputRef.current?.click();
  };

  const onCharacterImageSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (uploadTargetIndex === null) return;

    const file = event.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = (reader.result as string).split(',')[1];
            setScript(prevScript => {
                if (!prevScript) return null;
                const updatedCharacters = [...prevScript.characters];
                updatedCharacters[uploadTargetIndex] = {
                    ...updatedCharacters[uploadTargetIndex],
                    sheetImage: base64String,
                };
                return { ...prevScript, characters: updatedCharacters };
            });
        };
        // FIX: Changed readDataURL to readAsDataURL.
        reader.readAsDataURL(file);
    }

    if(event.target) event.target.value = '';
    setUploadTargetIndex(null);
  };

  const placeholderPanels: PanelScript[] = [
    { panel: 1, character: '', description: '대본을 먼저 생성해주세요.', dialogue: '' },
    { panel: 2, character: '', description: '만화로 만들고 싶은', dialogue: '' },
    { panel: 3, character: '', description: '주제를 입력하고', dialogue: '' },
    { panel: 4, character: '', description: "'대본 생성' 버튼을 누르세요.", dialogue: '' },
  ];
  
  const panelsToRender = script ? script.panels : placeholderPanels;
  const isBusy = isGeneratingScript || isGeneratingSheets || generatingImageIndex !== null || isGeneratingAllImages || isGeneratingIdeas || isGeneratingContinuation || isMergingImages || regeneratingSheetIndex !== null;
  const allImagesGenerated = (rawImages.every(img => img !== null) || finalImages.every(img => img !== null));

  return (
    <div className="container mx-auto p-4 md:p-8 font-sans bg-amber-50 min-h-screen">
       <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Gugi&family=Noto+Sans+KR:wght@400;700&display=swap');
        body { font-family: 'Noto Sans KR', sans-serif; }
      `}</style>
      
      {/* Hidden file inputs moved here for global access */}
      <input
          type="file"
          ref={fileInputRef}
          multiple
          accept="image/*"
          onChange={handleMergeImages}
          className="hidden"
      />
      <input
          type="file"
          ref={characterImageInputRef}
          accept="image/png, image/jpeg, image/webp"
          className="hidden"
          onChange={onCharacterImageSelected}
      />

      <header className="text-center mb-8">
        <h1 className="text-4xl md:text-5xl font-bold text-orange-600" style={{ fontFamily: "'Gugi', cursive" }}>
          4컷 만능 만화 생성기<sup className="text-red-500 text-2xl md:text-3xl ml-1">PRO</sup>
        </h1>
        <p className="text-slate-600 mt-2">
          카테고리와 주제를 선택하고 나만의 만화를 만들어보세요.
        </p>
      </header>
      
      <StepIndicator currentStep={currentStep} />

      <main>
        {error && (
          <div className="max-w-2xl mx-auto my-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg text-center">
            <strong>오류:</strong> {error}
          </div>
        )}

        {currentStep === 'STEP_1_TOPIC' && (
            <div className="max-w-2xl mx-auto p-6 bg-white rounded-xl shadow-lg border-2 border-orange-100">
                <div className="mb-4">
                  <label htmlFor="style-select" className="block text-sm font-medium text-gray-700 mb-1">
                    그림 스타일 선택
                  </label>
                  <select
                    id="style-select"
                    value={artStyle}
                    onChange={(e) => setArtStyle(e.target.value)}
                    className="w-full p-3 border-2 border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-orange-400 transition bg-white text-black"
                    disabled={isBusy}
                  >
                    {artStyles.map(style => <option key={style.value} value={style.value}>{style.name}</option>)}
                  </select>
                </div>
                <div className="mb-4">
                    <label htmlFor="text-frame-style-select" className="block text-sm font-medium text-gray-700 mb-1">
                        텍스트 박스 디자인 선택
                    </label>
                    <select
                        id="text-frame-style-select"
                        value={textFrameStyle}
                        onChange={(e) => setTextFrameStyle(e.target.value)}
                        className="w-full p-3 border-2 border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-orange-400 transition bg-white text-black"
                        disabled={isBusy}
                    >
                        {textFrameStyles.map(style => <option key={style.id} value={style.id}>{style.name}</option>)}
                    </select>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                      만화 장르(내용) 선택
                  </label>
                  <div className="flex items-center gap-2">
                      <select
                      id="category-select"
                      value={category}
                      onChange={(e) => {
                          setCategory(e.target.value);
                          setSuggestedIdeas([]);
                      }}
                      className="w-full p-3 border-2 border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-orange-400 transition bg-white text-black"
                      disabled={isBusy}
                      >
                      {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                      </select>
                      <button
                          onClick={handleGenerateIdeas}
                          disabled={isBusy || category === '사용자 주제에 따름'}
                          className="flex-shrink-0 px-4 py-3 bg-teal-500 text-white font-bold rounded-lg hover:bg-teal-600 transition-colors disabled:bg-gray-400 w-14 h-14 flex items-center justify-center"
                          title="선택한 장르에 맞는 아이디어를 추천받습니다."
                      >
                          {isGeneratingIdeas ? <Spinner /> : <span className="text-2xl">💡</span>}
                      </button>
                  </div>
                </div>

                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">만화 형식 선택</label>
                    <div className="flex items-center justify-around p-1 bg-orange-100 rounded-lg">
                        <button 
                            onClick={() => setStoryFormat('single')}
                            disabled={isBusy}
                            className={`w-1/2 p-2 text-center font-semibold rounded-md transition-colors ${storyFormat === 'single' ? 'bg-orange-500 text-white shadow' : 'text-orange-700 hover:bg-orange-200'}`}
                        >
                            4컷 단편
                        </button>
                        <button 
                            onClick={() => setStoryFormat('serial')}
                            disabled={isBusy}
                            className={`w-1/2 p-2 text-center font-semibold rounded-md transition-colors ${storyFormat === 'serial' ? 'bg-orange-500 text-white shadow' : 'text-orange-700 hover:bg-orange-200'}`}
                        >
                            연속 만화
                        </button>
                    </div>
                </div>

                {suggestedIdeas.length > 0 && (
                <div className="mb-4 p-4 bg-amber-100 rounded-lg border border-amber-200">
                    <h4 className="font-bold text-orange-800 mb-2">이런 주제는 어때요? (클릭하여 선택)</h4>
                    <div className="flex flex-wrap gap-2">
                        {suggestedIdeas.map((idea, index) => (
                            <button 
                                key={index}
                                onClick={() => setTopic(idea)} 
                                className="text-sm text-left px-3 py-1 bg-white rounded-full hover:bg-orange-100 border border-orange-200 transition-colors shadow-sm text-orange-800"
                            >
                            {idea}
                            </button>
                        ))}
                    </div>
                </div>
                )}

                <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="예: 요즘 물가 상승에 대한 나의 생각... 또는 아이디어를 추천받거나, 직접 4컷 대본을 입력해보세요!"
                className="w-full p-3 border-2 border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-orange-400 transition resize-none"
                rows={4}
                disabled={isBusy}
                />
                <button
                onClick={handleGenerateScript}
                disabled={isBusy}
                className="w-full mt-4 px-6 py-3 bg-orange-500 text-white font-bold text-lg rounded-lg hover:bg-orange-600 transition-transform transform hover:scale-105 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
                >
                {isGeneratingScript ? <><Spinner /><span className="ml-2">대본 생성중...</span></> : '대본 생성하기'}
                </button>
                <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isBusy}
                    className="w-full mt-2 px-6 py-3 bg-indigo-500 text-white font-bold text-lg rounded-lg hover:bg-indigo-600 transition disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
                >
                    {isMergingImages ? <><Spinner /><span className="ml-2">이미지 합치는 중...</span></> : '만화 합치기 (이미지 세로 연결)'}
                </button>
            </div>
        )}
        
        {currentStep === 'STEP_2_SCRIPT' && script && (
          <div className="max-w-4xl mx-auto mt-8 p-6 bg-white rounded-xl shadow-lg border-2 border-orange-100">
              <h3 className="text-2xl font-bold text-center text-orange-800 mb-6">생성된 대본 확인 (대사 및 캐릭터명 수정 가능)</h3>
              
              <div className="mb-8">
                  <h4 className="font-bold text-lg text-orange-700 mb-3 border-b-2 border-orange-200 pb-2">등장인물</h4>
                  <div className="space-y-3">
                      {script.characters.map((char, index) => (
                          <div key={index} className="p-4 bg-amber-50 rounded-lg shadow-sm">
                              <label htmlFor={`char-name-${index}`} className="block text-sm font-bold text-slate-700 mb-1">
                                이름
                              </label>
                              <input
                                  id={`char-name-${index}`}
                                  type="text"
                                  value={char.name}
                                  onChange={(e) => handleCharacterNameChange(index, e.target.value)}
                                  className="font-bold text-slate-800 text-lg bg-white w-full p-2 rounded-md border-2 border-orange-200 focus:border-orange-400 focus:ring-orange-400 focus:outline-none transition"
                              />
                              <p className="text-sm text-slate-600 mt-2"><span className="font-semibold">설명:</span> {char.description}</p>
                          </div>
                      ))}
                  </div>
              </div>

              <div>
                  <h4 className="font-bold text-lg text-orange-700 mb-3 border-b-2 border-orange-200 pb-2">4컷 대본</h4>
                  <div className="space-y-4">
                      {script.panels.map((panel, index) => (
                          <div key={panel.panel} className="p-4 bg-amber-50 rounded-lg shadow-sm">
                              <p className="font-bold text-slate-800">패널 #{panel.panel}</p>
                              <p className="text-sm text-slate-600 mt-2"><span className="font-semibold">장면 묘사:</span> {panel.description}</p>
                              <div className="mt-3">
                                <label htmlFor={`dialogue-${panel.panel}`} className="block text-sm font-bold text-slate-700 mb-1">
                                  화자 및 대사
                                </label>
                                <div className="flex items-stretch gap-2">
                                  <select
                                    value={panel.character}
                                    onChange={(e) => handlePanelCharacterChange(index, e.target.value)}
                                    className="flex-shrink-0 font-bold text-orange-800 bg-orange-100 px-3 py-2 rounded-lg border-2 border-orange-200 focus:ring-2 focus:ring-orange-400 focus:border-orange-400 transition"
                                  >
                                      {script.characters.map(c => <option key={`${panel.panel}-${c.name}`} value={c.name}>{c.name}</option>)}
                                      <option value="생각">생각</option>
                                      <option value="없음">없음 (나레이션)</option>
                                  </select>
                                  <textarea
                                    id={`dialogue-${panel.panel}`}
                                    value={panel.dialogue === '없음' ? '' : panel.dialogue}
                                    onChange={(e) => handleDialogueChange(index, e.target.value)}
                                    placeholder={
                                        panel.character === '없음' ? '나레이션을 입력하세요. (비워두면 지문으로 처리)' : 
                                        panel.character === '생각' ? '생각하는 내용을 입력하세요.' :
                                        '대사를 입력/수정하세요. (비워두면 대사 없음)'
                                    }
                                    className="w-full p-2 border-2 border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-orange-400 transition bg-white text-black resize-none"
                                    rows={2}
                                  />
                                </div>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
              
              <div className="mt-8 flex justify-center gap-4">
                  {!isContinuation && (
                    <button onClick={() => setCurrentStep('STEP_1_TOPIC')} className="px-6 py-3 bg-gray-400 text-white font-bold rounded-lg hover:bg-gray-500 transition">
                        주제 수정
                    </button>
                  )}
                  <button onClick={handleGenerateCharacterSheets} disabled={isBusy} className="px-6 py-3 bg-green-500 text-white font-bold rounded-lg hover:bg-green-600 transition disabled:bg-gray-400 flex items-center justify-center">
                      {isGeneratingSheets ? <><Spinner /><span className="ml-2">캐릭터 생성중...</span></> : '캐릭터 생성하고 계속하기'}
                  </button>
              </div>
          </div>
        )}

        {currentStep === 'STEP_3_CHARACTERS' && script?.characters && (
          <div className="max-w-4xl mx-auto mt-8 p-6 bg-white rounded-xl shadow-lg border-2 border-orange-100">
            <h3 className="text-2xl font-bold text-center text-orange-800 mb-6">등장인물 확인</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {script.characters.map((char, index) => (
                <div key={index} className="flex flex-col items-center text-center p-4 bg-amber-50 rounded-lg shadow-sm border border-orange-100">
                  {regeneratingSheetIndex === index ? (
                      <div className="w-32 h-32 bg-gray-200 rounded-full flex items-center justify-center border-4 border-orange-200 mb-3">
                          <Spinner />
                      </div>
                  ) : char.sheetImage ? (
                    <img src={`data:image/png;base64,${char.sheetImage}`} alt={`${char.name} 시트`} className="w-32 h-32 object-cover rounded-full border-4 border-orange-200 mb-3" />
                  ) : (
                    <div className="w-32 h-32 bg-gray-200 rounded-full flex items-center justify-center border-4 border-orange-200 mb-3">
                      <Spinner />
                    </div>
                  )}
                  <div>
                    <p className="font-bold text-lg text-orange-700">{char.name}</p>
                    <p className="text-sm text-slate-600 mt-1">{char.description}</p>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={() => triggerCharacterImageUpload(index)}
                      disabled={isBusy}
                      className="px-4 py-2 bg-slate-500 text-white text-sm font-semibold rounded-lg hover:bg-slate-600 transition flex items-center gap-2 disabled:bg-gray-400"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                      교체
                    </button>
                    <button
                      onClick={() => handleRegenerateCharacterSheet(index)}
                      disabled={isBusy}
                      className="px-4 py-2 bg-teal-500 text-white text-sm font-semibold rounded-lg hover:bg-teal-600 transition flex items-center gap-2 disabled:bg-gray-400"
                    >
                       <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 110 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                        </svg>
                      재생성
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-8 flex justify-center gap-4">
                <button onClick={handleReset} className="px-6 py-3 bg-gray-400 text-white font-bold rounded-lg hover:bg-gray-500 transition">
                    처음부터 다시하기
                </button>
                <button onClick={() => setCurrentStep('STEP_4_COMIC')} className="px-6 py-3 bg-green-500 text-white font-bold rounded-lg hover:bg-green-600 transition">
                    만화 생성하러 가기
                </button>
            </div>
          </div>
        )}

        {currentStep === 'STEP_4_COMIC' && (
            <>
                <div className="max-w-4xl mx-auto mt-6 text-center">
                    <button
                        onClick={handleGenerateAllImages}
                        disabled={isBusy || allImagesGenerated}
                        className="px-8 py-3 bg-green-500 text-white font-bold text-lg rounded-lg hover:bg-green-600 transition-transform transform hover:scale-105 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center mx-auto"
                    >
                        {isGeneratingAllImages ? <><Spinner /><span className="ml-2">생성중...</span></> : '모든 이미지 한번에 생성'}
                    </button>
                </div>

                <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
                    {panelsToRender.map((panel, index) => {
                         const isInteractive = textFrameStyle === 'speech-bubble' && rawImages[index] && bubbleConfigs[index];
                         return isInteractive ? (
                             <InteractiveComicPanel
                                 key={`${panel.panel}-interactive`}
                                 rawImage={rawImages[index]!}
                                 panel={panel}
                                 bubbleConfig={bubbleConfigs[index]!}
                                 onBubbleConfigChange={(newConfig) => handleBubbleConfigChange(index, newConfig)}
                             />
                         ) : (
                             <ComicPanel
                                 key={panel.panel}
                                 panel={panel}
                                 imageData={finalImages[index]}
                                 isLoading={generatingImageIndex === index || (isGeneratingAllImages && !allImagesGenerated)}
                                 onGenerateImage={() => handleGenerateImage(index)}
                                 isScriptGenerated={!!script}
                             />
                         );
                    })}
                </div>

                {allImagesGenerated && (
                    <>
                    <div className="max-w-4xl mx-auto mt-10 p-6 bg-white rounded-xl shadow-lg border-2 border-orange-100">
                        <h3 className="text-xl font-bold text-center text-orange-800 mb-4">만화 저장하기</h3>
                        <div className="flex justify-center items-center gap-4 flex-wrap">
                        <button onClick={() => handleDownload('grid')} className="px-5 py-2 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 transition">
                            바둑판 (2x2) 저장
                        </button>
                        <button onClick={() => handleDownload('horizontal')} className="px-5 py-2 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 transition">
                            가로 연속 저장
                        </button>
                        <button onClick={() => handleDownload('vertical')} className="px-5 py-2 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 transition">
                            세로 연속 저장
                        </button>
                        <button onClick={handleDownloadIndividual} className="px-5 py-2 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 transition">
                            개별 파일로 저장
                        </button>
                        </div>
                    </div>
                    
                    <div className="max-w-4xl mx-auto mt-10 p-6 bg-white rounded-xl shadow-lg border-2 border-teal-100">
                        <h3 className="text-xl font-bold text-center text-teal-800 mb-4">인스타그램 포스트 추천</h3>
                        {isGeneratingPost && (
                            <div className="flex flex-col items-center justify-center text-teal-600">
                            <Spinner />
                            <p className="mt-2">게시물 내용과 해시태그를 생성하고 있어요...</p>
                            </div>
                        )}
                        {instagramPost && !isGeneratingPost && (
                            <div className="space-y-6">
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                <h4 className="font-bold text-teal-700">추천 설명</h4>
                                <button onClick={() => handleCopyToClipboard(instagramPost.description, '설명')} className="px-4 py-1.5 bg-teal-500 text-white text-sm font-semibold rounded-lg hover:bg-teal-600 transition">
                                    설명 복사
                                </button>
                                </div>
                                <p className="p-4 bg-teal-50 rounded-lg text-gray-800 whitespace-pre-wrap">{instagramPost.description}</p>
                            </div>
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                <h4 className="font-bold text-teal-700">추천 해시태그</h4>
                                <button onClick={() => handleCopyToClipboard(instagramPost.hashtags, '해시태그')} className="px-4 py-1.5 bg-teal-500 text-white text-sm font-semibold rounded-lg hover:bg-teal-600 transition">
                                    해시태그 복사
                                </button>
                                </div>
                                <p className="p-4 bg-teal-50 rounded-lg text-teal-800 font-mono text-sm break-words">{instagramPost.hashtags}</p>
                            </div>
                            </div>
                        )}
                    </div>
                    
                    <div className="max-w-4xl mx-auto mt-8 text-center">
                      {(storyFormat === 'single' && !showContinuationInput) && (
                          <button 
                              onClick={() => setShowContinuationInput(true)}
                              className="px-6 py-3 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 transition"
                          >
                              이어서 생성
                          </button>
                      )}
                      {(storyFormat === 'serial' || showContinuationInput) && (
                          <div className="p-6 bg-white rounded-xl shadow-lg border-2 border-purple-200 text-left">
                              <h3 className="text-xl font-bold text-center text-purple-800 mb-4">다음 이야기 이어가기</h3>
                              
                              {storyFormat === 'serial' && (
                                <div className="mb-4">
                                  <label className="block text-sm font-medium text-gray-700 mb-2">다음 화 전개</label>
                                  <div className="flex items-center justify-around p-1 bg-purple-100 rounded-lg">
                                    <button 
                                      onClick={() => setContinuationType('continue')}
                                      disabled={isBusy}
                                      className={`w-1/2 p-2 text-center font-semibold rounded-md transition-colors ${continuationType === 'continue' ? 'bg-purple-500 text-white shadow' : 'text-purple-700 hover:bg-purple-200'}`}
                                    >
                                      다음 화 계속
                                    </button>
                                    <button 
                                      onClick={() => setContinuationType('end')}
                                      disabled={isBusy}
                                      className={`w-1/2 p-2 text-center font-semibold rounded-md transition-colors ${continuationType === 'end' ? 'bg-purple-500 text-white shadow' : 'text-purple-700 hover:bg-purple-200'}`}
                                    >
                                      다음 화 완결
                                    </button>
                                  </div>
                                </div>
                              )}

                              <textarea
                                  value={continuationTopic}
                                  onChange={(e) => setContinuationTopic(e.target.value)}
                                  placeholder="다음 4컷의 주제를 입력하거나, 비워두고 AI에게 맡겨보세요!"
                                  className="w-full p-3 border-2 border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-400 focus:border-purple-400 transition resize-none"
                                  rows={3}
                                  disabled={isGeneratingContinuation}
                              />
                              <button
                                  onClick={handleGenerateContinuationScript}
                                  disabled={isBusy}
                                  className="w-full mt-4 px-6 py-3 bg-purple-500 text-white font-bold text-lg rounded-lg hover:bg-purple-600 transition disabled:bg-gray-400 flex items-center justify-center"
                              >
                                  {isGeneratingContinuation ? <><Spinner /><span className="ml-2">추가 대본 생성중...</span></> : '추가 대본 생성하기'}
                              </button>
                          </div>
                      )}
                    </div>
                    </>
                )}
                 <div className="mt-8 text-center">
                    <button onClick={handleReset} className="px-6 py-3 bg-gray-400 text-white font-bold rounded-lg hover:bg-gray-500 transition">
                        처음부터 다시하기
                    </button>
                </div>
            </>
        )}
      </main>

      <footer className="text-center mt-12 text-slate-500 text-sm space-y-3">
        <p>개발자 : GPT PARK</p>
        <a
          href="https://www.youtube.com/@AIFACT-GPTPARK"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors shadow"
        >
          <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            {/* FIX: The SVG path was truncated. It has been restored to the correct full path for the YouTube icon. */}
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.377.505 9.377.505s7.505 0 9.377-.505a3.016 3.016 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
          </svg>
        </a>
      </footer>
    </div>
  );
};

// FIX: Added default export to the App component, which was missing and caused the import error.
export default App;